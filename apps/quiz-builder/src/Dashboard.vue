<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'

const API_QUIZZES = '/api/quizzes'
const API_QUESTIONS = '/api/questions'
const API_ASSETS = '/api/assets'
const API_EVENTS = '/api/events'

type QuestionListItem = {
  id: string
  stem: string
  type: string
  subject?: string | null
  grade?: string | null
  difficulty?: number | null
  status: string
  updatedAt: string
}

type QuestionDetail = {
  id: string
  stem: string
  type: string
  options?: unknown
  answer?: unknown
  analysis?: string | null
  subject?: string | null
  grade?: string | null
  difficulty?: number | null
  knowledgePoints?: unknown
  attachments?: unknown
  sourceAssetId?: string | null
}

type AssetView = { id: string; title: string }

const token = ref<string>(localStorage.getItem('iai-token') || '')

const listLoading = ref(false)
const listError = ref('')
const keyword = ref('')
const subjectFilter = ref('')
const gradeFilter = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const questions = ref<QuestionListItem[]>([])
const preview = ref<QuestionDetail | null>(null)

const selected = ref<QuestionDetail[]>([])
const draggingIndex = ref<number | null>(null)

const quizTitle = ref('试卷草稿')
const quizSubject = ref('')
const quizGrade = ref('')
const quizTags = ref('')
const quizVisibility = ref<'PRIVATE' | 'INTERNAL' | 'PUBLIC'>('PRIVATE')

const saving = ref(false)
const saveResult = ref<{ assetId: string; title: string } | null>(null)
const exportingMarkdown = ref(false)
const exportingDoc = ref(false)
const printingPdf = ref(false)
const regenerating = ref(false)

const authHeaders = computed(() => (token.value ? { Authorization: `Bearer ${token.value}` } : {}))
const canUse = computed(() => Boolean(token.value))

function safeParseJson(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

async function loadQuestions() {
  listLoading.value = true
  listError.value = ''
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value)
    })
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
    if (subjectFilter.value.trim()) params.set('subject', subjectFilter.value.trim())
    if (gradeFilter.value.trim()) params.set('grade', gradeFilter.value.trim())

    const res = await fetch(`${API_QUESTIONS}?${params.toString()}`, {
      headers: authHeaders.value
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `加载失败 (${res.status})`)
    }
    const data = await res.json()
    questions.value = data.items || []
    total.value = data.total || 0
  } catch (e: any) {
    listError.value = e.message || '加载失败'
    questions.value = []
    total.value = 0
  } finally {
    listLoading.value = false
  }
}

async function loadQuestionDetail(id: string) {
  const res = await fetch(`${API_QUESTIONS}/${id}`, { headers: authHeaders.value })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '读取题目失败')
  }
  const raw = await res.json()
  const detail: QuestionDetail = {
    id: raw.id,
    stem: raw.stem,
    type: raw.type,
    options: safeParseJson(raw.options),
    answer: safeParseJson(raw.answer),
    analysis: raw.analysis ?? null,
    subject: raw.subject ?? null,
    grade: raw.grade ?? null,
    difficulty: raw.difficulty ?? null,
    knowledgePoints: safeParseJson(raw.knowledgePoints),
    attachments: safeParseJson(raw.attachments),
    sourceAssetId: raw.sourceAssetId ?? null
  }
  preview.value = detail
  return detail
}

async function regenerateSimilar() {
  if (!preview.value) return
  if (!canUse.value) {
    alert('请先登录后使用')
    return
  }

  regenerating.value = true
  try {
    const res = await fetch(`${API_QUESTIONS}/${preview.value.id}/regenerate`, {
      method: 'POST',
      headers: authHeaders.value
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `生成失败 (${res.status})`)
    }
    const created = await res.json()
    const detail = await loadQuestionDetail(created.id)
    selected.value.push(detail)
    await loadQuestions().catch(() => {})
  } catch (e: any) {
    alert(e.message || '生成失败')
  } finally {
    regenerating.value = false
  }
}

async function addQuestion(item: QuestionListItem) {
  if (selected.value.some((q) => q.id === item.id)) return
  try {
    const detail = await loadQuestionDetail(item.id)
    selected.value.push(detail)
    if (selected.value.length === 1) {
      quizSubject.value = quizSubject.value || (detail.subject ?? '')
      quizGrade.value = quizGrade.value || (detail.grade ?? '')
    }
  } catch (e: any) {
    alert(e.message || '添加失败')
  }
}

function removeQuestion(id: string) {
  selected.value = selected.value.filter((q) => q.id !== id)
  if (preview.value?.id === id) {
    preview.value = selected.value[0] ?? null
  }
}

function onDragStart(index: number, e: DragEvent) {
  draggingIndex.value = index
  e.dataTransfer?.setData('text/plain', String(index))
  e.dataTransfer?.setDragImage?.(new Image(), 0, 0)
}

function onDrop(index: number) {
  const from = draggingIndex.value
  draggingIndex.value = null
  if (from === null || from === index) return
  const next = [...selected.value]
  const [moved] = next.splice(from, 1)
  next.splice(index, 0, moved)
  selected.value = next
}

function buildQuizJson() {
  const tags = quizTags.value
    .split(/[,， ]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  return {
    version: 1,
    title: quizTitle.value.trim() || '试卷草稿',
    subject: quizSubject.value.trim() || undefined,
    grade: quizGrade.value.trim() || undefined,
    createdAt: new Date().toISOString(),
    questions: selected.value.map((q, idx) => ({
      order: idx + 1,
      id: q.id,
      stem: q.stem,
      type: q.type,
      options: q.options ?? null,
      answer: q.answer ?? null,
      analysis: q.analysis ?? null,
      difficulty: q.difficulty ?? null,
      subject: q.subject ?? null,
      grade: q.grade ?? null,
      sourceAssetId: q.sourceAssetId ?? null
    })),
    tags
  }
}

function toMarkdown() {
  const quiz = buildQuizJson()
  const lines: string[] = []
  lines.push(`# ${quiz.title}`)
  const meta: string[] = []
  if (quiz.subject) meta.push(`学科：${quiz.subject}`)
  if (quiz.grade) meta.push(`年级：${quiz.grade}`)
  if (meta.length) lines.push(`> ${meta.join(' ｜ ')}`)
  lines.push('')

  quiz.questions.forEach((q: any) => {
    lines.push(`${q.order}. ${q.stem}`)
    const options = Array.isArray(q.options) ? q.options : null
    if (options && options.length) {
      const letters = 'ABCDEFGH'
      options.forEach((opt: string, i: number) => {
        lines.push(`   ${letters[i]}. ${opt}`)
      })
    }
    lines.push('')
  })

  return lines.join('\n')
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toHtmlDocument() {
  const quiz = buildQuizJson()

  const meta: string[] = []
  if (quiz.subject) meta.push(`学科：${escapeHtml(String(quiz.subject))}`)
  if (quiz.grade) meta.push(`年级：${escapeHtml(String(quiz.grade))}`)
  if (quiz.tags?.length) meta.push(`标签：${escapeHtml(quiz.tags.join('、'))}`)

  const questionsHtml = quiz.questions
    .map((q: any) => {
      const lines: string[] = []
      lines.push(`<div class="q">`)
      lines.push(`<div class="q-title"><span class="q-no">${q.order}.</span> <span class="q-stem">${escapeHtml(String(q.stem ?? ''))}</span></div>`)

      const options = Array.isArray(q.options) ? q.options : null
      if (options && options.length) {
        const letters = 'ABCDEFGH'
        lines.push('<ol class="q-options">')
        options.forEach((opt: any, idx: number) => {
          const letter = letters[idx] ?? String(idx + 1)
          lines.push(`<li><span class="opt-letter">${letter}.</span> <span class="opt-text">${escapeHtml(String(opt ?? ''))}</span></li>`)
        })
        lines.push('</ol>')
      }

      lines.push('</div>')
      return lines.join('\n')
    })
    .join('\n')

  const title = escapeHtml(String(quiz.title ?? '试卷'))

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { --text:#111827; --muted:#6b7280; --border:#e5e7eb; }
      body { margin:0; padding:32px; font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',Arial,sans-serif; color:var(--text); }
      .page { max-width:800px; margin:0 auto; }
      h1 { font-size:22px; margin:0 0 8px 0; }
      .meta { color:var(--muted); font-size:12px; margin-bottom:18px; }
      .meta span { margin-right:12px; }
      .q { border:1px solid var(--border); border-radius:10px; padding:14px 14px; margin:0 0 12px 0; }
      .q-title { font-size:14px; line-height:1.55; }
      .q-no { font-weight:600; margin-right:6px; }
      .q-options { margin:10px 0 0 18px; padding:0; }
      .q-options li { margin:6px 0; font-size:13px; line-height:1.55; }
      .opt-letter { font-weight:600; margin-right:6px; }
      .footer { margin-top:18px; color:var(--muted); font-size:11px; }
      @media print {
        body { padding:0; }
        .page { max-width:none; padding:18mm 14mm; }
        .q { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <h1>${title}</h1>
      ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
      ${questionsHtml || '<div class="meta">暂无题目</div>'}
      <div class="footer">导出时间：${escapeHtml(new Date().toLocaleString())}</div>
    </div>
  </body>
</html>`
}

async function downloadMarkdown() {
  if (selected.value.length === 0) return
  exportingMarkdown.value = true
  try {
    const md = toMarkdown()
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quizTitle.value.trim() || 'quiz'}.md`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exportingMarkdown.value = false
  }
}

async function downloadWord() {
  if (selected.value.length === 0) return
  exportingDoc.value = true
  try {
    const html = toHtmlDocument()
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quizTitle.value.trim() || 'quiz'}.doc`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exportingDoc.value = false
  }
}

async function exportPdfViaPrint() {
  if (selected.value.length === 0) return
  printingPdf.value = true
  try {
    const html = toHtmlDocument()
    const win = window.open('', '_blank', 'noopener,noreferrer')
    if (!win) {
      alert('无法打开新窗口，请允许浏览器弹窗后重试。')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
    const trigger = () => {
      win.focus()
      win.print()
    }
    win.addEventListener?.('load', () => setTimeout(trigger, 50))
    setTimeout(trigger, 300)
  } finally {
    printingPdf.value = false
  }
}

async function saveAsAsset() {
  if (selected.value.length === 0) return
  saving.value = true
  saveResult.value = null
  try {
    const quiz = buildQuizJson()
    const res = await fetch(API_ASSETS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value
      },
      body: JSON.stringify({
        title: quiz.title,
        summary: `试卷（${quiz.questions.length} 题）`,
        type: 'quiz-json',
        content: JSON.stringify(quiz, null, 2),
        tags: quiz.tags,
        visibility: quizVisibility.value
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '保存失败')
    }
    const asset = (await res.json()) as AssetView
    saveResult.value = { assetId: asset.id, title: asset.title }

    await fetch(API_EVENTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value
      },
      body: JSON.stringify({
        action: 'asset.created',
        appCode: 'quiz-builder',
        targetType: 'Asset',
        targetId: asset.id,
        payload: { count: quiz.questions.length, type: 'quiz-json' }
      })
    }).catch(() => {})
  } catch (e: any) {
    alert(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function generateMockQuiz() {
  if (!canUse.value) return
  const res = await fetch(`${API_QUIZZES}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders.value },
    body: JSON.stringify({
      topic: quizTitle.value || '示例试卷',
      knowledgePoints: '',
      difficulty: 'medium'
    })
  })
  if (!res.ok) return
  const data = await res.json()
  if (data?.markdown) {
    await navigator.clipboard.writeText(String(data.markdown))
    alert('已复制 mock 生成的 Markdown 到剪贴板')
  }
}

function goPage(next: number) {
  const totalPages = Math.max(1, Math.ceil(total.value / pageSize.value))
  const p = Math.min(Math.max(1, next), totalPages)
  if (p !== page.value) {
    page.value = p
    loadQuestions()
  }
}

onMounted(() => {
  // Token may be injected by portal route params; keep a light sync.
  const params = new URLSearchParams(window.location.search)
  const authToken = params.get('auth_token')
  if (authToken) {
    token.value = authToken
    localStorage.setItem('iai-token', authToken)
    const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname
    window.history.replaceState({ path: newUrl }, '', newUrl)
  }
  token.value = localStorage.getItem('iai-token') || token.value
  if (token.value) loadQuestions()
})
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto space-y-6">
    <header class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:file-document-edit" class="text-primary w-6 h-6" />
        <div>
          <h1 class="text-2xl font-bold">智能组卷</h1>
          <p class="text-sm text-gray-500">从题库选题 → 拖拽排序 → 保存为资源（`quiz-json`）</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button
          class="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1"
          :disabled="!canUse"
          @click="generateMockQuiz"
          title="调用 /api/quizzes/generate (mock) 并复制结果"
        >
          <Icon icon="mdi:sparkles" />
          mock 生成
        </button>
        <button
          class="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60"
          :disabled="selected.length === 0 || exportingDoc"
          @click="downloadWord"
          title="导出为 Word（.doc，HTML 格式）"
        >
          <Icon icon="mdi:file-word" />
          {{ exportingDoc ? '导出中...' : '导出 Word' }}
        </button>
        <button
          class="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60"
          :disabled="selected.length === 0 || printingPdf"
          @click="exportPdfViaPrint"
          title="打开打印预览，可选择“另存为 PDF”"
        >
          <Icon icon="mdi:file-pdf-box" />
          {{ printingPdf ? '打开中...' : '导出 PDF' }}
        </button>
        <button
          class="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1"
          :disabled="selected.length === 0 || exportingMarkdown"
          @click="downloadMarkdown"
        >
          <Icon icon="mdi:file-download" />
          {{ exportingMarkdown ? '导出中...' : '导出 Markdown' }}
        </button>
        <button
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1 disabled:opacity-60"
          :disabled="selected.length === 0 || saving"
          @click="saveAsAsset"
        >
          <Icon icon="mdi:content-save" />
          {{ saving ? '保存中...' : '保存到资源库' }}
        </button>
      </div>
    </header>

    <div v-if="!canUse" class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
      请先在工作台登录后使用（需要 `iai-token`）。若在独立页面打开，可用 `?auth_token=...` 传入。
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Left: Question Bank -->
      <section class="bg-white border rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <Icon icon="mdi:database-search" /> 题库检索
          </h3>
          <button
            class="px-3 py-1.5 bg-white border rounded hover:bg-gray-50 text-sm"
            :disabled="!canUse || listLoading"
            @click="page = 1; loadQuestions()"
          >
            <Icon icon="mdi:reload" class="inline-block" />
            刷新
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="text-sm text-gray-600">关键词</label>
            <input
              v-model="keyword"
              class="mt-1 border rounded px-3 py-2 w-full"
              placeholder="题干/解析关键词..."
              @keyup.enter="page = 1; loadQuestions()"
            />
          </div>
          <div>
            <label class="text-sm text-gray-600">学科</label>
            <input
              v-model="subjectFilter"
              class="mt-1 border rounded px-3 py-2 w-full"
              placeholder="如：数学"
              @keyup.enter="page = 1; loadQuestions()"
            />
          </div>
          <div>
            <label class="text-sm text-gray-600">年级</label>
            <input
              v-model="gradeFilter"
              class="mt-1 border rounded px-3 py-2 w-full"
              placeholder="如：高一"
              @keyup.enter="page = 1; loadQuestions()"
            />
          </div>
          <div class="md:col-span-2 flex items-end gap-2">
            <button
              class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60 w-full"
              :disabled="!canUse || listLoading"
              @click="page = 1; loadQuestions()"
            >
              {{ listLoading ? '加载中...' : '搜索' }}
            </button>
          </div>
        </div>

        <div v-if="listError" class="text-sm text-red-600">{{ listError }}</div>

        <div class="border rounded-lg overflow-hidden">
          <div class="max-h-[420px] overflow-auto">
            <div
              v-for="q in questions"
              :key="q.id"
              class="px-4 py-3 border-b last:border-0 hover:bg-gray-50 flex items-start gap-3"
            >
              <button
                class="flex-1 text-left"
                @click="loadQuestionDetail(q.id).catch(() => {})"
                :title="q.stem"
              >
                <div
                  class="text-sm font-medium text-gray-900 overflow-hidden"
                  style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;"
                >
                  {{ q.stem }}
                </div>
                <div class="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 bg-gray-100 rounded">{{ q.type }}</span>
                  <span v-if="q.subject" class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{{ q.subject }}</span>
                  <span v-if="q.grade" class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">{{ q.grade }}</span>
                  <span class="ml-auto">{{ new Date(q.updatedAt).toLocaleString() }}</span>
                </div>
              </button>
              <button
                class="px-3 py-2 bg-white border rounded hover:bg-gray-50 text-sm disabled:opacity-60"
                :disabled="selected.some((s) => s.id === q.id)"
                @click="addQuestion(q)"
              >
                <Icon icon="mdi:plus" class="inline-block" />
                添加
              </button>
            </div>
            <div v-if="!listLoading && questions.length === 0" class="px-4 py-8 text-center text-sm text-gray-400">
              暂无数据
            </div>
          </div>
          <div class="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600">
            <span>共 {{ total }} 条</span>
            <div class="flex items-center gap-2">
              <button class="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-60" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
              <span>第 {{ page }} 页</span>
              <button
                class="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-60"
                :disabled="page >= Math.ceil(total / pageSize)"
                @click="goPage(page + 1)"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Right: Selected -->
      <section class="bg-white border rounded-lg p-4 space-y-3">
        <h3 class="font-bold text-gray-800 flex items-center gap-2">
          <Icon icon="mdi:clipboard-list-outline" /> 已选题目（可拖拽排序）
          <span class="text-xs text-gray-500">({{ selected.length }} 题)</span>
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="text-sm text-gray-600">试卷标题</label>
            <input v-model="quizTitle" class="mt-1 border rounded px-3 py-2 w-full" placeholder="如：七年级数学期中测验" />
          </div>
          <div>
            <label class="text-sm text-gray-600">可见性</label>
            <select v-model="quizVisibility" class="mt-1 border rounded px-3 py-2 w-full">
              <option value="PRIVATE">私有</option>
              <option value="INTERNAL">内部</option>
              <option value="PUBLIC">公开（仅管理员）</option>
            </select>
          </div>
          <div>
            <label class="text-sm text-gray-600">学科</label>
            <input v-model="quizSubject" class="mt-1 border rounded px-3 py-2 w-full" placeholder="如：数学" />
          </div>
          <div>
            <label class="text-sm text-gray-600">年级</label>
            <input v-model="quizGrade" class="mt-1 border rounded px-3 py-2 w-full" placeholder="如：高一" />
          </div>
          <div class="md:col-span-3">
            <label class="text-sm text-gray-600">标签（逗号分隔）</label>
            <input v-model="quizTags" class="mt-1 border rounded px-3 py-2 w-full" placeholder="期中, 一元一次方程, 应用题" />
          </div>
        </div>

        <div class="border rounded-lg overflow-hidden">
          <div class="max-h-[340px] overflow-auto">
            <div
              v-for="(q, idx) in selected"
              :key="q.id"
              class="px-4 py-3 border-b last:border-0 flex items-start gap-3 bg-white"
              :class="draggingIndex === idx ? 'opacity-60' : ''"
              draggable="true"
              @dragstart="onDragStart(idx, $event)"
              @dragover.prevent
              @drop.prevent="onDrop(idx)"
            >
              <div class="pt-1 text-gray-300 cursor-move" title="拖拽排序">
                <Icon icon="mdi:drag" class="w-5 h-5" />
              </div>
              <button class="flex-1 text-left" @click="preview = q">
                <div
                  class="text-sm font-medium text-gray-900 overflow-hidden"
                  style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;"
                >
                  {{ idx + 1 }}. {{ q.stem }}
                </div>
                <div class="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 bg-gray-100 rounded">{{ q.type }}</span>
                  <span v-if="q.difficulty" class="px-2 py-0.5 bg-slate-100 rounded">难度 {{ q.difficulty }}</span>
                </div>
              </button>
              <button class="px-2 py-2 text-red-600 hover:bg-red-50 rounded" title="移除" @click="removeQuestion(q.id)">
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div v-if="selected.length === 0" class="px-4 py-10 text-center text-sm text-gray-400">
              从左侧题库添加题目后在这里编排
            </div>
          </div>
        </div>

        <div v-if="saveResult" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          已保存到资源库：{{ saveResult.title }}（Asset ID: {{ saveResult.assetId }}）
        </div>
      </section>
    </div>

    <div v-if="preview" class="bg-white border rounded-lg p-4 space-y-3">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:eye-outline" />
        <h3 class="font-bold text-gray-800">题目预览</h3>
        <span class="text-xs text-gray-500">{{ preview.type }}</span>
        <span v-if="preview.difficulty" class="text-xs text-gray-500">难度 {{ preview.difficulty }}</span>
        <button
          class="ml-auto px-3 py-1.5 bg-white border rounded hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60"
          :disabled="regenerating"
          @click="regenerateSimilar"
          title="生成一题相似的变式题（当前为 mock 逻辑，可后续接入 LLM）"
        >
          <Icon icon="mdi:refresh" />
          {{ regenerating ? '生成中...' : '生成变式题' }}
        </button>
      </div>
      <pre class="bg-gray-50 border rounded p-3 text-sm overflow-auto whitespace-pre-wrap">{{ preview.stem }}</pre>
      <div v-if="Array.isArray(preview.options)" class="bg-white border rounded p-3 text-sm">
        <div class="font-medium text-gray-700 mb-2">选项</div>
        <ol class="list-decimal list-inside space-y-1">
          <li v-for="(opt, i) in (preview.options as any[])" :key="i">{{ opt }}</li>
        </ol>
      </div>
      <div v-if="preview.analysis" class="bg-white border rounded p-3 text-sm">
        <div class="font-medium text-gray-700 mb-2">解析</div>
        <pre class="whitespace-pre-wrap text-gray-700">{{ preview.analysis }}</pre>
      </div>
    </div>
  </div>
</template>
