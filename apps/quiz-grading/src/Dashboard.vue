<script setup lang="ts">
import { ref, onMounted, nextTick, computed, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'
import { useRouter } from 'vue-router'
import jsQR from 'jsqr'
import * as XLSX from 'xlsx'
import axios from 'axios'
import * as pdfjsLib from 'pdfjs-dist'
import { mapTextToQuestions, type OcrPageResult, type QuestionRoi, type BBox } from './utils/coordinate-mapping'
// import AssetPickerDialog from '../../../iai-teaching-portal/src/components/assets/AssetPickerDialog.vue'

// --- Configuration ---
// Ensure worker is loaded from local public directory to avoid CDN issues and ensure version matching
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// --- Axios Config ---
// Bypass Vite proxy if it's failing, assuming BFF is on 8150 and CORS is enabled.
// In production this should be relative or configured via env.
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  axios.defaults.baseURL = 'http://localhost:8150'
}

const router = useRouter()
const token = useStorage('iai-token', '')

// --- Backend Sync (BFF) ---
const backendAssignmentId = useStorage<string>('quiz-grading-assignment-id', '')
const backendAssignmentName = useStorage<string>('quiz-grading-assignment-name', '阅卷作业')
const backendAssignmentSubject = useStorage<string>('quiz-grading-assignment-subject', '数学')
const backendAssignmentAnchor = useStorage<{x:number,y:number,w:number,h:number}|null>('quiz-grading-assignment-anchor', null)

const backendBusy = ref(false)
const backendLoadingSubmissions = ref(false)
const backendSavingAll = ref(false)
const backendAssignmentNameHistory = useStorage<string[]>('quiz-grading-assignment-name-history', [])

const commonSubjects = [
  '语文',
  '数学',
  '英语',
  '物理',
  '化学',
  '生物',
  '历史',
  '地理',
  '政治',
  '科学',
  '信息技术'
]

type MultiChoiceScoringMode = 'all_or_nothing' | 'partial_missing_no_wrong'

interface ObjectiveScoringSettings {
  multiChoiceMode: MultiChoiceScoringMode
  fillNumericTolerance: number
  fillIgnoreUnits: boolean
  fillSynonymsText: string
}

const objectiveScoringSettings = useStorage<ObjectiveScoringSettings>('quiz-grading-objective-scoring-settings', {
  multiChoiceMode: 'all_or_nothing',
  fillNumericTolerance: 0,
  fillIgnoreUnits: false,
  fillSynonymsText: ''
})

function recordBackendAssignmentNameHistory() {
  const name = backendAssignmentName.value?.trim()
  if (!name) return
  backendAssignmentNameHistory.value = Array.from(new Set([name, ...backendAssignmentNameHistory.value])).slice(0, 10)
}

type BackendAnswerKeyType = 'single' | 'multi' | 'fill' | 'short' | 'essay'

function authHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...(extra ?? {}) }
  if (token.value) headers.Authorization = `Bearer ${token.value}`
  return headers
}

async function apiJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers as any)
  const merged = authHeaders(Object.fromEntries(headers.entries()))
  const finalHeaders = new Headers(merged)
  if (init.body && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  const res = await fetch(url, { ...init, headers: finalHeaders })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function mapQuestionTypeToAnswerKey(type: QuestionType): BackendAnswerKeyType {
  switch (type) {
    case 'single_choice':
    case 'true_false':
      return 'single'
    case 'multiple_choice':
      return 'multi'
    case 'fill_in_blank':
      return 'fill'
    case 'subjective':
    default:
      return 'essay'
  }
}

async function createBackendAssignment() {
  if (!token.value) {
    alert('请先登录后再创建后端作业')
    return
  }
  backendBusy.value = true
  try {
    const totalPoints = assignmentConfig.value.reduce((sum, q) => sum + (q.maxPoints || 0), 0)
    const name = backendAssignmentName.value?.trim() || `阅卷作业-${new Date().toLocaleString()}`
    const subject = backendAssignmentSubject.value?.trim() || '未指定'
    const assignment = await apiJson<any>('/api/grading/assignments', {
      method: 'POST',
      body: JSON.stringify({
        name,
        subject,
        totalPoints
      })
    })
    backendAssignmentId.value = assignment.id
    alert(`后端作业已创建：${assignment.name}（ID: ${assignment.id}）`)
  } catch (e: any) {
    alert(e.message || '创建后端作业失败')
  } finally {
    backendBusy.value = false
  }
}

async function syncAnswerKeysToBackend() {
  if (!token.value) {
    alert('请先登录后再同步答案')
    return
  }
  if (!backendAssignmentId.value) {
    alert('请先创建/填写后端作业 ID')
    return
  }
  backendBusy.value = true
  try {
    const items = assignmentConfig.value.map((q) => ({
      questionId: q.label,
      questionType: mapQuestionTypeToAnswerKey(q.type),
      content: q.correctAnswer,
      points: q.maxPoints
    }))
    await apiJson('/api/grading/answer-keys', {
      method: 'POST',
      body: JSON.stringify({ assignmentId: backendAssignmentId.value, items })
    })
    alert('答案已同步到后端（AnswerKey）')
  } catch (e: any) {
    alert(e.message || '同步答案失败')
  } finally {
    backendBusy.value = false
  }
}

// --- Types ---
type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_in_blank' | 'subjective'

interface QuestionRegion {
  id: string
  label: string
  type: QuestionType // New field
  x: number 
  y: number 
  w: number
  h: number
  page?: number
  correctAnswer: string
  maxPoints: number
  score_x?: number
  score_y?: number
  gradingCriteria?: string
}

interface GradingResult {
  questionId: string
  studentAnswer: string
  score: number
  feedback: string
  x: number
  y: number
  w: number
  h: number
  // Pass through score pos config
  score_x?: number
  score_y?: number
}

interface StudentPaper {
  id: string
  pageIndex: number // The index of the FIRST page (cover)
  studentName: string
  studentId: string
  status: 'pending' | 'processing' | 'done' | 'error'
  score: number
  image: string // Cover image (legacy/thumbnail)
  pages: { pageIndex: number; image: string }[] // All pages
  results: GradingResult[]
  errorMsg?: string
  backendSubmissionId?: string
  payloadAssetId?: string
  saving?: boolean
  saveError?: string
}

// --- State ---
const activeTab = ref<'setup' | 'upload' | 'list' | 'detail'>('setup')
const dragging = ref(false)
const processingStatus = ref('')
const processingProgress = ref(0)
const processingTotal = ref(0)

// Asset input (load PDF/images from Resource Library)
const assetPickerOpen = ref(false)
const loadingFromAsset = ref(false)

async function fileFromAsset(assetId: string) {
  const authHeader = token.value ? { Authorization: `Bearer ${token.value}` } : undefined
  const res = await fetch(`/api/assets/${assetId}`, { headers: authHeader })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '读取资源失败')
  }
  const asset = await res.json()
  const fileNameBase = String(asset.title || 'paper').replace(/[\\/:*?"<>|]/g, '_')

  // 1) Prefer contentUrl
  if (asset.contentUrl && typeof asset.contentUrl === 'string') {
    const url = asset.contentUrl.trim()
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.*)$/)
      if (!match) throw new Error('资源链接不是有效的 data URL')
      const mime = match[1] || 'application/octet-stream'
      const b64 = match[2] || ''
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'bin')
      return new File([bytes], `${fileNameBase}.${ext}`, { type: mime })
    }

    const fileRes = await fetch(url, { headers: url.startsWith('/') ? authHeader : undefined })
    if (!fileRes.ok) throw new Error(`下载资源失败 (${fileRes.status})`)
    const blob = await fileRes.blob()
    const mime = blob.type || (url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
    const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'bin')
    return new File([blob], `${fileNameBase}.${ext}`, { type: mime })
  }

  // 2) Fallback: content as base64 or data URL
  if (asset.content && typeof asset.content === 'string') {
    const content = asset.content.trim()
    if (content.startsWith('data:')) {
      const match = content.match(/^data:([^;]+);base64,(.*)$/)
      if (!match) throw new Error('资源内容不是有效的 data URL')
      const mime = match[1] || 'application/octet-stream'
      const b64 = match[2] || ''
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'bin')
      return new File([bytes], `${fileNameBase}.${ext}`, { type: mime })
    }
  }

  throw new Error('该资源没有可用的 contentUrl/content（无法作为阅卷输入）')
}

async function loadFromAsset(assets: Array<{ id: string }>) {
  if (!assets || assets.length === 0) return
  if (!token.value) {
    alert('请先登录后使用资源库加载')
    return
  }
  loadingFromAsset.value = true
  try {
    const file = await fileFromAsset(assets[0].id)
    await handleFile(file)
  } catch (e: any) {
    alert(e.message || '从资源库加载失败')
  } finally {
    loadingFromAsset.value = false
  }
}

// Assignment Configuration
const assignmentConfig = ref<QuestionRegion[]>([
  { id: 'q1', label: '第1题', type: 'single_choice', x: 50, y: 150, w: 600, h: 100, page: 1, correctAnswer: 'A', maxPoints: 5 },
  { id: 'q2', label: '第2题', type: 'fill_in_blank', x: 50, y: 260, w: 600, h: 100, page: 1, correctAnswer: '3.14', maxPoints: 5 },
  { id: 'q3', label: '第3题', type: 'subjective', x: 50, y: 370, w: 600, h: 200, page: 1, correctAnswer: 'Triangle needs 3 sides', maxPoints: 10 },
])
const configJson = ref(JSON.stringify(assignmentConfig.value, null, 2))
const templateImage = ref<string | null>(null)
const templateSize = ref<{ width: number; height: number } | null>(null)
const setupCanvasRef = ref<HTMLCanvasElement | null>(null)

// Template / Preview State
let pdfDoc: any = null
const currentPreviewPage = ref(1)
const previewTotalPages = ref(1)
const previewMode = ref<'overlay' | 'crops'>('overlay')
const previewCrops = ref<{ id: string, label: string, url: string }[]>([])
const zoomLevel = ref(1.0)
const templateAnchor = ref<{ x: number, y: number, w: number, h: number } | null>(null)

// --- Interaction State (Box Selection & Dragging) ---
const interactionMode = ref<'idle' | 'drawing' | 'dragging_roi' | 'dragging_score' | 'resizing'>('idle')
// Active Tool: 'cursor' means select/move. Others mean 'Batch Create Mode'.
type ActiveTool = 'cursor' | QuestionType | 'omr_grid'
const activeTool = ref<ActiveTool>('cursor')
// If set, the next draw operation will update this question's coordinates instead of creating a new one.
const pendingMappingQuestionId = ref<string | null>(null)

const selectedQuestionId = ref<string | null>(null)
const hoverQuestionId = ref<string | null>(null) // For hover effects
const dragStart = ref({ x: 0, y: 0 }) // Mouse start pos
const initialObjPos = ref({ x: 0, y: 0, w: 0, h: 0 }) // Object start pos & size

// Temporary state for creating new
const isDrawing = ref(false) // keeping for template compatibility but logic moves to interactionMode
const startPos = ref({ x: 0, y: 0 })
const tempRect = ref<{ x: number, y: number, w: number, h: number } | null>(null)

const showAddModal = ref(false)
const showGridModal = ref(false) // New Grid Modal

const newQuestionForm = reactive({
  label: '',
  type: 'subjective' as QuestionType,
  maxPoints: 5,
  correctAnswer: ''
})

const gridForm = reactive({
  startLabel: 1,
  endLabel: 5,
  cols: 1, // Future support for multi-column layout
  type: 'single_choice' as QuestionType,
  pointsPerQ: 5
})

// Computed for the selected question form in sidebar
const activeQuestion = computed(() => 
  assignmentConfig.value.find(q => q.id === selectedQuestionId.value)
)

// --- Helper: Crop Image Region ---
async function cropImageRegion(dataUrl: string, x: number, y: number, w: number, h: number): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await new Promise(r => img.onload = r)
  
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.9) // Base64
}

// --- Logic: AI Simulation ---
const isSimulating = ref(false)
const simulationResult = ref('')

async function simulateAIGrading() {
  if (!activeQuestion.value || !templateImage.value) return
  isSimulating.value = true
  simulationResult.value = '1. 正在截取题目区域...'
  
  try {
     // 1. Crop Image
     const q = activeQuestion.value
     const cropBase64 = await cropImageRegion(templateImage.value, q.x, q.y, q.w, q.h)
     const base64Content = cropBase64.split(',')[1]
     
     // 2. Upload to OCR Service (Mock or Real)
     simulationResult.value = '2. 正在调用 OCR 识别文字...'
     const uploadRes = await axios.post('/api/ocr/upload', {
        fileName: `question_${q.id}.jpg`,
        contentBase64: base64Content,
        scene: 'lens' // Use 'lens' mode for faster mock response
     }, {
        headers: { Authorization: `Bearer ${token.value}` } 
        // Note: token is from useStorage('iai-token', '') defined in App.vue, 
        // but here in Dashboard.vue we need to access it. 
        // Let's add token ref if not present.
     })
     
     const taskId = uploadRes.data.taskId
     
     // 3. Poll for Status
     let attempts = 0
     while (attempts < 20) { // Max 10s (lens mode is fast)
        await new Promise(r => setTimeout(r, 500))
        const statusRes = await axios.get(`/api/ocr/status/${taskId}`, {
           headers: { Authorization: `Bearer ${token.value}` }
        })
        
        if (statusRes.data.status === 'done') {
           // 4. Get Result
           const resultRes = await axios.get(`/api/ocr/result/${taskId}`, {
              headers: { Authorization: `Bearer ${token.value}` }
           })
           
           const ocrText = resultRes.data.result || ''
           
           // 5. Call Intelligent Grading API (Real LLM)
           simulationResult.value = '3. 正在进行 AI 智能判分 (DeepSeek)...'
           
           try {
             const gradeRes = await axios.post('/api/grading/grade-image', {
                imageBase64: base64Content, // Keep for context if model supports vision
                questionText: q.label + (q.gradingCriteria ? ` (评分标准: ${q.gradingCriteria})` : ''),
                correctAnswer: q.correctAnswer,
                maxPoints: q.maxPoints,
                ocrText: ocrText // Pass OCR text explicitly
             }, {
                headers: { Authorization: `Bearer ${token.value}` }
             })
             
             const result = gradeRes.data
             simulationResult.value = `[识别结果]: ${ocrText.substring(0, 50)}...\n[AI 评分]: ${result.score}/${q.maxPoints}\n[理由]: ${result.feedback}`
             
           } catch (gradeErr: any) {
             console.error(gradeErr)
             simulationResult.value = `OCR 成功，但评分失败: ${gradeErr.message}`
           }
           
           break
        } else if (statusRes.data.status === 'error') {
           throw new Error(statusRes.data.error || 'OCR 处理失败')
        }
        attempts++
     }
     
  } catch (e: any) {
     simulationResult.value = '错误: ' + (e.response?.data?.message || e.message)
  } finally {
     isSimulating.value = false
  }
}

// --- Batch Grading Logic ---
async function batchGradeObjectiveQuestions(
  paper: StudentPaper,
  configs: QuestionRegion[],
  img: HTMLImageElement,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
  groupLabel: 'choice' | 'true_false' | 'fill'
) {
  if (configs.length === 0) return []

  const parseSynonyms = (text: string) => {
    const map = new Map<string, string>()
    const lines = String(text ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    for (const line of lines) {
      const parts = line.split('=')
      if (parts.length < 2) continue
      const from = parts[0].trim()
      const to = parts.slice(1).join('=').trim()
      if (from && to) map.set(from, to)
    }
    return map
  }

  const applySynonyms = (val: string, synonyms: Map<string, string>) => {
    const s = String(val ?? '').trim()
    if (!s) return s
    return synonyms.get(s) ?? s
  }

  const normalizeChoice = (v: string) =>
    String(v ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')

  const normalizeTrueFalse = (v: string) => {
    const s = String(v ?? '').trim().toUpperCase()
    if (!s) return ''
    if (/[对√T]/.test(s)) return 'T'
    if (/[错×F]/.test(s)) return 'F'
    return ''
  }

  const normalizeFill = (v: string) =>
    String(v ?? '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/[，,。．]/g, '.')

  const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])

  const parseFirstNumber = (s: string): number | null => {
    const match = String(s ?? '').match(/-?\d+(?:\.\d+)?/)
    if (!match) return null
    const n = Number.parseFloat(match[0])
    return Number.isFinite(n) ? n : null
  }

  const scoreFill = (expectedRaw: string, actualRaw: string) => {
    const synonyms = parseSynonyms(objectiveScoringSettings.value.fillSynonymsText)
    const expectedApplied = applySynonyms(expectedRaw, synonyms)
    const actualApplied = applySynonyms(actualRaw, synonyms)

    const tol = Number(objectiveScoringSettings.value.fillNumericTolerance || 0)
    const ignoreUnits = Boolean(objectiveScoringSettings.value.fillIgnoreUnits)

    if (tol > 0) {
      const expectedNum = parseFirstNumber(expectedApplied)
      const actualNum = parseFirstNumber(actualApplied)
      if (expectedNum !== null && actualNum !== null) {
        if (Math.abs(expectedNum - actualNum) <= tol) return true
        return false
      }
    }

    if (ignoreUnits) {
      const expectedNum = parseFirstNumber(expectedApplied)
      const actualNum = parseFirstNumber(actualApplied)
      if (expectedNum !== null && actualNum !== null) return expectedNum === actualNum
    }

    const expected = normalizeFill(expectedApplied)
    const actual = normalizeFill(actualApplied)
    return expected && expected === actual
  }

  const scoreObjective = (cfg: QuestionRegion, extractedRaw: string) => {
    const expectedRaw = String(cfg.correctAnswer ?? '')
    if (groupLabel === 'choice') {
      if (cfg.type === 'multiple_choice') {
        const expected = normalizeChoice(expectedRaw).split('').sort()
        const actual = normalizeChoice(extractedRaw).split('').sort()
        if (expected.length === 0) return 0

        // If any wrong option selected -> 0
        const expectedSet = new Set(expected)
        if (actual.some((opt) => !expectedSet.has(opt))) return 0

        const mode = objectiveScoringSettings.value.multiChoiceMode
        if (mode === 'partial_missing_no_wrong') {
          const correctSelected = actual.filter((opt) => expectedSet.has(opt)).length
          const ratio = correctSelected / expected.length
          return Math.max(0, Math.min(cfg.maxPoints, Math.round(cfg.maxPoints * ratio)))
        }

        // all_or_nothing
        return arraysEqual(expected, actual) ? cfg.maxPoints : 0
      }
      const expected = normalizeChoice(expectedRaw)
      const actual = normalizeChoice(extractedRaw)
      return expected && expected === actual ? cfg.maxPoints : 0
    }
    if (groupLabel === 'true_false') {
      const expected = normalizeTrueFalse(expectedRaw)
      const actual = normalizeTrueFalse(extractedRaw)
      return expected && expected === actual ? cfg.maxPoints : 0
    }
    // fill
    return scoreFill(expectedRaw, extractedRaw) ? cfg.maxPoints : 0
  }

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 1. Prepare Canvas for Stitching
  // Layout: Single column for simplicity and better OCR sequencing
  const PADDING = 20
  const LABEL_WIDTH = 40
  let totalH = PADDING
  let maxW = 0
  
  const crops: { id: string, label: string, tag: string, canvas: HTMLCanvasElement }[] = []
  
  for (const cfg of configs) {
     const fw = cfg.w * scaleX
     const fh = cfg.h * scaleY
     const fx = (cfg.x * scaleX) + offsetX
     const fy = (cfg.y * scaleY) + offsetY
     
     const c = document.createElement('canvas')
     c.width = fw
     c.height = fh
     const ctx = c.getContext('2d')
     if (ctx) ctx.drawImage(img, fx, fy, fw, fh, 0, 0, fw, fh)
     
     const digits = cfg.label.replace(/[^0-9]/g, '') || cfg.id.slice(0, 6)
     const tag = `Q${digits}`
     crops.push({ id: cfg.id, label: cfg.label, tag, canvas: c })
     
     totalH += fh + PADDING
     maxW = Math.max(maxW, fw)
  }
  
  const stitchCanvas = document.createElement('canvas')
  stitchCanvas.width = maxW + LABEL_WIDTH + PADDING * 2
  stitchCanvas.height = totalH
  const sCtx = stitchCanvas.getContext('2d')
  if (!sCtx) return []
  
  // Fill white background
  sCtx.fillStyle = '#ffffff'
  sCtx.fillRect(0, 0, stitchCanvas.width, stitchCanvas.height)
  
  // Draw crops with labels (machine-friendly tags for OCR)
  let currentY = PADDING
  sCtx.font = 'bold 20px Arial'
  sCtx.fillStyle = '#000000'
  sCtx.textBaseline = 'middle'
  
  for (const item of crops) {
     // Draw Tag (e.g. "Q1")
     sCtx.fillText(`${item.tag}:`, PADDING, currentY + item.canvas.height / 2)
     
     // Draw Image
     sCtx.drawImage(item.canvas, PADDING + LABEL_WIDTH, currentY)
     
     currentY += item.canvas.height + PADDING
  }
  
  const stitchedBase64 = stitchCanvas.toDataURL('image/jpeg', 0.82).split(',')[1]
  
  try {
     processingStatus.value =
       groupLabel === 'choice'
         ? '正在识别选择题...'
         : groupLabel === 'true_false'
           ? '正在识别判断题...'
           : '正在识别填空题...'

     // 2. OCR once for the stitched image, then do deterministic scoring locally.
     const uploadRes = await axios.post('/api/ocr/upload', {
        fileName: `batch_${paper.studentId}.jpg`,
        contentBase64: stitchedBase64,
        scene: 'doc' // Use doc mode for better layout analysis
     }, { headers: { Authorization: `Bearer ${token.value}` } })
     
     const taskId = uploadRes.data.taskId
     let ocrText = ''
     
     // Poll OCR
     let attempts = 0
     while (attempts < 20) {
        await new Promise(r => setTimeout(r, 800))
        const statusRes = await axios.get(`/api/ocr/status/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } })
        if (statusRes.data.status === 'done') {
           const resRes = await axios.get(`/api/ocr/result/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } })
           ocrText = resRes.data.result || ''
           break
        }
        attempts++
     }

     const lines = String(ocrText ?? '')
       .split(/\r?\n/)
       .map((l) => l.trim())
       .filter(Boolean)

     const results: GradingResult[] = []
     for (const cfg of configs) {
        const digits = cfg.label.replace(/[^0-9]/g, '') || cfg.id.slice(0, 6)
        const tag = `Q${digits}`

        const tagRe = new RegExp(`\\b${escapeRegExp(tag)}\\b\\s*[:：]?\\s*(.*)$`, 'i')
        const hitLine = lines.find((l) => tagRe.test(l)) || ''
        const match = hitLine.match(tagRe)
        const extracted = (match?.[1] ?? '').trim()

        const studentAnswer = extracted || '(未识别)'
        const score = scoreObjective(cfg, studentAnswer)
        const feedback = score > 0 ? '客观题判分：正确' : '客观题判分：错误/未识别'
        
        // Calculate coords again for result box (redundant but needed for array)
        const fx = (cfg.x * scaleX) + offsetX
        const fy = (cfg.y * scaleY) + offsetY
        const fw = cfg.w * scaleX
        const fh = cfg.h * scaleY

        results.push({
           questionId: cfg.label,
           studentAnswer,
           score: score,
           feedback: feedback,
           x: fx, y: fy, w: fw, h: fh,
           score_x: cfg.score_x ? (cfg.score_x * scaleX + offsetX) : undefined,
           score_y: cfg.score_y ? (cfg.score_y * scaleY + offsetY) : undefined
        })
     }
     
     return results

  } catch (e) {
     console.error('Batch Grading Failed', e)
     return []
  }
}

// --- Logic: Canvas Helpers ---
function getCanvasCoordinates(e: MouseEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  }
}

// Check if point is inside a rect
function isPointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
}

// --- Logic: Canvas Interaction (Main) ---
function onCanvasMouseDown(e: MouseEvent) {
  if (activeTab.value !== 'setup' || !templateImage.value) return
  const canvas = setupCanvasRef.value
  if (!canvas) return
  
  const pos = getCanvasCoordinates(e, canvas)
  
  // 0. Check Resize Handle Hit (Prioritize over dragging)
  if (selectedQuestionId.value) {
    const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value)
    if (q && (q.page || 1) === currentPreviewPage.value) {
       const handleSize = 12
       // Hit test bottom-right corner
       if (isPointInRect(pos.x, pos.y, q.x + q.w - handleSize, q.y + q.h - handleSize, handleSize * 2, handleSize * 2)) {
          interactionMode.value = 'resizing'
          dragStart.value = pos
          initialObjPos.value = { x: q.x, y: q.y, w: q.w, h: q.h }
          return
       }
    }
  }
  
  // 1. Check Hit: Score Handles (Red Boxes) - Prioritize these as they might be on top
  // Only check for the currently selected question or all? Let's check all to allow quick switch.
  // But strictly, maybe prioritize selected.
  
  // If a specific creation tool is active, skip hit testing to allow drawing over existing items
  if (activeTool.value === 'cursor') {
      // Reverse iterate to hit top-most elements first
      for (let i = assignmentConfig.value.length - 1; i >= 0; i--) {
        const q = assignmentConfig.value[i]
        // Filter page
        if ((q.page || 1) !== currentPreviewPage.value) continue

        // Check Score Box Hit (approx 60x40 area centered or top-left)
        const sx = q.score_x !== undefined ? q.score_x : (q.x + q.w - 40)
        const sy = q.score_y !== undefined ? q.score_y : (q.y + 10)
        
        if (isPointInRect(pos.x, pos.y, sx, sy, 60, 40)) {
          interactionMode.value = 'dragging_score'
          selectedQuestionId.value = q.id
          dragStart.value = pos
          initialObjPos.value = { x: sx, y: sy, w: 0, h: 0 }
          drawSetupPreview()
          return
        }
      }

      // 2. Check Hit: ROI Boxes (Blue Boxes)
      for (let i = assignmentConfig.value.length - 1; i >= 0; i--) {
        const q = assignmentConfig.value[i]
        if ((q.page || 1) !== currentPreviewPage.value) continue

        if (isPointInRect(pos.x, pos.y, q.x, q.y, q.w, q.h)) {
          interactionMode.value = 'dragging_roi'
          selectedQuestionId.value = q.id
          dragStart.value = pos
          initialObjPos.value = { x: q.x, y: q.y, w: 0, h: 0 }
          drawSetupPreview()
          return
        }
      }
  }

  // 3. Else: Start Drawing New (or Mapping)
  interactionMode.value = 'drawing'
  if (activeTool.value !== 'cursor') {
     // If in tool mode, ensure we deselect to avoid confusion
     selectedQuestionId.value = null 
  }
  startPos.value = pos
  tempRect.value = { x: pos.x, y: pos.y, w: 0, h: 0 }
}

function onCanvasMouseMove(e: MouseEvent) {
  const canvas = setupCanvasRef.value
  if (!canvas) return
  const pos = getCanvasCoordinates(e, canvas)
  
  // Hover effects
  if (interactionMode.value === 'idle') {
    let hit = false
    canvas.style.cursor = 'crosshair'
    
    // Check Resize Handle Hover
    if (selectedQuestionId.value) {
       const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value)
       if (q && (q.page || 1) === currentPreviewPage.value) {
          const handleSize = 12
          if (isPointInRect(pos.x, pos.y, q.x + q.w - handleSize, q.y + q.h - handleSize, handleSize * 2, handleSize * 2)) {
             canvas.style.cursor = 'nwse-resize'
             return
          }
       }
    }
    
    // Check hits for cursor style
    for (let i = assignmentConfig.value.length - 1; i >= 0; i--) {
      const q = assignmentConfig.value[i]
      if ((q.page || 1) !== currentPreviewPage.value) continue
      
      const sx = q.score_x !== undefined ? q.score_x : (q.x + q.w - 40)
      const sy = q.score_y !== undefined ? q.score_y : (q.y + 10)
      
      if (isPointInRect(pos.x, pos.y, sx, sy, 60, 40)) {
        canvas.style.cursor = 'move' // Score
        hit = true
        break
      }
      if (isPointInRect(pos.x, pos.y, q.x, q.y, q.w, q.h)) {
        canvas.style.cursor = 'move' // ROI
        hit = true
        break
      }
    }
    return
  }

  if (interactionMode.value === 'drawing' && tempRect.value) {
    tempRect.value.w = pos.x - startPos.value.x
    tempRect.value.h = pos.y - startPos.value.y
    drawSetupPreview()
  }
  
  if (interactionMode.value === 'resizing' && selectedQuestionId.value) {
    const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value)
    if (q) {
       // Calc new width/height based on mouse pos relative to top-left of object
       const newW = pos.x - initialObjPos.value.x
       const newH = pos.y - initialObjPos.value.y
       
       // Min size constraint
       if (newW > 20) q.w = newW
       if (newH > 20) q.h = newH
       
       drawSetupPreview()
    }
  }
  
  if (interactionMode.value === 'dragging_roi' && selectedQuestionId.value) {
    const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value)
    if (q) {
      const dx = pos.x - dragStart.value.x
      const dy = pos.y - dragStart.value.y
      q.x = initialObjPos.value.x + dx
      q.y = initialObjPos.value.y + dy
      // Also move score if it wasn't customized (optional, but good UX)
      // Actually, if score_x is undefined, it follows ROI automatically in renderer.
      // If defined, it stays absolute. Let's keep it absolute if defined.
      drawSetupPreview()
    }
  }
  
  if (interactionMode.value === 'dragging_score' && selectedQuestionId.value) {
    const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value)
    if (q) {
      const dx = pos.x - dragStart.value.x
      const dy = pos.y - dragStart.value.y
      q.score_x = initialObjPos.value.x + dx
      q.score_y = initialObjPos.value.y + dy
      drawSetupPreview()
    }
  }
}

function onCanvasMouseUp(e: MouseEvent) {
  if (interactionMode.value === 'drawing' && tempRect.value) {
    // Finish Drawing
    const finalRect = {
      x: tempRect.value.w < 0 ? tempRect.value.x + tempRect.value.w : tempRect.value.x,
      y: tempRect.value.h < 0 ? tempRect.value.y + tempRect.value.h : tempRect.value.y,
      w: Math.abs(tempRect.value.w),
      h: Math.abs(tempRect.value.h)
    }
    
    if (finalRect.w > 10 && finalRect.h > 10) {
      tempRect.value = finalRect
      
      // Determine what to do based on Tool Mode
      if (activeTool.value === 'omr_grid') {
         // --- GRID SPLIT MODE ---
         // Open Grid Config Modal
         const nextNum = assignmentConfig.value.length + 1
         gridForm.startLabel = nextNum
         gridForm.endLabel = nextNum + 4 // Default +4 (total 5)
         gridForm.pointsPerQ = 3 
         gridForm.type = 'single_choice'
         
         showGridModal.value = true
         // We keep tempRect to know where to split
         
      } else if (activeTool.value !== 'cursor') {
         // --- BATCH CREATE MODE ---
         // Auto-generate ID and Label
         const nextNum = assignmentConfig.value.length + 1
         const newQ: QuestionRegion = {
            id: crypto.randomUUID(),
            label: `第${nextNum}题`,
            type: activeTool.value as QuestionType,
            x: Math.round(finalRect.x),
            y: Math.round(finalRect.y),
            w: Math.round(finalRect.w),
            h: Math.round(finalRect.h),
            page: currentPreviewPage.value,
            correctAnswer: activeTool.value === 'single_choice' ? 'A' : '',
            maxPoints: 5
         }
         assignmentConfig.value.push(newQ)
         
         // Auto-select the new question to show properties immediately (optional)
         // selectedQuestionId.value = newQ.id
         
         // Clear temp rect but STAY in drawing mode
         tempRect.value = null
         // Update JSON
         configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
         drawSetupPreview()
         
      } else if (pendingMappingQuestionId.value) {
         // --- MAPPING MODE ---
         const qIndex = assignmentConfig.value.findIndex(q => q.id === pendingMappingQuestionId.value)
         if (qIndex !== -1) {
            const q = assignmentConfig.value[qIndex]
            q.x = Math.round(finalRect.x)
            q.y = Math.round(finalRect.y)
            q.w = Math.round(finalRect.w)
            q.h = Math.round(finalRect.h)
            q.page = currentPreviewPage.value
            
            // Auto-select
            selectedQuestionId.value = q.id
         }
         pendingMappingQuestionId.value = null
         tempRect.value = null
         configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
         drawSetupPreview()
      } else {
         // --- DEFAULT MODE (Modal) ---
         const nextIdx = assignmentConfig.value.length + 1
         newQuestionForm.label = `第${nextIdx}题`
         newQuestionForm.maxPoints = 5
         newQuestionForm.correctAnswer = ''
         newQuestionForm.type = 'subjective' // Default
         showAddModal.value = true
      }
    } else {
      tempRect.value = null
      drawSetupPreview()
    }
  }
  
  // Sync JSON if we were dragging or resizing
  if (interactionMode.value !== 'idle' && interactionMode.value !== 'drawing') {
    configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
  }

  interactionMode.value = 'idle'
}

function saveNewQuestion() {
  if (tempRect.value) {
    assignmentConfig.value.push({
      id: crypto.randomUUID(),
      label: newQuestionForm.label,
      type: newQuestionForm.type,
      x: Math.round(tempRect.value.x),
      y: Math.round(tempRect.value.y),
      w: Math.round(tempRect.value.w),
      h: Math.round(tempRect.value.h),
      page: currentPreviewPage.value, // Record current page
      correctAnswer: newQuestionForm.correctAnswer,
      maxPoints: newQuestionForm.maxPoints
    })
    
    // Sync to JSON text
    configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
  }
  
  showAddModal.value = false
  tempRect.value = null
  drawSetupPreview()
}

function cancelAddQuestion() {
  showAddModal.value = false
  tempRect.value = null
  drawSetupPreview()
}

function confirmGridSplit() {
  if (!tempRect.value) return
  
  const count = Math.max(1, gridForm.endLabel - gridForm.startLabel + 1)
  const cols = Math.max(1, gridForm.cols)
  const rows = Math.ceil(count / cols)
  
  const cellW = tempRect.value.w / cols
  const cellH = tempRect.value.h / rows
  
  for (let i = 0; i < count; i++) {
     const qNum = gridForm.startLabel + i
     
     // Calculate Grid Position (Z-order: Left->Right, Top->Bottom)
     const colIdx = i % cols
     const rowIdx = Math.floor(i / cols)
     
     const qX = tempRect.value.x + (colIdx * cellW)
     const qY = tempRect.value.y + (rowIdx * cellH)
     
     // Slightly shrink to avoid overlap
     const gap = 2
     const actualW = cellW - gap
     const actualH = cellH - gap
     
     assignmentConfig.value.push({
        id: crypto.randomUUID(),
        label: `第${qNum}题`,
        type: gridForm.type,
        x: Math.round(qX),
        y: Math.round(qY),
        w: Math.round(Math.max(10, actualW)),
        h: Math.round(Math.max(10, actualH)),
        page: currentPreviewPage.value,
        correctAnswer: 'A', // Default
        maxPoints: gridForm.pointsPerQ
     })
  }
  
  showGridModal.value = false
  tempRect.value = null
  configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
  drawSetupPreview()
}

function cancelGridSplit() {
  showGridModal.value = false
  tempRect.value = null
  drawSetupPreview()
}

function onJsonChange() {
  try {
    const parsed = JSON.parse(configJson.value)
    if (Array.isArray(parsed)) {
      assignmentConfig.value = parsed
      refreshPreview()
    }
  } catch {
    // Ignore syntax errors
  }
}

async function refreshPreview() {
  if (previewMode.value === 'overlay') {
    drawSetupPreview()
  } else {
    await generatePreviewCrops()
  }
}

async function generatePreviewCrops() {
  if (!templateImage.value) return
  
  const img = new Image()
  img.src = templateImage.value
  await new Promise(r => img.onload = r)
  
  const crops: { id: string, label: string, url: string }[] = []
  
  assignmentConfig.value.forEach(q => {
    // Filter by page if needed
    const qPage = q.page || 1
    if (qPage !== currentPreviewPage.value) return

    const canvas = document.createElement('canvas')
    canvas.width = q.w
    canvas.height = q.h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Draw cropped region
      ctx.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h)
      crops.push({
        id: q.id,
        label: q.label,
        url: canvas.toDataURL('image/jpeg')
      })
    }
  })
  previewCrops.value = crops
}

function startMapping(id: string) {
  pendingMappingQuestionId.value = id
  activeTool.value = 'cursor' // Ensure we are in cursor mode to avoid creating new items
  // Ideally change cursor to crosshair
  if (setupCanvasRef.value) setupCanvasRef.value.style.cursor = 'crosshair'
}

function importJsonConfig(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    try {
       const parsed = JSON.parse(text)
       if (parsed.questions && Array.isArray(parsed.questions)) {
          assignmentConfig.value = parsed.questions
          templateAnchor.value = parsed.anchor || null
          backendAssignmentAnchor.value = parsed.anchor || null
       } else if (Array.isArray(parsed)) {
          // Legacy format
          assignmentConfig.value = parsed
       }
       configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
       refreshPreview()
    } catch {
       alert('无法解析配置文件')
    }
  }
  reader.readAsText(file)
}

function exportJsonConfig() {
  const exportData = {
    anchor: templateAnchor.value,
    questions: assignmentConfig.value
  }
  const jsonStr = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'grading-config.json'
  a.click()
  URL.revokeObjectURL(url)
}

// --- Setup Preview Logic ---
const templateFileInput = ref<HTMLInputElement | null>(null)

function onTemplateFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) handleTemplateUpload(files[0])
}

async function handleTemplateUpload(file: File) {
  if (file.type === 'application/pdf') {
    try {
      const buffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument(buffer).promise
      pdfDoc = pdf
      previewTotalPages.value = pdf.numPages
      currentPreviewPage.value = 1
      await renderCurrentTemplatePage()
    } catch (e: any) {
      console.error(e)
      alert('PDF 预览加载失败: ' + (e.message || e))
    }
  } else if (file.type.startsWith('image/')) {
    pdfDoc = null
    previewTotalPages.value = 1
    currentPreviewPage.value = 1
    const reader = new FileReader()
    reader.onload = (e) => {
      templateImage.value = e.target?.result as string
      refreshPreview()
    }
    reader.readAsDataURL(file)
  }
}

async function changePreviewPage(delta: number) {
  const newPage = currentPreviewPage.value + delta
  if (newPage >= 1 && newPage <= previewTotalPages.value) {
    currentPreviewPage.value = newPage
    if (pdfDoc) {
      await renderCurrentTemplatePage()
    }
  }
}

async function renderCurrentTemplatePage() {
  if (!pdfDoc) return
  const page = await pdfDoc.getPage(currentPreviewPage.value)
  const viewport = page.getViewport({ scale: 1.5 })
  
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    await page.render({ canvasContext: ctx, viewport } as any).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    templateImage.value = dataUrl
    
    // Auto-detect anchor on the template
    await scanTemplateAnchor(dataUrl, canvas.width, canvas.height)
    
    // Force wait for next tick to ensure v-if="templateImage" renders the canvas wrapper
    nextTick(() => {
        refreshPreview()
    })
  }
}

async function scanTemplateAnchor(dataUrl: string, w: number, h: number) {
  const img = new Image()
  img.src = dataUrl
  await new Promise(r => img.onload = r)
  
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const code = jsQR(imageData.data, w, h)
  
  if (code) {
     const loc = code.location
     // Calculate bounding box of QR
     const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x)
     const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x)
     const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y)
     const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y)
     
     templateAnchor.value = {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY
     }
     backendAssignmentAnchor.value = templateAnchor.value
     console.log('Template Anchor Found:', templateAnchor.value)
  } else {
     templateAnchor.value = null
     backendAssignmentAnchor.value = null
     console.log('No Anchor found on template page')
  }
}

// Override drawSetupPreview to include debug overlay
function drawSetupPreview() {
  const canvas = setupCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 1. Draw Base (Image + ROIs)
  if (templateImage.value) {
    const img = new Image()
    img.onload = () => {
      // Resize canvas to match image dimensions for accurate coordinate mapping
      canvas.width = img.width
      canvas.height = img.height
      templateSize.value = { width: img.width, height: img.height }
      
      ctx.drawImage(img, 0, 0)
      
      // Draw Template Anchor
      if (templateAnchor.value) {
         const a = templateAnchor.value
         ctx.save()
         ctx.strokeStyle = '#10b981' // Emerald 500
         ctx.lineWidth = 3
         ctx.setLineDash([5, 3])
         ctx.strokeRect(a.x, a.y, a.w, a.h)
         
         // Crosshair
         const cx = a.x + a.w/2
         const cy = a.y + a.h/2
         ctx.beginPath()
         ctx.moveTo(cx - 10, cy)
         ctx.lineTo(cx + 10, cy)
         ctx.moveTo(cx, cy - 10)
         ctx.lineTo(cx, cy + 10)
         ctx.stroke()
         
         ctx.fillStyle = '#10b981'
         ctx.font = 'bold 12px Arial'
         ctx.fillText('基准锚点', a.x, a.y - 5)
         ctx.restore()
      }
      
      drawROIs(ctx)
      drawDebugOverlay(ctx) // Call debug draw
    }
    img.src = templateImage.value
  } else {
    // Default A4-ish ratio placeholder
    canvas.width = 595 * 1.5
    canvas.height = 842 * 1.5
    templateSize.value = { width: canvas.width, height: canvas.height }
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw placeholder text
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '20px sans-serif'
    ctx.fillText('请上传标准答案卷 (PDF) 以校验', 100, 100)
    
    drawROIs(ctx)
    drawDebugOverlay(ctx) // Call debug draw
  }
  
  // Draw temporary selection box or Grid Preview
  if (tempRect.value) {
    if (showGridModal.value) {
       // --- LIVE GRID PREVIEW ---
       const count = Math.max(1, gridForm.endLabel - gridForm.startLabel + 1)
       const cols = Math.max(1, gridForm.cols)
       const rows = Math.ceil(count / cols)
       
       const cellW = tempRect.value.w / cols
       const cellH = tempRect.value.h / rows
       
       ctx.save()
       // Outer Box
       ctx.strokeStyle = '#f97316' // Orange 500
       ctx.lineWidth = 3
       ctx.strokeRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h)
       
       // Inner Cells
       ctx.lineWidth = 1
       ctx.setLineDash([4, 4])
       ctx.fillStyle = 'rgba(249, 115, 22, 0.1)'
       
       for (let i = 0; i < count; i++) {
          const colIdx = i % cols
          const rowIdx = Math.floor(i / cols)
          const cx = tempRect.value.x + colIdx * cellW
          const cy = tempRect.value.y + rowIdx * cellH
          
          ctx.strokeRect(cx, cy, cellW, cellH)
          ctx.fillRect(cx, cy, cellW, cellH)
          
          // Preview Number
          ctx.fillStyle = '#f97316'
          ctx.font = 'bold 12px Arial'
          ctx.fillText(`${gridForm.startLabel + i}`, cx + 4, cy + 14)
          ctx.fillStyle = 'rgba(249, 115, 22, 0.1)' // Reset fill
       }
       
       ctx.restore()
       
    } else {
       // --- NORMAL DRAG PREVIEW ---
       ctx.save()
       ctx.strokeStyle = '#ef4444'
       ctx.lineWidth = 2
       ctx.setLineDash([5, 5])
       ctx.strokeRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h)
       ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'
       ctx.fillRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h)
       ctx.restore()
    }
  }
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D) {
  if (!showDebugOverlay.value || !debugOcrResult.value) return
  
  ctx.save()
  
  // 1. Draw all OCR spans (faint green)
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)' // Green 500
  ctx.fillStyle = 'rgba(16, 185, 129, 0.1)'
  ctx.lineWidth = 1
  
  debugOcrResult.value.spans.forEach(span => {
    const [x, y, w, h] = span.bbox
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
  })
  
  // 2. Draw connections/assignments
  debugMappings.value.forEach(mapping => {
    // Find question center
    const q = assignmentConfig.value.find(item => item.id === mapping.questionId)
    if (!q) return
    
    const qCx = q.x + q.w / 2
    const qCy = q.y + q.h / 2
    
    mapping.segments.forEach(seg => {
      const sCx = seg.x + seg.w / 2
      const sCy = seg.y + seg.h / 2
      
      // Draw Line
      ctx.beginPath()
      ctx.moveTo(sCx, sCy)
      ctx.lineTo(qCx, qCy)
      ctx.strokeStyle = '#2563eb' // Blue 600
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.stroke()
      
      // Highlight assigned segment
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.strokeRect(seg.x, seg.y, seg.w, seg.h)
    })
  })
  
  ctx.restore()
}

function drawROIs(ctx: CanvasRenderingContext2D) {
  assignmentConfig.value.forEach((q, idx) => {
    // Only draw ROIs for current page. If 'page' is missing, assume page 1.
    const qPage = q.page || 1
    if (qPage !== currentPreviewPage.value) return

    // Box
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.strokeRect(q.x, q.y, q.w, q.h)
    
    // Fill slightly
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    ctx.fillRect(q.x, q.y, q.w, q.h)
    
    // Style based on selection
    const isSelected = selectedQuestionId.value === q.id
    
    // Box
    ctx.strokeStyle = isSelected ? '#2563eb' : '#3b82f6'
    ctx.lineWidth = isSelected ? 4 : 2
    ctx.setLineDash([]) // Solid line for ROI
    
    // Draw ROI
    ctx.strokeRect(q.x, q.y, q.w, q.h)
    ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(59, 130, 246, 0.05)'
    ctx.fillRect(q.x, q.y, q.w, q.h)
    
    // Resize Handle (Bottom-Right)
    if (isSelected) {
       const handleSize = 10
       ctx.fillStyle = '#ffffff'
       ctx.strokeStyle = '#2563eb'
       ctx.lineWidth = 2
       ctx.fillRect(q.x + q.w - handleSize/2, q.y + q.h - handleSize/2, handleSize, handleSize)
       ctx.strokeRect(q.x + q.w - handleSize/2, q.y + q.h - handleSize/2, handleSize, handleSize)
    }
    
    // Label
    ctx.fillStyle = isSelected ? '#2563eb' : '#3b82f6'
    ctx.font = isSelected ? 'bold 18px Arial' : 'bold 16px Arial'
    ctx.fillText(`${q.label}`, q.x, q.y - 8)
    
    // Answer Key Tag (Enhanced Visualization)
    if (q.correctAnswer) {
       const ansText = `Ref: ${q.correctAnswer}`
       ctx.font = '12px Arial'
       const metrics = ctx.measureText(ansText)
       const tagW = metrics.width + 12
       const tagH = 20
       
       // Draw tag background
       ctx.fillStyle = isSelected ? '#1d4ed8' : '#3b82f6'
       ctx.beginPath()
       ctx.roundRect(q.x + q.w - tagW, q.y + q.h + 4, tagW, tagH, 4)
       ctx.fill()
       
       // Draw text
       ctx.fillStyle = '#ffffff'
       ctx.fillText(ansText, q.x + q.w - tagW + 6, q.y + q.h + 18)
    }

    // Visualize Score Position
    const scoreX = q.score_x !== undefined ? q.score_x : (q.x + q.w - 40)
    const scoreY = q.score_y !== undefined ? q.score_y : (q.y + 10)
    
    // Draw Score Mark Preview
    ctx.save()
    
    // Determine style based on selection
    if (isSelected) {
       ctx.setLineDash([4, 4])
       ctx.strokeStyle = '#ef4444' 
       ctx.lineWidth = 2
       ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'
    } else {
       ctx.setLineDash([2, 2])
       ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'
       ctx.lineWidth = 1
       ctx.fillStyle = 'rgba(239, 68, 68, 0.05)'
    }
    
    // Draw Score Box Area
    ctx.strokeRect(scoreX, scoreY, 60, 40)
    ctx.fillRect(scoreX, scoreY, 60, 40)
    
    // Simulate the actual marking (Tick + Score) to help user align
    const markSize = 20
    const markOriginX = scoreX
    const markOriginY = scoreY
    
    // Draw Ghost Tick
    ctx.beginPath()
    ctx.strokeStyle = isSelected ? '#10b981' : 'rgba(16, 185, 129, 0.6)'
    ctx.lineWidth = 3
    ctx.setLineDash([]) // Solid tick
    ctx.moveTo(markOriginX, markOriginY + markSize/2)
    ctx.lineTo(markOriginX + markSize/3, markOriginY + markSize)
    ctx.lineTo(markOriginX + markSize, markOriginY - markSize/4)
    ctx.stroke()
    
    // Draw Ghost Score Text
    ctx.font = 'bold 20px Arial'
    ctx.fillStyle = isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.6)'
    ctx.fillText(`+${q.maxPoints}`, markOriginX + markSize + 8, markOriginY + markSize - 2)
    
    // Drag Handle Hint
    if (isSelected) {
      ctx.font = '10px Arial'
      ctx.fillStyle = '#ef4444'
      ctx.fillText('拖动调整位置', scoreX, scoreY - 6)
    }
    
    ctx.restore()
  })
}

// Draw initial state on mount
onMounted(() => {
  nextTick(refreshPreview)
  
  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Only if in setup tab and something is selected
    if (activeTab.value === 'setup' && selectedQuestionId.value) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent backspace from navigating back if focused on body
        if (document.activeElement === document.body) {
           e.preventDefault()
           const idx = assignmentConfig.value.findIndex(q => q.id === selectedQuestionId.value)
           if (idx !== -1) {
             removeQuestion(idx)
             selectedQuestionId.value = null
             drawSetupPreview()
           }
        }
      }
    }
  })
})

// Data Store
const classPapers = ref<StudentPaper[]>([])
const selectedPaperId = ref<string | null>(null)
const selectedPaper = computed(() => classPapers.value.find(p => p.id === selectedPaperId.value))

const fileInput = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// --- Logic: Navigation ---
function navigateTo(tab: typeof activeTab.value) {
  activeTab.value = tab
}

function returnToPortal() {
  if (router) {
    router.push('/')
  } else {
    window.location.href = '/'
  }
}

// --- Logic: Configuration ---
function addQuestion() {
  const last = assignmentConfig.value[assignmentConfig.value.length - 1]
  const newId = `q${assignmentConfig.value.length + 1}`
  const newY = last ? last.y + last.h + 20 : 100
  assignmentConfig.value.push({
    id: newId,
    label: `第${assignmentConfig.value.length + 1}题`,
    type: 'subjective',
    x: 50, y: newY, w: 600, h: 100,
    page: currentPreviewPage.value,
    correctAnswer: '', maxPoints: 5
  })
}

function removeQuestion(index: number) {
  assignmentConfig.value.splice(index, 1)
}

function addEmptyQuestion() {
  const nextNum = assignmentConfig.value.length + 1
  const newQ: QuestionRegion = {
    id: crypto.randomUUID(),
    label: `第${nextNum}题`,
    type: 'subjective',
    x: 0, y: 0, w: 0, h: 0, // Invalid coords
    page: currentPreviewPage.value,
    correctAnswer: '',
    maxPoints: 5
  }
  assignmentConfig.value.push(newQ)
  selectedQuestionId.value = newQ.id // Select it so user can set properties
  configJson.value = JSON.stringify(assignmentConfig.value, null, 2)
}

// --- Logic: File Processing ---
function onFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) handleFile(files[0])
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) handleFile(files[0])
}

async function handleFile(file: File) {
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
    alert('仅支持 PDF 或图片文件')
    return
  }
  
  processingStatus.value = '正在解析文件...'
  classPapers.value = []
  activeTab.value = 'list'
  
  if (file.type === 'application/pdf') {
    await processPDF(file)
  } else {
    // Image flow
    const reader = new FileReader()
    reader.onload = async (e) => {
      await processSinglePage(e.target?.result as string, 1)
      processingStatus.value = '处理完成'
    }
    reader.readAsDataURL(file)
  }
}

// --- Logic: File Processing ---
// Session state for multi-page combining
let currentSessionPaper: StudentPaper | null = null
let currentSessionAnchor: { scaleX: number, scaleY: number, offsetX: number, offsetY: number } | null = null

async function processPDF(file: File) {
  try {
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument(buffer).promise
    processingTotal.value = pdf.numPages
    
    // Reset session
    currentSessionPaper = null
    currentSessionAnchor = null
    
    for (let i = 1; i <= pdf.numPages; i++) {
      processingStatus.value = `正在处理第 ${i} / ${pdf.numPages} 页...`
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport } as any).promise
        // We pass 'i' as the absolute page index in the PDF
        // But for grading config, we need to know: is this Page 1 or Page 2 of the TEMPLATE?
        // Assumption: The student PDF follows the same page structure as the Template PDF.
        // e.g. Student PDF Page 1 = Template Page 1
        //      Student PDF Page 2 = Template Page 2
        //      Student PDF Page 3 = Template Page 1 (Next student)
        
        // This dynamic mapping is tricky. 
        // For now, let's implement the "QR Code Reset" logic inside processSinglePage.
        await processSinglePage(canvas.toDataURL('image/jpeg', 0.8), i)
      }
      processingProgress.value = i
    }
    processingStatus.value = '全班阅卷完成'
  } catch (e: any) {
    alert('PDF 解析失败: ' + e.message)
    activeTab.value = 'upload'
  }
}

async function processSinglePage(dataUrl: string, globalPageIndex: number) {
  const img = new Image()
  img.src = dataUrl
  await new Promise(r => img.onload = r)
  
  // 1. Scan QR to detect Student Identity (Start of a new paper)
  let detectedInfo: { name: string, id: string } | null = null
  let studentAnchor: { x: number, y: number, w: number, h: number } | null = null
  
  try {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(img, 0, 0)
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
    if (imageData) {
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        // Extract content
        try {
          const parsed = JSON.parse(code.data)
          detectedInfo = { name: parsed.name, id: parsed.id }
        } catch {
          detectedInfo = { name: '未知', id: code.data }
        }
        
        // Extract Geometry for Anchor
        const loc = code.location
        const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x)
        const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x)
        const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y)
        const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y)
        
        studentAnchor = {
           x: minX,
           y: minY,
           w: maxX - minX,
           h: maxY - minY
        }
        
        // Calculate Transform for Session
        if (templateAnchor.value) {
           const ta = templateAnchor.value
           const sa = studentAnchor
           const scaleX = sa.w / ta.w
           const scaleY = sa.h / ta.h
           const offsetX = sa.x - (ta.x * scaleX)
           const offsetY = sa.y - (ta.y * scaleY)
           
           currentSessionAnchor = { scaleX, scaleY, offsetX, offsetY }
           console.log(`[Session Anchor] Updated from P${globalPageIndex}:`, currentSessionAnchor)
        }
      }
    }
  } catch (e) { console.error(e) }

  // 2. Logic: New Student vs Continuation
  let paper: StudentPaper
  let templatePageIndex = 1 // Which page of the config should we apply?

  if (detectedInfo) {
     // QR Found -> This is Page 1 of a New Student
     paper = {
        id: crypto.randomUUID(),
        pageIndex: globalPageIndex, // Just for log
        studentName: detectedInfo.name || '未知学生',
        studentId: detectedInfo.id,
        status: 'processing',
        score: 0,
        image: dataUrl, // Main image (Page 1)
        pages: [{ pageIndex: 1, image: dataUrl }], // Init pages
        results: [],
        errorMsg: undefined
     }
     classPapers.value.push(paper)
     currentSessionPaper = paper
     templatePageIndex = 1
  } else {
     // No QR -> Continuation of current session
     if (currentSessionPaper) {
        paper = currentSessionPaper
        // Assume sequential page
        templatePageIndex = (paper.pages.length || 1) + 1
        
        // Add this page to the session
        paper.pages.push({ pageIndex: templatePageIndex, image: dataUrl })
        
     } else {
        // Orphaned Page (No previous QR)
        paper = {
           id: crypto.randomUUID(),
           pageIndex: globalPageIndex,
           studentName: '无名氏',
           studentId: `Unknown-${globalPageIndex}`,
           status: 'error',
           score: 0,
           image: dataUrl,
           pages: [{ pageIndex: 1, image: dataUrl }],
           results: [],
           errorMsg: '首页未检测到二维码'
        }
        classPapers.value.push(paper)
        currentSessionPaper = paper // Start a session anyway to catch subsequent pages
        templatePageIndex = 1 // Treat as P1
     }
  }
  
  if (paper.status !== 'error') {
    console.log(`[Process] Grading paper ${paper.id} (Student: ${paper.studentName}) using Template Page ${templatePageIndex}`)
    await gradePaper(paper, img, templatePageIndex, studentAnchor)
  }
}

async function gradePaper(
  paper: StudentPaper, 
  img: HTMLImageElement, 
  pageIndex: number, 
  studentAnchor: { x: number, y: number, w: number, h: number } | null
) {
  // Filter config for THIS page
  const pageQuestions = assignmentConfig.value.filter(q => (q.page || 1) === pageIndex)
  if (pageQuestions.length === 0) return

  // --- Calculate Transform Matrix ---
  let scaleX = 1
  let scaleY = 1
  let offsetX = 0
  let offsetY = 0
  
  if (studentAnchor && templateAnchor.value) {
     const ta = templateAnchor.value
     const sa = studentAnchor
     scaleX = sa.w / ta.w
     scaleY = sa.h / ta.h
     offsetX = sa.x - (ta.x * scaleX)
     offsetY = sa.y - (ta.y * scaleY)
  } else if (currentSessionAnchor) {
     scaleX = currentSessionAnchor.scaleX
     scaleY = currentSessionAnchor.scaleY
     offsetX = currentSessionAnchor.offsetX
     offsetY = currentSessionAnchor.offsetY
  }

  // Parallel Processing with Concurrency Limit
  const CONCURRENCY = 3
  let completed = 0

  const choiceQs = pageQuestions.filter((q) => q.type === 'single_choice' || q.type === 'multiple_choice')
  const tfQs = pageQuestions.filter((q) => q.type === 'true_false')
  const fillQs = pageQuestions.filter((q) => q.type === 'fill_in_blank')
  const subjectiveQs = pageQuestions.filter((q) => q.type === 'subjective')

  // Batch objective questions to avoid per-question API rate limiting.
  const MAX_BATCH_ITEMS = 12
  const runObjectiveBatch = async (
    group: QuestionRegion[],
    label: 'choice' | 'true_false' | 'fill'
  ) => {
    for (let i = 0; i < group.length; i += MAX_BATCH_ITEMS) {
      const chunk = group.slice(i, i + MAX_BATCH_ITEMS)
      const batch = await batchGradeObjectiveQuestions(paper, chunk, img, scaleX, scaleY, offsetX, offsetY, label)
      for (const r of batch) {
        paper.results.push(r)
        paper.score += r.score
      }
      completed += chunk.length
      processingStatus.value = `正在批改 P${pageIndex}... (${Math.min(completed, pageQuestions.length)}/${pageQuestions.length})`
    }
  }

  await runObjectiveBatch(choiceQs, 'choice')
  await runObjectiveBatch(tfQs, 'true_false')
  await runObjectiveBatch(fillQs, 'fill')
  
  // Helper to process a single question
  const processQuestion = async (config: QuestionRegion) => {
    // Apply Transform
    const finalX = (config.x * scaleX) + offsetX
    const finalY = (config.y * scaleY) + offsetY
    const finalW = config.w * scaleX
    const finalH = config.h * scaleY
    
    // 1. Crop Image (Client-side)
    const canvas = document.createElement('canvas')
    canvas.width = finalW
    canvas.height = finalH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH)
    const cropBase64 = canvas.toDataURL('image/jpeg', 0.85)
    const base64Content = cropBase64.split(',')[1]

    let score = 0
    let studentAnswer = ''
    let feedback = ''

    try {
        // 2. OCR (Call BFF)
        // Try OCR first. If it fails, we will catch it and try to proceed with AI Grading (VLM) directly.
        let ocrText = ''
        
        try {
            const uploadRes = await axios.post('/api/ocr/upload', {
                fileName: `q_${config.id}_p${paper.studentId}.jpg`,
                contentBase64: base64Content,
                scene: 'lens' 
            }, { headers: { Authorization: `Bearer ${token.value}` } })
            
            const taskId = uploadRes.data.taskId
            
            // Poll for OCR
            let attempts = 0
            while (attempts < 15) {
                await new Promise(r => setTimeout(r, 600))
                const statusRes = await axios.get(`/api/ocr/status/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } })
                if (statusRes.data.status === 'done') {
                    const resRes = await axios.get(`/api/ocr/result/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } })
                    ocrText = (resRes.data.result || '').trim()
                    break
                }
                attempts++
            }
            studentAnswer = ocrText
        } catch (ocrErr: any) {
            console.warn('OCR Failed, attempting VLM fallback:', ocrErr.message)
            // Do not throw, continue to grading step
        }

        // 3. AI Grade (VLM or Text LLM)
        const gradeRes = await axios.post('/api/grading/grade-image', {
            imageBase64: base64Content,
            questionText: config.label + (config.gradingCriteria ? ` (评分标准: ${config.gradingCriteria})` : ''),
            correctAnswer: config.correctAnswer,
            maxPoints: config.maxPoints,
            ocrText: ocrText
        }, { headers: { Authorization: `Bearer ${token.value}` } })
        
        score = gradeRes.data.score
        feedback = gradeRes.data.feedback
        if (gradeRes.data.studentAnswer && gradeRes.data.studentAnswer.length > ocrText.length) {
            studentAnswer = gradeRes.data.studentAnswer
        }

    } catch (err: any) {
        console.error('Grading Error:', err)
        feedback = '批改失败: ' + err.message
    }

    completed++
    processingStatus.value = `正在批改 P${pageIndex}... (${completed}/${pageQuestions.length})`

    return {
      questionId: config.label,
      studentAnswer,
      score,
      feedback,
      x: finalX,
      y: finalY,
      w: finalW,
      h: finalH,
      score_x: config.score_x ? (config.score_x * scaleX + offsetX) : undefined,
      score_y: config.score_y ? (config.score_y * scaleY + offsetY) : undefined
    }
  }

  // Execute subjective questions with concurrency limit
  const queue = [...subjectiveQs]
  const running: Promise<void>[] = []
  
  while (queue.length > 0 || running.length > 0) {
     while (queue.length > 0 && running.length < CONCURRENCY) {
        const config = queue.shift()!
        const p = processQuestion(config).then(res => {
           if (res) {
             paper.results.push(res)
             paper.score += res.score
           }
           running.splice(running.indexOf(p), 1)
        })
        running.push(p)
     }
     if (running.length > 0) {
        await Promise.race(running)
     }
  }
  
  paper.status = 'done'
}

// --- Debug Logic: Coordinate Mapping Test ---
const showDebugOverlay = ref(false)
const debugOcrResult = ref<OcrPageResult | null>(null)
const debugMappings = ref<{ questionId: string, segments: BBox[] }[]>([])

// Generate random mock OCR data scattered across the page
function generateMockOcrData(width: number, height: number): OcrPageResult {
  const spans = []
  const questionCount = assignmentConfig.value.length
  
  // 1. Generate some "Correct" hits inside ROIs
  assignmentConfig.value.forEach(q => {
    if ((q.page || 1) !== currentPreviewPage.value) return
    
    // Simulate 1-3 text segments inside each question box
    const segCount = 1 + Math.floor(Math.random() * 3)
    const segHeight = 20
    const segWidth = Math.min(100, q.w - 10)
    
    for(let i=0; i<segCount; i++) {
      const x = q.x + 10 + (Math.random() * (q.w - segWidth - 20))
      const y = q.y + 10 + (i * (segHeight + 5))
      
      spans.push({
        id: `mock_${q.id}_${i}`,
        content: `Mock Answer ${i}`,
        bbox: [x, y, segWidth, segHeight] as [number, number, number, number],
        type: 'handwriting' as const
      })
    }
  })
  
  // 2. Generate some "Noise" outside
  for(let i=0; i<5; i++) {
    const w = 50 + Math.random() * 100
    const h = 20
    const x = Math.random() * (width - w)
    const y = Math.random() * (height - h)
    spans.push({
      id: `noise_${i}`,
      content: `Noise ${i}`,
      bbox: [x, y, w, h] as [number, number, number, number],
      type: 'text' as const
    })
  }
  
  return { width, height, spans }
}

function runMappingDebug() {
  if (!templateSize.value) return
  
  // 1. Create Mock Data
  const mockData = generateMockOcrData(templateSize.value.width, templateSize.value.height)
  debugOcrResult.value = mockData
  
  // 2. Run Mapping Algorithm
  // Convert assignmentConfig to compatible QuestionRoi
  const rois: QuestionRoi[] = assignmentConfig.value.map(q => ({
    id: q.id,
    label: q.label,
    x: q.x, y: q.y, w: q.w, h: q.h
  }))
  
  const results = mapTextToQuestions(mockData, rois)
  
  // 3. Store results for visualization
  debugMappings.value = results.map(r => ({
    questionId: r.questionId,
    segments: r.segments.map(s => ({ 
      x: s.bbox[0], y: s.bbox[1], w: s.bbox[2], h: s.bbox[3] 
    }))
  }))
  
  showDebugOverlay.value = true
  
  // Trigger redraw
  drawSetupPreview()
}

function toggleDebugMode() {
  if (showDebugOverlay.value) {
    showDebugOverlay.value = false
    debugOcrResult.value = null
    debugMappings.value = []
    drawSetupPreview()
  } else {
    runMappingDebug()
  }
}

// Enhance drawSetupPreview to draw debug info
const originalDrawSetupPreview = drawSetupPreview // Keep reference if needed, but we will modify the function body directly below


async function savePaperToBackend(paper: StudentPaper) {
  if (!token.value) {
    alert('请先登录后再保存到后端')
    return
  }
  if (!backendAssignmentId.value) {
    alert('请先在「作业配置」中创建/填写后端作业 ID')
    return
  }
  if (paper.backendSubmissionId) return
  if (!paper.image) {
    alert('当前试卷缺少图像内容，无法保存')
    return
  }

  paper.saving = true
  paper.saveError = undefined

  try {
    const assetTitle = `${backendAssignmentName.value || '阅卷作业'}-${paper.studentId}-P${paper.pageIndex}`
    const asset = await apiJson<any>('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        title: assetTitle,
        type: 'image',
        contentUrl: paper.image,
        visibility: 'PRIVATE',
        tags: ['quiz-grading', 'paper']
      })
    })

    const configByLabel = new Map(assignmentConfig.value.map((q) => [q.label, q]))
    let objectiveScore = 0
    let subjectiveScore = 0
    for (const r of paper.results) {
      const cfg = configByLabel.get(r.questionId)
      if (cfg?.type === 'subjective') subjectiveScore += r.score
      else objectiveScore += r.score
    }
    const totalScore = objectiveScore + subjectiveScore

    const details = {
      version: 1,
      pageIndex: paper.pageIndex,
      studentId: paper.studentId,
      studentName: paper.studentName,
      payloadAssetId: asset.id,
      objectiveScoringSettings: objectiveScoringSettings.value,
      results: paper.results,
      objectiveScore,
      subjectiveScore,
      totalScore
    }

    const submission = await apiJson<any>('/api/grading/submissions', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: backendAssignmentId.value,
        studentId: paper.studentId,
        payloadUrl: `asset:${asset.id}`,
        grading: {
          objectiveScore,
          subjectiveScore,
          totalScore,
          details,
          publishToScores: true
        }
      })
    })

    paper.backendSubmissionId = submission.id
    paper.payloadAssetId = asset.id
  } catch (e: any) {
    paper.saveError = e.message || '保存失败'
    alert(paper.saveError)
  } finally {
    paper.saving = false
  }
}

async function saveAllToBackend() {
  if (backendSavingAll.value) return
  backendSavingAll.value = true
  try {
    const targets = classPapers.value.filter((p) => p.status === 'done' && !p.backendSubmissionId)
    for (const p of targets) {
      await savePaperToBackend(p)
    }
    if (targets.length > 0) {
      alert(`已保存 ${targets.length} 份到后端`)
    }
  } finally {
    backendSavingAll.value = false
  }
}

async function loadSubmissionsFromBackend() {
  if (!token.value) {
    alert('请先登录后再从后端加载')
    return
  }
  if (!backendAssignmentId.value) {
    alert('请先在「作业配置」中创建/填写后端作业 ID')
    return
  }
  backendLoadingSubmissions.value = true
  try {
    const items = await apiJson<any[]>(
      `/api/grading/submissions?assignmentId=${encodeURIComponent(backendAssignmentId.value)}`
    )

    classPapers.value = items.map((s, idx) => {
      const details = safeJsonParse(s?.grading?.details)
      const payloadUrl = String(s?.payloadUrl ?? '')
      const payloadAssetId = payloadUrl.startsWith('asset:') ? payloadUrl.slice('asset:'.length) : undefined
      const status = String(s?.status ?? '').toUpperCase()
      const normalizedStatus: StudentPaper['status'] =
        status === 'DONE' ? 'done' : status === 'PROCESSING' ? 'processing' : status === 'ERROR' ? 'error' : 'pending'

      return {
        id: s.id,
        pageIndex: Number(details?.pageIndex ?? idx + 1),
        studentName: s?.student?.name || details?.studentName || '',
        studentId: s?.student?.studentId || details?.studentId || '',
        status: normalizedStatus,
        score: Number(s?.totalScore ?? details?.totalScore ?? 0),
        image: '',
        pages: [{ pageIndex: 1, image: '' }],
        results: Array.isArray(details?.results) ? details.results : [],
        errorMsg: undefined,
        backendSubmissionId: s.id,
        payloadAssetId
      }
    })

    activeTab.value = 'list'
    processingStatus.value = `已从后端加载 ${classPapers.value.length} 份提交`
  } catch (e: any) {
    alert(e.message || '从后端加载失败')
  } finally {
    backendLoadingSubmissions.value = false
  }
}

async function loadImageFromAsset(assetId: string): Promise<string> {
  const asset = await apiJson<any>(`/api/assets/${assetId}`)
  const candidate = (asset?.contentUrl || asset?.content) as string | undefined
  if (candidate && typeof candidate === 'string') {
    const url = candidate.trim()
    if (url.startsWith('data:')) return url
    const res = await fetch(url, { headers: url.startsWith('/') ? authHeaders() : undefined })
    if (!res.ok) throw new Error(`下载资源失败 (${res.status})`)
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }
  throw new Error('资源不包含可用的 contentUrl/content')
}

// --- Logic: Details View ---
const currentDetailPage = ref(1)

async function viewPaper(paper: StudentPaper) {
  selectedPaperId.value = paper.id
  activeTab.value = 'detail'
  currentDetailPage.value = 1 // Reset to page 1
  if (!paper.pages || paper.pages.length === 0) {
    paper.pages = [{ pageIndex: 1, image: paper.image || '' }]
  }
  if (!paper.image && paper.payloadAssetId) {
    try {
      const url = await loadImageFromAsset(paper.payloadAssetId)
      paper.image = url
      if (paper.pages.length === 0) paper.pages = [{ pageIndex: 1, image: url }]
      else paper.pages[0].image = paper.pages[0].image || url
    } catch (e) {
      // Ignore; user can still view metadata/results.
    }
  }
  refreshDetailView()
}

function refreshDetailView() {
  const paper = selectedPaper.value
  if (!paper) return
  
  nextTick(() => {
    if (canvasRef.value) {
      const ctx = canvasRef.value.getContext('2d')
      
      // Find image for current page
      const pageData = paper.pages.find(p => p.pageIndex === currentDetailPage.value)
      // Fallback to cover if not found (should not happen if logic is correct)
      const imgSrc = pageData ? pageData.image : paper.image
      
      const img = new Image()
      img.onload = () => {
        if (!ctx) return
        canvasRef.value!.width = img.width
        canvasRef.value!.height = img.height
        ctx.drawImage(img, 0, 0)
        
        // Draw overlays for THIS page only
        ctx.font = 'bold 24px Arial'
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'

        // Filter results that belong to this template page
        // We need to map result -> question -> page
        // But 'GradingResult' doesn't store pageIndex directly.
        // It stores 'questionId' (which is the label).
        // We can look up the question in 'assignmentConfig'.
        
        // Wait, 'assignmentConfig' might have changed since grading. 
        // Ideally 'GradingResult' should store 'pageIndex'.
        // But for now, let's lookup.
        
        const configMap = new Map(assignmentConfig.value.map(q => [q.label, q]))

        paper.results.forEach(r => {
          const qConfig = configMap.get(r.questionId)
          if (!qConfig) return
          // Check if this question belongs to current detail page
          if ((qConfig.page || 1) !== currentDetailPage.value) return
          
          const isCorrect = r.score > 0 
          const color = isCorrect ? '#10b981' : '#ef4444' 

          ctx.strokeStyle = color
          ctx.fillStyle = color
          ctx.lineWidth = 3
          
          // Draw Box around Answer
          ctx.strokeRect(r.x, r.y, r.w, r.h)
          
          // --- Draw Mark & Score ---
          const markOriginX = r.score_x !== undefined ? r.score_x : (r.x + r.w - 50)
          const markOriginY = r.score_y !== undefined ? r.score_y : (r.y + 10)
          
          // 1. Draw Tick / Cross
          const markSize = 24
          ctx.beginPath()
          if (isCorrect) {
            // Checkmark (√)
            ctx.moveTo(markOriginX, markOriginY + markSize/2)
            ctx.lineTo(markOriginX + markSize/3, markOriginY + markSize)
            ctx.lineTo(markOriginX + markSize, markOriginY - markSize/4)
          } else {
            // Cross (×)
            ctx.moveTo(markOriginX, markOriginY)
            ctx.lineTo(markOriginX + markSize, markOriginY + markSize)
            ctx.moveTo(markOriginX + markSize, markOriginY)
            ctx.lineTo(markOriginX, markOriginY + markSize)
          }
          ctx.stroke()
          
          // 2. Draw Score Number
          ctx.font = 'bold 24px Arial'
          const scoreText = `${r.score > 0 ? '+' : ''}${r.score}`
          
          ctx.fillStyle = color
          ctx.fillText(scoreText, markOriginX + markSize + 8, markOriginY + markSize - 2)
        })
      }
      img.src = imgSrc
    }
  })
}

// --- Logic: Demo ---
async function loadDemo() {
  activeTab.value = 'list'
  processingStatus.value = '加载演示数据...'
  classPapers.value = []
  
  const demoData = [
    { name: '张三', id: 'S001', score: 95 },
    { name: '李四', id: 'S002', score: 88 },
    { name: '王五', id: 'S003', score: 60 },
    { name: '赵六', id: 'S004', score: 0, error: '缺考/空白卷' },
  ]
  
  for (let i = 0; i < demoData.length; i++) {
    await new Promise(r => setTimeout(r, 500))
    const d = demoData[i]
    classPapers.value.push({
      id: String(i),
      pageIndex: i + 1,
      studentName: d.name,
      studentId: d.id,
      status: d.error ? 'error' : 'done',
      score: d.score,
      image: '', // No image in demo
      pages: [{ pageIndex: 1, image: '' }],
      results: [],
      errorMsg: d.error
    })
  }
  processingStatus.value = '演示完成'
}

function exportData() {
  const data = classPapers.value.map(p => {
    const row: any = {
      '姓名': p.studentName,
      '学号': p.studentId,
      '总分': p.score,
      '状态': p.status === 'done' ? '完成' : (p.status === 'error' ? '异常' : '处理中'),
    }
    
    // Add per-question details
    p.results.forEach(r => {
      row[`${r.questionId} 得分`] = r.score
      row[`${r.questionId} 学生作答(OCR)`] = r.studentAnswer
      row[`${r.questionId} 评语`] = r.feedback
    })
    
    return row
  })
  
  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`
  
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '成绩单')
  XLSX.writeFile(wb, `class_grades_${timestamp}.xlsx`)
}
</script>

<template>
  <div class="h-[100dvh] w-full bg-slate-50 flex flex-col font-sans overflow-hidden text-slate-800">
    <!-- 1. Header (Fixed Height) -->
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm relative">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <Icon icon="mdi:camera-metering-center" width="20" />
        </div>
        <div>
          <h1 class="font-bold text-slate-800 leading-tight">智能阅卷系统</h1>
          <p class="text-xs text-slate-500">Smart Grading & Batch Processing</p>
        </div>
      </div>
      <button @click="returnToPortal" class="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
        <Icon icon="mdi:logout" /> 退出
      </button>
    </header>

    <!-- 2. Main Body (Flex) -->
    <div class="flex-1 flex overflow-hidden relative z-0">
      
      <!-- 2.1 Sidebar -->
      <aside class="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 overflow-y-auto">
        <nav class="p-4 space-y-1">
          <button 
            v-for="tab in ['setup', 'upload', 'list']" 
            :key="tab"
            @click="navigateTo(tab as any)"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
            :class="activeTab === tab || (tab === 'list' && activeTab === 'detail') 
              ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' 
              : 'text-slate-600 hover:bg-slate-50'"
          >
            <Icon :icon="tab === 'setup' ? 'mdi:cog-box' : tab === 'upload' ? 'mdi:cloud-upload' : 'mdi:format-list-bulleted'" width="18" />
            <span>{{ tab === 'setup' ? '1. 作业配置' : tab === 'upload' ? '2. 试卷上传' : '3. 阅卷结果' }}</span>
          </button>
        </nav>
        
        <div class="mt-auto p-4 border-t border-slate-100">
          <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            <div class="flex justify-between mb-1">
              <span>处理进度</span>
              <span>{{ processingProgress }}/{{ processingTotal || '-' }}</span>
            </div>
            <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 transition-all duration-300" :style="{ width: processingTotal ? (processingProgress / processingTotal)*100 + '%' : '0%' }"></div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 2.2 Content Area -->
      <main class="flex-1 bg-[#F8FAFC] flex flex-col min-w-0 overflow-hidden relative z-10">
        
        <!-- View: Setup -->
        <div v-if="activeTab === 'setup'" class="flex flex-col h-full p-4 gap-4 animate-fade-in overflow-hidden">
          
          <!-- Assignment Bar (Top Control) -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between shrink-0">
             <!-- Left: Basic Info -->
             <div class="flex items-center gap-4 flex-1">
                <div class="flex flex-col relative group">
                   <label class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">作业名称</label>
	                   <input 
	                      v-model="backendAssignmentName" 
	                      type="text" 
	                      list="name-history"
	                      @change="recordBackendAssignmentNameHistory"
	                      class="text-sm font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors w-48" 
	                      placeholder="未命名作业" 
	                   />
                   <datalist id="name-history">
                      <option v-for="n in backendAssignmentNameHistory" :key="n" :value="n"></option>
                   </datalist>
                </div>
                <div class="w-px h-8 bg-slate-100"></div>
                <div class="flex flex-col">
                   <label class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">科目</label>
                   <input 
                      v-model="backendAssignmentSubject" 
                      type="text" 
                      list="subject-list"
                      class="text-sm font-medium text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors w-24" 
                      placeholder="科目" 
                   />
                   <datalist id="subject-list">
                      <option v-for="s in commonSubjects" :key="s" :value="s"></option>
                   </datalist>
                </div>
                <div class="w-px h-8 bg-slate-100"></div>
                
                <!-- Cloud Status -->
                <div class="flex items-center gap-2">
                   <div class="flex flex-col">
                      <label class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">模式</label>
                      <div class="flex items-center gap-1.5">
                         <span class="w-2 h-2 rounded-full" :class="backendAssignmentId ? 'bg-green-500 shadow-green-500/50 shadow-sm' : 'bg-slate-300'"></span>
                         <span class="text-xs font-bold" :class="backendAssignmentId ? 'text-green-600' : 'text-slate-500'">
                            {{ backendAssignmentId ? '云端同步' : '本地模式' }}
                         </span>
                      </div>
                   </div>
                   
                   <!-- ID Input (Hidden/Revealed) -->
                   <input 
                      v-if="backendAssignmentId" 
                      v-model="backendAssignmentId" 
                      type="text" 
                      class="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-32 focus:w-48 transition-all outline-none" 
                      placeholder="Backend ID" 
                   />
                </div>
             </div>

             <!-- Right: Actions -->
             <div class="flex items-center gap-2">
                <!-- Local Actions -->
                <button @click="exportJsonConfig" class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all">
                   <Icon icon="mdi:download-outline" /> 导出配置
                </button>
                <label class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all cursor-pointer">
                   <Icon icon="mdi:upload-outline" /> 导入配置
                   <input type="file" class="hidden" accept=".json" @change="importJsonConfig" />
                </label>
                
                <div class="w-px h-6 bg-slate-200 mx-1"></div>

                <!-- Cloud Actions -->
                <template v-if="!backendAssignmentId">
                   <button @click="createBackendAssignment" class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all" :disabled="backendBusy">
                      <Icon v-if="backendBusy" icon="mdi:loading" class="animate-spin" />
                      <Icon v-else icon="mdi:cloud-upload-outline" />
                      创建云端作业
                   </button>
                </template>
                <template v-else>
                   <button @click="syncAnswerKeysToBackend" class="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-md shadow-green-500/20 transition-all" :disabled="backendBusy">
                      <Icon v-if="backendBusy" icon="mdi:loading" class="animate-spin" />
                      <Icon v-else icon="mdi:sync" />
                      同步答案
                   </button>
                </template>
             </div>
          </div>
          
          <!-- Old Header (Removed/Simplified) -->

                    <!-- Objective Scoring Settings (Removed) -->
          
          <div class="flex-1 flex gap-6 min-h-0">
            <!-- Question List & Properties (Left) -->
            <div class="w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
               <!-- Header -->
	               <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
	                  <h3 class="font-bold text-slate-700">题目列表</h3>
	                  <div class="flex items-center gap-2">
	                     <button @click="addEmptyQuestion" class="p-1 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded shadow-sm transition-all" title="添加空题目">
	                        <Icon icon="mdi:plus" />
	                     </button>
	                  </div>
	               </div>
	               
	               <!-- List -->
	               <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                  <div 
                    v-for="(q, idx) in assignmentConfig" 
                    :key="q.id"
                    class="p-3 rounded-xl border transition-all cursor-pointer group relative"
                    :class="selectedQuestionId === q.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:border-blue-200'"
                    @click="selectedQuestionId = q.id; drawSetupPreview()"
                  >
                     <div class="flex justify-between items-start">
                        <span class="font-bold text-sm" :class="selectedQuestionId === q.id ? 'text-blue-700' : 'text-slate-700'">{{ q.label }}</span>
                        <span v-if="q.w > 0" class="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">P{{ q.page || 1 }}</span>
                        <span v-else class="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold animate-pulse">待画框</span>
                     </div>
                     <div class="text-xs text-slate-400 mt-1 flex gap-3 items-center">
                        <span v-if="q.w > 0">{{ q.maxPoints }} 分</span>
                        <button v-else @click.stop="startMapping(q.id)" class="px-2 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 font-bold transition-colors">📍 点击画框</button>
                        
                        <span class="truncate max-w-[120px]" title="参考答案" v-if="q.w > 0">Ref: {{ q.correctAnswer || '-' }}</span>
                     </div>
                     
                     <button 
                        @click.stop="removeQuestion(idx)"
                        class="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="删除"
                     >
                        <Icon icon="mdi:trash-can-outline" width="16" />
                     </button>
                  </div>
                  
                  <div v-if="assignmentConfig.length === 0" class="text-center py-8 text-slate-400 text-sm">
                     <p>暂无题目</p>
                     <p class="text-xs mt-1">在右侧预览图上框选以添加</p>
                  </div>
               </div>
               
               <!-- Property Editor (Bottom Panel if Selected) -->
               <div v-if="activeQuestion" class="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-3 animate-slide-up">
                  <div class="flex items-center justify-between">
                     <span class="text-xs font-bold text-slate-500 uppercase">编辑属性</span>
                     <button @click="selectedQuestionId = null; drawSetupPreview()" class="text-xs text-slate-400 hover:text-slate-600">关闭</button>
                  </div>
                                    <div class="grid grid-cols-2 gap-3">
                                       <div>
                                          <label class="block text-[10px] font-bold text-slate-400 mb-1">名称</label>
                                          <input v-model="activeQuestion.label" type="text" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" />
                                       </div>
                                       <div>
                                          <label class="block text-[10px] font-bold text-slate-400 mb-1">分值</label>
                                          <input v-model.number="activeQuestion.maxPoints" type="number" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" />
                                       </div>
                                    </div>
                                    
                                    <!-- Type Selector -->
                                    <div>
                                       <label class="block text-[10px] font-bold text-slate-400 mb-1">题型</label>
                                       <select v-model="activeQuestion.type" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none">
                                          <option value="single_choice">单选题 (Single Choice)</option>
                                          <option value="multiple_choice">多选题 (Multiple Choice)</option>
                                          <option value="true_false">判断题 (True/False)</option>
                                          <option value="fill_in_blank">填空题 (Fill in Blank)</option>
                                          <option value="subjective">主观题 (Subjective/AI)</option>
                                       </select>
                                    </div>
                  
                                    <!-- Dynamic Answer Input -->
                                    <div>
                                       <label class="block text-[10px] font-bold text-slate-400 mb-1">参考答案</label>
                                       
                                       <!-- Single Choice -->
                                       <div v-if="activeQuestion.type === 'single_choice'" class="flex gap-2">
                                          <button 
                                             v-for="opt in ['A','B','C','D']" 
                                             :key="opt"
                                             @click="activeQuestion!.correctAnswer = opt"
                                             class="w-8 h-8 rounded-lg text-xs font-bold transition-all border"
                                             :class="activeQuestion.correctAnswer === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'"
                                          >{{ opt }}</button>
                                       </div>
                  
                                       <!-- True/False -->
                                       <div v-else-if="activeQuestion.type === 'true_false'" class="flex gap-2">
                                          <button @click="activeQuestion!.correctAnswer = 'T'" class="flex-1 py-1.5 rounded border text-xs font-bold" :class="activeQuestion.correctAnswer === 'T' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 border-slate-200'">正确 (T)</button>
                                          <button @click="activeQuestion!.correctAnswer = 'F'" class="flex-1 py-1.5 rounded border text-xs font-bold" :class="activeQuestion.correctAnswer === 'F' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 border-slate-200'">错误 (F)</button>
                                       </div>
                  
                                       <!-- Default Text Input (Fill/Subjective/Multiple) -->
                                       <input v-else v-model="activeQuestion.correctAnswer" type="text" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" :placeholder="activeQuestion.type === 'multiple_choice' ? '如: ACD' : '输入答案...'" />
                                    </div>
                  
                                    <!-- AI Grading Config (Only for Subjective) -->
                                    <div v-if="activeQuestion.type === 'subjective'" class="pt-2 border-t border-slate-200/50">                     <div class="flex items-center justify-between mb-1">
                        <label class="block text-[10px] font-bold text-slate-400">AI 评分标准 (Prompt)</label>
                        <Icon icon="mdi:robot-excited-outline" class="text-purple-500" width="14" />
                     </div>
                     <textarea 
                        v-model="activeQuestion.gradingCriteria" 
                        rows="3" 
                        class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-purple-500 outline-none resize-none"
                        placeholder="例如：答出'能量守恒'得2分；公式写对得3分..."
                     ></textarea>
                     
                     <button 
                        @click="simulateAIGrading"
                        class="mt-2 w-full py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded text-xs font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all flex items-center justify-center gap-1"
                        :disabled="isSimulating"
                     >
                        <Icon v-if="isSimulating" icon="mdi:loading" class="animate-spin" />
                        <Icon v-else icon="mdi:play-circle-outline" />
                        {{ isSimulating ? 'AI 分析中...' : '模拟 AI 批改' }}
                     </button>
                     
                     <!-- Simulation Result -->
                     <div v-if="simulationResult" class="mt-2 p-2 bg-purple-50 border border-purple-100 rounded text-[10px] text-purple-800 animate-fade-in">
                        <strong>模拟结果:</strong> {{ simulationResult }}
                     </div>
                  </div>
               </div>
            </div>

            <!-- Preview (Right) -->
            <div class="flex-1 bg-slate-200 rounded-2xl border border-slate-300 flex flex-col relative overflow-hidden shrink-0">
              <div class="p-2 bg-white/90 backdrop-blur border-b border-slate-200 flex justify-between items-center z-10 shrink-0 gap-2">
                <!-- Toolbar -->
                <div class="flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg border border-slate-200/50" v-if="!pendingMappingQuestionId">
                   <button 
                      @click="activeTool = 'cursor'" 
                      class="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold transition-all"
                      :class="activeTool === 'cursor' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
                      title="选择/移动 (V)"
                   >
                      <Icon icon="mdi:cursor-default-outline" /> <span>选择</span>
                   </button>
                   <div class="w-px h-4 bg-slate-300 mx-1"></div>
                   <button 
                      v-for="tool in [
                         { id: 'single_choice', label: '单选', icon: 'mdi:radiobox-marked' },
                         { id: 'multiple_choice', label: '多选', icon: 'mdi:checkbox-marked-outline' },
                         { id: 'omr_grid', label: '批量网格', icon: 'mdi:grid' },
                         { id: 'true_false', label: '判断', icon: 'mdi:check-circle-outline' },
                         { id: 'fill_in_blank', label: '填空', icon: 'mdi:form-textbox' },
                         { id: 'subjective', label: '主观', icon: 'mdi:text-box-edit-outline' }
                      ]"
                      :key="tool.id"
                      @click="activeTool = tool.id as any; selectedQuestionId = null"
                      class="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all"
                      :class="activeTool === tool.id ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
                   >
                      <Icon :icon="tool.icon" /> <span class="hidden xl:inline">{{ tool.label }}</span>
                   </button>
                </div>
                
                <div v-else class="flex-1 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold flex items-center justify-between animate-fade-in">
                   <div class="flex items-center gap-2">
                      <Icon icon="mdi:target" class="animate-pulse" />
                      <span>正在为题目画框... 请在画布上拖拽区域</span>
                   </div>
                   <button @click="pendingMappingQuestionId = null" class="text-amber-500 hover:text-amber-800">取消</button>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Zoom Controls -->
                  <div class="flex items-center bg-slate-100 rounded-lg p-0.5 mr-2">
                     <button @click="zoomLevel = Math.max(0.2, zoomLevel - 0.1)" class="p-1 text-slate-500 hover:text-blue-600 transition-colors" title="缩小">
                        <Icon icon="mdi:magnify-minus-outline" />
                     </button>
                     <span class="text-[10px] font-mono text-slate-600 px-1 min-w-[3rem] text-center">{{ Math.round(zoomLevel * 100) }}%</span>
                     <button @click="zoomLevel = Math.min(3.0, zoomLevel + 0.1)" class="p-1 text-slate-500 hover:text-blue-600 transition-colors" title="放大">
                        <Icon icon="mdi:magnify-plus-outline" />
                     </button>
                  </div>

                  <!-- Pagination Controls -->
                  <div v-if="previewTotalPages > 1" class="flex items-center bg-slate-100 rounded-lg p-0.5 mr-2">
                    <button 
                      @click="changePreviewPage(-1)" 
                      :disabled="currentPreviewPage <= 1"
                      class="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                    >
                      <Icon icon="mdi:chevron-left" />
                    </button>
                    <span class="text-[10px] font-mono text-slate-600 px-1 min-w-[3rem] text-center">
                      {{ currentPreviewPage }} / {{ previewTotalPages }}
                    </span>
                    <button 
                      @click="changePreviewPage(1)" 
                      :disabled="currentPreviewPage >= previewTotalPages"
                      class="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                    >
                      <Icon icon="mdi:chevron-right" />
                    </button>
                  </div>

                  <label v-if="templateImage" class="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 text-slate-600 text-xs font-medium rounded-lg cursor-pointer shadow-sm flex items-center gap-1 transition-all">
                    <Icon icon="mdi:image-refresh" /> 替换底图
                    <input type="file" ref="templateFileInput" class="hidden" accept="application/pdf,image/*" @change="onTemplateFileSelect" />
                  </label>
                </div>
              </div>
              
              <div class="flex-1 w-full relative overflow-auto custom-scrollbar flex flex-col items-center justify-center p-4 bg-slate-200">
                 <!-- Canvas Wrapper (Overlay Mode) -->
                 <div 
                    v-if="templateImage" 
                    class="relative shadow-2xl bg-white border border-slate-200 cursor-crosshair transition-transform duration-200 ease-out origin-center"
                    :style="{ transform: `scale(${zoomLevel})` }"
                 >
                    <canvas 
                      ref="setupCanvasRef" 
                      class="block max-w-full"
                      @mousedown="onCanvasMouseDown"
                      @mousemove="onCanvasMouseMove"
                      @mouseup="onCanvasMouseUp"
                      @mouseleave="isDrawing = false"
                    ></canvas>
                 </div>

                 <!-- Empty State Upload -->
                 <div v-else 
                    class="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-400 rounded-xl bg-slate-100 hover:bg-white hover:border-blue-400 transition-all cursor-pointer group"
                    @click="templateFileInput?.click()"
                 >
                    <div class="w-16 h-16 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mb-4 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                       <Icon icon="mdi:file-document-outline" width="32" />
                    </div>
                    <span class="text-sm font-bold text-slate-600 group-hover:text-blue-600">点击上传标准答案卷 (PDF)</span>
                    <span class="text-xs text-slate-400 mt-1">用于校验坐标对齐情况</span>
                    <input type="file" ref="templateFileInput" class="hidden" accept="application/pdf,image/*" @change="onTemplateFileSelect" />
                 </div>
              </div>
              
              <div class="h-8 bg-white/80 backdrop-blur flex items-center justify-center text-[10px] text-slate-400 border-t border-slate-200 shrink-0">
                预览模式：校验 JSON 坐标与答案卷的对齐情况
              </div>
            </div>
          </div>
        </div>

        <!-- View: Upload -->
        <div v-if="activeTab === 'upload'" class="flex flex-col h-full items-center justify-center p-6 animate-fade-in">
          <div 
            class="w-full max-w-2xl aspect-video bg-white rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all group shrink-0 shadow-sm hover:shadow-md"
            @click="fileInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
            :class="{ 'border-blue-500 bg-blue-50/50': dragging }"
          >
            <div class="w-24 h-24 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
              <Icon icon="mdi:cloud-upload" width="48" />
            </div>
            <div class="text-center space-y-2">
              <h3 class="text-2xl font-bold text-slate-700 group-hover:text-blue-700 transition-colors">点击或拖拽上传答题卡</h3>
              <p class="text-base text-slate-400">支持批量 PDF 或单张图片格式</p>
              <div class="pt-4">
                <span class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow group-hover:bg-blue-700 transition-colors">选择文件</span>
              </div>
            </div>
            <input type="file" ref="fileInput" class="hidden" accept="application/pdf,image/*" @change="onFileSelect" />
          </div>

          <div class="mt-6 flex items-center gap-3">
            <button
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
              :disabled="loadingFromAsset"
              @click="assetPickerOpen = true"
              title="从资源库选择已保存的 PDF/图片"
            >
              <Icon icon="mdi:folder-search-outline" />
              {{ loadingFromAsset ? '加载中...' : '从资源库选择' }}
            </button>
          </div>
          
          <div v-if="processingStatus" class="mt-8 flex items-center gap-4 bg-white px-6 py-4 rounded-2xl shadow-card border border-slate-100 animate-fade-in">
             <div v-if="processingStatus.includes('...')" class="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
             <span class="font-medium text-slate-600">{{ processingStatus }}</span>
          </div>
        </div>

        <!-- <AssetPickerDialog
          v-model:open="assetPickerOpen"
          :multiple="false"
          title="选择阅卷输入资源"
          hint="选择一份 PDF/图片资源作为阅卷输入（需要资源包含可访问的 contentUrl 或 data URL）"
          @confirm="loadFromAsset"
        /> -->

        <!-- View: List -->
	        <div v-if="activeTab === 'list'" class="flex flex-col h-full p-6 animate-fade-in overflow-hidden">
	          <div class="flex justify-between items-center mb-4 shrink-0">
	            <div>
	              <h2 class="text-xl font-bold text-slate-800">批改结果列表</h2>
	              <p class="text-sm text-slate-500" v-if="processingStatus">{{ processingStatus }}</p>
	            </div>
	            <div class="flex items-center gap-2">
	              <button
	                v-if="backendAssignmentId"
	                @click="loadSubmissionsFromBackend"
	                class="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium shadow-sm disabled:opacity-60"
	                :disabled="backendLoadingSubmissions"
	                title="从后端加载该作业的提交记录"
	              >
	                <Icon icon="mdi:cloud-download" />
	                {{ backendLoadingSubmissions ? '加载中...' : '从后端加载' }}
	              </button>
	              <button
	                v-if="backendAssignmentId"
	                @click="saveAllToBackend"
	                class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm disabled:opacity-60"
	                :disabled="backendSavingAll"
	                title="保存当前列表中已完成但未保存的试卷到后端（并写入学业成绩）"
	              >
	                <Icon icon="mdi:cloud-upload" />
	                {{ backendSavingAll ? '保存中...' : '保存到后端' }}
	              </button>
	              <button @click="exportData" class="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium shadow-sm">
	                <Icon icon="mdi:file-excel" /> 导出 Excel
	              </button>
	            </div>
	          </div>

          <div class="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div class="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase shrink-0">
              <div class="col-span-1 text-center">状态</div>
              <div class="col-span-1">页码</div>
              <div class="col-span-3">姓名</div>
              <div class="col-span-3">学号</div>
              <div class="col-span-2 text-center">总分</div>
              <div class="col-span-2 text-right">操作</div>
            </div>
            <div class="flex-1 overflow-y-auto custom-scrollbar">
              <div 
                v-for="p in classPapers" 
                :key="p.id"
                class="grid grid-cols-12 gap-4 p-4 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                @click="viewPaper(p)"
              >
                <div class="col-span-1 flex justify-center">
                  <Icon v-if="p.status === 'done'" icon="mdi:check-circle" class="text-emerald-500 w-5 h-5" />
                  <Icon v-else-if="p.status === 'error'" icon="mdi:alert-circle" class="text-red-500 w-5 h-5" />
                  <div v-else class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div class="col-span-1 text-slate-400 font-mono text-sm">P{{ p.pageIndex }}</div>
                <div class="col-span-3 font-medium text-slate-700">{{ p.studentName }}</div>
                <div class="col-span-3 text-slate-500 text-sm font-mono">{{ p.studentId }}</div>
                <div class="col-span-2 text-center font-bold" :class="p.score >= 60 ? 'text-emerald-600' : 'text-red-500'">{{ p.score }}</div>
                <div class="col-span-2 text-right">
                  <span class="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">查看详情 &rarr;</span>
                </div>
              </div>
              <div v-if="classPapers.length === 0" class="p-12 text-center text-slate-400">
                暂无数据，请先上传试卷
              </div>
            </div>
          </div>
        </div>

        <!-- View: Detail -->
        <div v-if="activeTab === 'detail' && selectedPaper" class="flex flex-1 h-full p-6 gap-6 animate-slide-up bg-[#F8FAFC] overflow-hidden">
          <!-- Canvas Container -->
          <div class="flex-1 bg-slate-200 rounded-2xl overflow-hidden relative shadow-inner border border-slate-300 flex items-center justify-center min-w-0">
            <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(#64748b 1px, transparent 1px); background-size: 20px 20px;"></div>
            <div class="relative w-full h-full overflow-auto flex items-center justify-center p-8 custom-scrollbar">
              <canvas ref="canvasRef" class="shadow-2xl rounded max-w-full"></canvas>
              <div v-if="!selectedPaper.image" class="absolute text-slate-400 font-medium">无预览图像 (演示数据)</div>
            </div>
            <button @click="activeTab = 'list'" class="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium hover:bg-white transition-colors z-10">
              &larr; 返回列表
            </button>
            
            <!-- Detail Pagination -->
            <div v-if="selectedPaper && selectedPaper.pages.length > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1.5 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2 z-10">
               <button 
                  @click="currentDetailPage = Math.max(1, currentDetailPage - 1); refreshDetailView()" 
                  :disabled="currentDetailPage <= 1"
                  class="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
               >
                  <Icon icon="mdi:chevron-left" />
               </button>
               <span class="text-xs font-mono font-bold text-slate-600 px-2">
                  Page {{ currentDetailPage }} / {{ selectedPaper.pages.length }}
               </span>
               <button 
                  @click="currentDetailPage = Math.min(selectedPaper.pages.length, currentDetailPage + 1); refreshDetailView()" 
                  :disabled="currentDetailPage >= selectedPaper.pages.length"
                  class="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
               >
                  <Icon icon="mdi:chevron-right" />
               </button>
            </div>
          </div>

          <!-- Info Panel -->
          <div class="w-96 bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden shrink-0">
            <div class="p-6 border-b border-slate-100 bg-slate-50 shrink-0">
              <h2 class="text-xl font-bold text-slate-800">{{ selectedPaper.studentName }}</h2>
              <p class="text-slate-500 text-sm font-mono mt-1">{{ selectedPaper.studentId }}</p>
              <div v-if="selectedPaper.errorMsg" class="mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                异常：{{ selectedPaper.errorMsg }}
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <div v-for="(r, idx) in selectedPaper.results" :key="idx" class="p-4 rounded-xl border border-slate-100 shadow-sm bg-white">
                <div class="flex justify-between mb-2">
                  <span class="font-bold text-slate-700 text-sm">{{ r.questionId }}</span>
                  <span class="text-xs font-bold px-2 py-1 rounded" :class="r.score > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'">
                    {{ r.score }} 分
                  </span>
                </div>
                <div class="bg-slate-50 p-2 rounded text-xs text-slate-600 font-mono border border-slate-100 mb-2">
                  {{ r.studentAnswer }}
                </div>
                <div class="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Icon icon="mdi:comment-quote-outline" />
                  {{ r.feedback }}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>

    <!-- Add Question Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-96 p-6 animate-slide-up">
        <h3 class="text-lg font-bold text-slate-800 mb-4">添加题目配置</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">题目名称 (Label)</label>
            <input v-model="newQuestionForm.label" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="例如：第1题" />
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">分值 (Max Points)</label>
            <input v-model.number="newQuestionForm.maxPoints" type="number" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
          </div>
          
          <!-- Type Selector -->
          <div>
             <label class="block text-xs font-bold text-slate-500 mb-1">题型</label>
             <select v-model="newQuestionForm.type" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white">
                <option value="single_choice">单选题</option>
                <option value="multiple_choice">多选题</option>
                <option value="true_false">判断题</option>
                <option value="fill_in_blank">填空题</option>
                <option value="subjective">主观题</option>
             </select>
          </div>

          <!-- Dynamic Answer Input -->
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">参考答案</label>
            
            <div v-if="newQuestionForm.type === 'single_choice'" class="flex gap-3">
               <button 
                  v-for="opt in ['A','B','C','D']" 
                  :key="opt"
                  @click="newQuestionForm.correctAnswer = opt"
                  class="flex-1 py-2 rounded-lg border text-sm font-bold transition-all"
                  :class="newQuestionForm.correctAnswer === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'"
               >{{ opt }}</button>
            </div>

            <div v-else-if="newQuestionForm.type === 'true_false'" class="flex gap-3">
               <button @click="newQuestionForm.correctAnswer = 'T'" class="flex-1 py-2 rounded-lg border text-sm font-bold" :class="newQuestionForm.correctAnswer === 'T' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 border-slate-200'">正确 (T)</button>
               <button @click="newQuestionForm.correctAnswer = 'F'" class="flex-1 py-2 rounded-lg border text-sm font-bold" :class="newQuestionForm.correctAnswer === 'F' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 border-slate-200'">错误 (F)</button>
            </div>

            <input v-else v-model="newQuestionForm.correctAnswer" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" :placeholder="newQuestionForm.type === 'subjective' ? '简答题可留空' : '输入参考答案...'" />
          </div>
        </div>
        
        <div class="flex gap-3 mt-6">
          <button @click="cancelAddQuestion" class="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">取消</button>
          <button @click="saveNewQuestion" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-md shadow-blue-500/30">确认添加</button>
        </div>
      </div>
    </div>

    <!-- Grid Config Panel (Floating, Non-Modal) -->
    <div v-if="showGridModal" class="absolute top-16 right-6 z-40 w-80 bg-white/95 backdrop-blur shadow-2xl border border-slate-200 rounded-xl p-4 animate-slide-up">
        <div class="flex justify-between items-center mb-3">
           <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:grid" class="text-blue-600" /> 网格切割器
           </h3>
           <button @click="cancelGridSplit" class="text-slate-400 hover:text-slate-600">
              <Icon icon="mdi:close" />
           </button>
        </div>
        
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
             <div>
               <label class="block text-[10px] font-bold text-slate-500 mb-1">起始题号</label>
               <input v-model.number="gridForm.startLabel" @input="drawSetupPreview" type="number" class="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" />
             </div>
             <div>
               <label class="block text-[10px] font-bold text-slate-500 mb-1">结束题号</label>
               <input v-model.number="gridForm.endLabel" @input="drawSetupPreview" type="number" class="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" />
             </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
             <div>
               <label class="block text-[10px] font-bold text-slate-500 mb-1">列数 (Cols)</label>
               <input v-model.number="gridForm.cols" @input="drawSetupPreview" type="number" min="1" class="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" />
             </div>
             <div>
               <label class="block text-[10px] font-bold text-slate-500 mb-1">单题分值</label>
               <input v-model.number="gridForm.pointsPerQ" type="number" class="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" />
             </div>
          </div>
          
          <div>
             <label class="block text-[10px] font-bold text-slate-500 mb-1">题型</label>
             <select v-model="gridForm.type" class="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 bg-white outline-none">
                <option value="single_choice">单选题 (ABCD)</option>
                <option value="multiple_choice">多选题 (ABCD...)</option>
                <option value="true_false">判断题 (T/F)</option>
             </select>
          </div>
          
          <div class="p-2 bg-blue-50/50 rounded text-[10px] text-blue-600 leading-relaxed">
             预览: {{ Math.max(0, gridForm.endLabel - gridForm.startLabel + 1) }} 题, 
             {{ Math.ceil(Math.max(1, gridForm.endLabel - gridForm.startLabel + 1) / Math.max(1, gridForm.cols)) }} 行 × {{ gridForm.cols }} 列。
             <br>请调整参数直到网格与试卷对齐。
          </div>
          
          <button @click="confirmGridSplit" class="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all">
             确认生成 (Generate)
          </button>
        </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.animate-fade-in { animation: fadeIn 0.3s ease-out; }
.animate-slide-up { animation: slideUp 0.3s ease-out; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
