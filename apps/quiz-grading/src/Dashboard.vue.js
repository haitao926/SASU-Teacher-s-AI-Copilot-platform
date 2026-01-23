import { ref, onMounted, nextTick, computed, reactive } from 'vue';
import { Icon } from '@iconify/vue';
import { useStorage } from '@vueuse/core';
import { useRouter } from 'vue-router';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import AssetPickerDialog from '../../../iai-teaching-portal/src/components/assets/AssetPickerDialog.vue';
// --- Configuration ---
// Ensure worker is loaded from local public directory to avoid CDN issues and ensure version matching
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
// --- Axios Config ---
// Bypass Vite proxy if it's failing, assuming BFF is on 8150 and CORS is enabled.
// In production this should be relative or configured via env.
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    axios.defaults.baseURL = 'http://localhost:8150';
}
const router = useRouter();
const token = useStorage('iai-token', '');
// --- Backend Sync (BFF) ---
const backendAssignmentId = useStorage('quiz-grading-assignment-id', '');
const backendAssignmentName = useStorage('quiz-grading-assignment-name', '阅卷作业');
const backendAssignmentSubject = useStorage('quiz-grading-assignment-subject', '数学');
const backendAssignmentAnchor = useStorage('quiz-grading-assignment-anchor', null);
const backendBusy = ref(false);
const backendLoadingSubmissions = ref(false);
const backendSavingAll = ref(false);
const backendAssignmentNameHistory = useStorage('quiz-grading-assignment-name-history', []);
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
];
const objectiveScoringSettings = useStorage('quiz-grading-objective-scoring-settings', {
    multiChoiceMode: 'all_or_nothing',
    fillNumericTolerance: 0,
    fillIgnoreUnits: false,
    fillSynonymsText: ''
});
function recordBackendAssignmentNameHistory() {
    const name = backendAssignmentName.value?.trim();
    if (!name)
        return;
    backendAssignmentNameHistory.value = Array.from(new Set([name, ...backendAssignmentNameHistory.value])).slice(0, 10);
}
function authHeaders(extra) {
    const headers = { ...(extra ?? {}) };
    if (token.value)
        headers.Authorization = `Bearer ${token.value}`;
    return headers;
}
async function apiJson(url, init = {}) {
    const headers = new Headers(init.headers);
    const merged = authHeaders(Object.fromEntries(headers.entries()));
    const finalHeaders = new Headers(merged);
    if (init.body && !finalHeaders.has('Content-Type')) {
        finalHeaders.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...init, headers: finalHeaders });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}
function mapQuestionTypeToAnswerKey(type) {
    switch (type) {
        case 'single_choice':
        case 'true_false':
            return 'single';
        case 'multiple_choice':
            return 'multi';
        case 'fill_in_blank':
            return 'fill';
        case 'subjective':
        default:
            return 'essay';
    }
}
async function createBackendAssignment() {
    if (!token.value) {
        alert('请先登录后再创建后端作业');
        return;
    }
    backendBusy.value = true;
    try {
        const totalPoints = assignmentConfig.value.reduce((sum, q) => sum + (q.maxPoints || 0), 0);
        const name = backendAssignmentName.value?.trim() || `阅卷作业-${new Date().toLocaleString()}`;
        const subject = backendAssignmentSubject.value?.trim() || '未指定';
        const assignment = await apiJson('/api/grading/assignments', {
            method: 'POST',
            body: JSON.stringify({
                name,
                subject,
                totalPoints
            })
        });
        backendAssignmentId.value = assignment.id;
        alert(`后端作业已创建：${assignment.name}（ID: ${assignment.id}）`);
    }
    catch (e) {
        alert(e.message || '创建后端作业失败');
    }
    finally {
        backendBusy.value = false;
    }
}
async function syncAnswerKeysToBackend() {
    if (!token.value) {
        alert('请先登录后再同步答案');
        return;
    }
    if (!backendAssignmentId.value) {
        alert('请先创建/填写后端作业 ID');
        return;
    }
    backendBusy.value = true;
    try {
        const items = assignmentConfig.value.map((q) => ({
            questionId: q.label,
            questionType: mapQuestionTypeToAnswerKey(q.type),
            content: q.correctAnswer,
            points: q.maxPoints
        }));
        await apiJson('/api/grading/answer-keys', {
            method: 'POST',
            body: JSON.stringify({ assignmentId: backendAssignmentId.value, items })
        });
        alert('答案已同步到后端（AnswerKey）');
    }
    catch (e) {
        alert(e.message || '同步答案失败');
    }
    finally {
        backendBusy.value = false;
    }
}
// --- State ---
const activeTab = ref('setup');
const dragging = ref(false);
const processingStatus = ref('');
const processingProgress = ref(0);
const processingTotal = ref(0);
// Asset input (load PDF/images from Resource Library)
const assetPickerOpen = ref(false);
const loadingFromAsset = ref(false);
async function fileFromAsset(assetId) {
    const authHeader = token.value ? { Authorization: `Bearer ${token.value}` } : undefined;
    const res = await fetch(`/api/assets/${assetId}`, { headers: authHeader });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '读取资源失败');
    }
    const asset = await res.json();
    const fileNameBase = String(asset.title || 'paper').replace(/[\\/:*?"<>|]/g, '_');
    // 1) Prefer contentUrl
    if (asset.contentUrl && typeof asset.contentUrl === 'string') {
        const url = asset.contentUrl.trim();
        if (url.startsWith('data:')) {
            const match = url.match(/^data:([^;]+);base64,(.*)$/);
            if (!match)
                throw new Error('资源链接不是有效的 data URL');
            const mime = match[1] || 'application/octet-stream';
            const b64 = match[2] || '';
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
                bytes[i] = binary.charCodeAt(i);
            const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'bin');
            return new File([bytes], `${fileNameBase}.${ext}`, { type: mime });
        }
        const fileRes = await fetch(url, { headers: url.startsWith('/') ? authHeader : undefined });
        if (!fileRes.ok)
            throw new Error(`下载资源失败 (${fileRes.status})`);
        const blob = await fileRes.blob();
        const mime = blob.type || (url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
        const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'bin');
        return new File([blob], `${fileNameBase}.${ext}`, { type: mime });
    }
    // 2) Fallback: content as base64 or data URL
    if (asset.content && typeof asset.content === 'string') {
        const content = asset.content.trim();
        if (content.startsWith('data:')) {
            const match = content.match(/^data:([^;]+);base64,(.*)$/);
            if (!match)
                throw new Error('资源内容不是有效的 data URL');
            const mime = match[1] || 'application/octet-stream';
            const b64 = match[2] || '';
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
                bytes[i] = binary.charCodeAt(i);
            const ext = mime.includes('pdf') ? 'pdf' : (mime.split('/')[1] || 'bin');
            return new File([bytes], `${fileNameBase}.${ext}`, { type: mime });
        }
    }
    throw new Error('该资源没有可用的 contentUrl/content（无法作为阅卷输入）');
}
async function loadFromAsset(assets) {
    if (!assets || assets.length === 0)
        return;
    if (!token.value) {
        alert('请先登录后使用资源库加载');
        return;
    }
    loadingFromAsset.value = true;
    try {
        const file = await fileFromAsset(assets[0].id);
        await handleFile(file);
    }
    catch (e) {
        alert(e.message || '从资源库加载失败');
    }
    finally {
        loadingFromAsset.value = false;
    }
}
// Assignment Configuration
const assignmentConfig = ref([
    { id: 'q1', label: '第1题', type: 'single_choice', x: 50, y: 150, w: 600, h: 100, page: 1, correctAnswer: 'A', maxPoints: 5 },
    { id: 'q2', label: '第2题', type: 'fill_in_blank', x: 50, y: 260, w: 600, h: 100, page: 1, correctAnswer: '3.14', maxPoints: 5 },
    { id: 'q3', label: '第3题', type: 'subjective', x: 50, y: 370, w: 600, h: 200, page: 1, correctAnswer: 'Triangle needs 3 sides', maxPoints: 10 },
]);
const configJson = ref(JSON.stringify(assignmentConfig.value, null, 2));
const templateImage = ref(null);
const templateSize = ref(null);
const setupCanvasRef = ref(null);
// Template / Preview State
let pdfDoc = null;
const currentPreviewPage = ref(1);
const previewTotalPages = ref(1);
const previewMode = ref('overlay');
const previewCrops = ref([]);
const zoomLevel = ref(1.0);
const templateAnchor = ref(null);
// --- Interaction State (Box Selection & Dragging) ---
const interactionMode = ref('idle');
const activeTool = ref('cursor');
// If set, the next draw operation will update this question's coordinates instead of creating a new one.
const pendingMappingQuestionId = ref(null);
const selectedQuestionId = ref(null);
const hoverQuestionId = ref(null); // For hover effects
const dragStart = ref({ x: 0, y: 0 }); // Mouse start pos
const initialObjPos = ref({ x: 0, y: 0, w: 0, h: 0 }); // Object start pos & size
// Temporary state for creating new
const isDrawing = ref(false); // keeping for template compatibility but logic moves to interactionMode
const startPos = ref({ x: 0, y: 0 });
const tempRect = ref(null);
const showAddModal = ref(false);
const showGridModal = ref(false); // New Grid Modal
const newQuestionForm = reactive({
    label: '',
    type: 'subjective',
    maxPoints: 5,
    correctAnswer: ''
});
const gridForm = reactive({
    startLabel: 1,
    endLabel: 5,
    cols: 1, // Future support for multi-column layout
    type: 'single_choice',
    pointsPerQ: 5
});
// Computed for the selected question form in sidebar
const activeQuestion = computed(() => assignmentConfig.value.find(q => q.id === selectedQuestionId.value));
// --- Helper: Crop Image Region ---
async function cropImageRegion(dataUrl, x, y, w, h) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return '';
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.9); // Base64
}
// --- Logic: AI Simulation ---
const isSimulating = ref(false);
const simulationResult = ref('');
async function simulateAIGrading() {
    if (!activeQuestion.value || !templateImage.value)
        return;
    isSimulating.value = true;
    simulationResult.value = '1. 正在截取题目区域...';
    try {
        // 1. Crop Image
        const q = activeQuestion.value;
        const cropBase64 = await cropImageRegion(templateImage.value, q.x, q.y, q.w, q.h);
        const base64Content = cropBase64.split(',')[1];
        // 2. Upload to OCR Service (Mock or Real)
        simulationResult.value = '2. 正在调用 OCR 识别文字...';
        const uploadRes = await axios.post('/api/ocr/upload', {
            fileName: `question_${q.id}.jpg`,
            contentBase64: base64Content,
            scene: 'lens' // Use 'lens' mode for faster mock response
        }, {
            headers: { Authorization: `Bearer ${token.value}` }
            // Note: token is from useStorage('iai-token', '') defined in App.vue, 
            // but here in Dashboard.vue we need to access it. 
            // Let's add token ref if not present.
        });
        const taskId = uploadRes.data.taskId;
        // 3. Poll for Status
        let attempts = 0;
        while (attempts < 20) { // Max 10s (lens mode is fast)
            await new Promise(r => setTimeout(r, 500));
            const statusRes = await axios.get(`/api/ocr/status/${taskId}`, {
                headers: { Authorization: `Bearer ${token.value}` }
            });
            if (statusRes.data.status === 'done') {
                // 4. Get Result
                const resultRes = await axios.get(`/api/ocr/result/${taskId}`, {
                    headers: { Authorization: `Bearer ${token.value}` }
                });
                const ocrText = resultRes.data.result || '';
                // 5. Call Intelligent Grading API (Real LLM)
                simulationResult.value = '3. 正在进行 AI 智能判分 (DeepSeek)...';
                try {
                    const gradeRes = await axios.post('/api/grading/grade-image', {
                        imageBase64: base64Content, // Keep for context if model supports vision
                        questionText: q.label + (q.gradingCriteria ? ` (评分标准: ${q.gradingCriteria})` : ''),
                        correctAnswer: q.correctAnswer,
                        maxPoints: q.maxPoints,
                        ocrText: ocrText // Pass OCR text explicitly
                    }, {
                        headers: { Authorization: `Bearer ${token.value}` }
                    });
                    const result = gradeRes.data;
                    simulationResult.value = `[识别结果]: ${ocrText.substring(0, 50)}...\n[AI 评分]: ${result.score}/${q.maxPoints}\n[理由]: ${result.feedback}`;
                }
                catch (gradeErr) {
                    console.error(gradeErr);
                    simulationResult.value = `OCR 成功，但评分失败: ${gradeErr.message}`;
                }
                break;
            }
            else if (statusRes.data.status === 'error') {
                throw new Error(statusRes.data.error || 'OCR 处理失败');
            }
            attempts++;
        }
    }
    catch (e) {
        simulationResult.value = '错误: ' + (e.response?.data?.message || e.message);
    }
    finally {
        isSimulating.value = false;
    }
}
// --- Batch Grading Logic ---
async function batchGradeObjectiveQuestions(paper, configs, img, scaleX, scaleY, offsetX, offsetY, groupLabel) {
    if (configs.length === 0)
        return [];
    const parseSynonyms = (text) => {
        const map = new Map();
        const lines = String(text ?? '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        for (const line of lines) {
            const parts = line.split('=');
            if (parts.length < 2)
                continue;
            const from = parts[0].trim();
            const to = parts.slice(1).join('=').trim();
            if (from && to)
                map.set(from, to);
        }
        return map;
    };
    const applySynonyms = (val, synonyms) => {
        const s = String(val ?? '').trim();
        if (!s)
            return s;
        return synonyms.get(s) ?? s;
    };
    const normalizeChoice = (v) => String(v ?? '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    const normalizeTrueFalse = (v) => {
        const s = String(v ?? '').trim().toUpperCase();
        if (!s)
            return '';
        if (/[对√T]/.test(s))
            return 'T';
        if (/[错×F]/.test(s))
            return 'F';
        return '';
    };
    const normalizeFill = (v) => String(v ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[，,。．]/g, '.');
    const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const parseFirstNumber = (s) => {
        const match = String(s ?? '').match(/-?\d+(?:\.\d+)?/);
        if (!match)
            return null;
        const n = Number.parseFloat(match[0]);
        return Number.isFinite(n) ? n : null;
    };
    const scoreFill = (expectedRaw, actualRaw) => {
        const synonyms = parseSynonyms(objectiveScoringSettings.value.fillSynonymsText);
        const expectedApplied = applySynonyms(expectedRaw, synonyms);
        const actualApplied = applySynonyms(actualRaw, synonyms);
        const tol = Number(objectiveScoringSettings.value.fillNumericTolerance || 0);
        const ignoreUnits = Boolean(objectiveScoringSettings.value.fillIgnoreUnits);
        if (tol > 0) {
            const expectedNum = parseFirstNumber(expectedApplied);
            const actualNum = parseFirstNumber(actualApplied);
            if (expectedNum !== null && actualNum !== null) {
                if (Math.abs(expectedNum - actualNum) <= tol)
                    return true;
                return false;
            }
        }
        if (ignoreUnits) {
            const expectedNum = parseFirstNumber(expectedApplied);
            const actualNum = parseFirstNumber(actualApplied);
            if (expectedNum !== null && actualNum !== null)
                return expectedNum === actualNum;
        }
        const expected = normalizeFill(expectedApplied);
        const actual = normalizeFill(actualApplied);
        return expected && expected === actual;
    };
    const scoreObjective = (cfg, extractedRaw) => {
        const expectedRaw = String(cfg.correctAnswer ?? '');
        if (groupLabel === 'choice') {
            if (cfg.type === 'multiple_choice') {
                const expected = normalizeChoice(expectedRaw).split('').sort();
                const actual = normalizeChoice(extractedRaw).split('').sort();
                if (expected.length === 0)
                    return 0;
                // If any wrong option selected -> 0
                const expectedSet = new Set(expected);
                if (actual.some((opt) => !expectedSet.has(opt)))
                    return 0;
                const mode = objectiveScoringSettings.value.multiChoiceMode;
                if (mode === 'partial_missing_no_wrong') {
                    const correctSelected = actual.filter((opt) => expectedSet.has(opt)).length;
                    const ratio = correctSelected / expected.length;
                    return Math.max(0, Math.min(cfg.maxPoints, Math.round(cfg.maxPoints * ratio)));
                }
                // all_or_nothing
                return arraysEqual(expected, actual) ? cfg.maxPoints : 0;
            }
            const expected = normalizeChoice(expectedRaw);
            const actual = normalizeChoice(extractedRaw);
            return expected && expected === actual ? cfg.maxPoints : 0;
        }
        if (groupLabel === 'true_false') {
            const expected = normalizeTrueFalse(expectedRaw);
            const actual = normalizeTrueFalse(extractedRaw);
            return expected && expected === actual ? cfg.maxPoints : 0;
        }
        // fill
        return scoreFill(expectedRaw, extractedRaw) ? cfg.maxPoints : 0;
    };
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 1. Prepare Canvas for Stitching
    // Layout: Single column for simplicity and better OCR sequencing
    const PADDING = 20;
    const LABEL_WIDTH = 40;
    let totalH = PADDING;
    let maxW = 0;
    const crops = [];
    for (const cfg of configs) {
        const fw = cfg.w * scaleX;
        const fh = cfg.h * scaleY;
        const fx = (cfg.x * scaleX) + offsetX;
        const fy = (cfg.y * scaleY) + offsetY;
        const c = document.createElement('canvas');
        c.width = fw;
        c.height = fh;
        const ctx = c.getContext('2d');
        if (ctx)
            ctx.drawImage(img, fx, fy, fw, fh, 0, 0, fw, fh);
        const digits = cfg.label.replace(/[^0-9]/g, '') || cfg.id.slice(0, 6);
        const tag = `Q${digits}`;
        crops.push({ id: cfg.id, label: cfg.label, tag, canvas: c });
        totalH += fh + PADDING;
        maxW = Math.max(maxW, fw);
    }
    const stitchCanvas = document.createElement('canvas');
    stitchCanvas.width = maxW + LABEL_WIDTH + PADDING * 2;
    stitchCanvas.height = totalH;
    const sCtx = stitchCanvas.getContext('2d');
    if (!sCtx)
        return [];
    // Fill white background
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, stitchCanvas.width, stitchCanvas.height);
    // Draw crops with labels (machine-friendly tags for OCR)
    let currentY = PADDING;
    sCtx.font = 'bold 20px Arial';
    sCtx.fillStyle = '#000000';
    sCtx.textBaseline = 'middle';
    for (const item of crops) {
        // Draw Tag (e.g. "Q1")
        sCtx.fillText(`${item.tag}:`, PADDING, currentY + item.canvas.height / 2);
        // Draw Image
        sCtx.drawImage(item.canvas, PADDING + LABEL_WIDTH, currentY);
        currentY += item.canvas.height + PADDING;
    }
    const stitchedBase64 = stitchCanvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    try {
        processingStatus.value =
            groupLabel === 'choice'
                ? '正在识别选择题...'
                : groupLabel === 'true_false'
                    ? '正在识别判断题...'
                    : '正在识别填空题...';
        // 2. OCR once for the stitched image, then do deterministic scoring locally.
        const uploadRes = await axios.post('/api/ocr/upload', {
            fileName: `batch_${paper.studentId}.jpg`,
            contentBase64: stitchedBase64,
            scene: 'doc' // Use doc mode for better layout analysis
        }, { headers: { Authorization: `Bearer ${token.value}` } });
        const taskId = uploadRes.data.taskId;
        let ocrText = '';
        // Poll OCR
        let attempts = 0;
        while (attempts < 20) {
            await new Promise(r => setTimeout(r, 800));
            const statusRes = await axios.get(`/api/ocr/status/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } });
            if (statusRes.data.status === 'done') {
                const resRes = await axios.get(`/api/ocr/result/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } });
                ocrText = resRes.data.result || '';
                break;
            }
            attempts++;
        }
        const lines = String(ocrText ?? '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        const results = [];
        for (const cfg of configs) {
            const digits = cfg.label.replace(/[^0-9]/g, '') || cfg.id.slice(0, 6);
            const tag = `Q${digits}`;
            const tagRe = new RegExp(`\\b${escapeRegExp(tag)}\\b\\s*[:：]?\\s*(.*)$`, 'i');
            const hitLine = lines.find((l) => tagRe.test(l)) || '';
            const match = hitLine.match(tagRe);
            const extracted = (match?.[1] ?? '').trim();
            const studentAnswer = extracted || '(未识别)';
            const score = scoreObjective(cfg, studentAnswer);
            const feedback = score > 0 ? '客观题判分：正确' : '客观题判分：错误/未识别';
            // Calculate coords again for result box (redundant but needed for array)
            const fx = (cfg.x * scaleX) + offsetX;
            const fy = (cfg.y * scaleY) + offsetY;
            const fw = cfg.w * scaleX;
            const fh = cfg.h * scaleY;
            results.push({
                questionId: cfg.label,
                studentAnswer,
                score: score,
                feedback: feedback,
                x: fx, y: fy, w: fw, h: fh,
                score_x: cfg.score_x ? (cfg.score_x * scaleX + offsetX) : undefined,
                score_y: cfg.score_y ? (cfg.score_y * scaleY + offsetY) : undefined
            });
        }
        return results;
    }
    catch (e) {
        console.error('Batch Grading Failed', e);
        return [];
    }
}
// --- Logic: Canvas Helpers ---
function getCanvasCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}
// Check if point is inside a rect
function isPointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
// --- Logic: Canvas Interaction (Main) ---
function onCanvasMouseDown(e) {
    if (activeTab.value !== 'setup' || !templateImage.value)
        return;
    const canvas = setupCanvasRef.value;
    if (!canvas)
        return;
    const pos = getCanvasCoordinates(e, canvas);
    // 0. Check Resize Handle Hit (Prioritize over dragging)
    if (selectedQuestionId.value) {
        const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value);
        if (q && (q.page || 1) === currentPreviewPage.value) {
            const handleSize = 12;
            // Hit test bottom-right corner
            if (isPointInRect(pos.x, pos.y, q.x + q.w - handleSize, q.y + q.h - handleSize, handleSize * 2, handleSize * 2)) {
                interactionMode.value = 'resizing';
                dragStart.value = pos;
                initialObjPos.value = { x: q.x, y: q.y, w: q.w, h: q.h };
                return;
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
            const q = assignmentConfig.value[i];
            // Filter page
            if ((q.page || 1) !== currentPreviewPage.value)
                continue;
            // Check Score Box Hit (approx 60x40 area centered or top-left)
            const sx = q.score_x !== undefined ? q.score_x : (q.x + q.w - 40);
            const sy = q.score_y !== undefined ? q.score_y : (q.y + 10);
            if (isPointInRect(pos.x, pos.y, sx, sy, 60, 40)) {
                interactionMode.value = 'dragging_score';
                selectedQuestionId.value = q.id;
                dragStart.value = pos;
                initialObjPos.value = { x: sx, y: sy, w: 0, h: 0 };
                drawSetupPreview();
                return;
            }
        }
        // 2. Check Hit: ROI Boxes (Blue Boxes)
        for (let i = assignmentConfig.value.length - 1; i >= 0; i--) {
            const q = assignmentConfig.value[i];
            if ((q.page || 1) !== currentPreviewPage.value)
                continue;
            if (isPointInRect(pos.x, pos.y, q.x, q.y, q.w, q.h)) {
                interactionMode.value = 'dragging_roi';
                selectedQuestionId.value = q.id;
                dragStart.value = pos;
                initialObjPos.value = { x: q.x, y: q.y, w: 0, h: 0 };
                drawSetupPreview();
                return;
            }
        }
    }
    // 3. Else: Start Drawing New (or Mapping)
    interactionMode.value = 'drawing';
    if (activeTool.value !== 'cursor') {
        // If in tool mode, ensure we deselect to avoid confusion
        selectedQuestionId.value = null;
    }
    startPos.value = pos;
    tempRect.value = { x: pos.x, y: pos.y, w: 0, h: 0 };
}
function onCanvasMouseMove(e) {
    const canvas = setupCanvasRef.value;
    if (!canvas)
        return;
    const pos = getCanvasCoordinates(e, canvas);
    // Hover effects
    if (interactionMode.value === 'idle') {
        let hit = false;
        canvas.style.cursor = 'crosshair';
        // Check Resize Handle Hover
        if (selectedQuestionId.value) {
            const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value);
            if (q && (q.page || 1) === currentPreviewPage.value) {
                const handleSize = 12;
                if (isPointInRect(pos.x, pos.y, q.x + q.w - handleSize, q.y + q.h - handleSize, handleSize * 2, handleSize * 2)) {
                    canvas.style.cursor = 'nwse-resize';
                    return;
                }
            }
        }
        // Check hits for cursor style
        for (let i = assignmentConfig.value.length - 1; i >= 0; i--) {
            const q = assignmentConfig.value[i];
            if ((q.page || 1) !== currentPreviewPage.value)
                continue;
            const sx = q.score_x !== undefined ? q.score_x : (q.x + q.w - 40);
            const sy = q.score_y !== undefined ? q.score_y : (q.y + 10);
            if (isPointInRect(pos.x, pos.y, sx, sy, 60, 40)) {
                canvas.style.cursor = 'move'; // Score
                hit = true;
                break;
            }
            if (isPointInRect(pos.x, pos.y, q.x, q.y, q.w, q.h)) {
                canvas.style.cursor = 'move'; // ROI
                hit = true;
                break;
            }
        }
        return;
    }
    if (interactionMode.value === 'drawing' && tempRect.value) {
        tempRect.value.w = pos.x - startPos.value.x;
        tempRect.value.h = pos.y - startPos.value.y;
        drawSetupPreview();
    }
    if (interactionMode.value === 'resizing' && selectedQuestionId.value) {
        const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value);
        if (q) {
            // Calc new width/height based on mouse pos relative to top-left of object
            const newW = pos.x - initialObjPos.value.x;
            const newH = pos.y - initialObjPos.value.y;
            // Min size constraint
            if (newW > 20)
                q.w = newW;
            if (newH > 20)
                q.h = newH;
            drawSetupPreview();
        }
    }
    if (interactionMode.value === 'dragging_roi' && selectedQuestionId.value) {
        const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value);
        if (q) {
            const dx = pos.x - dragStart.value.x;
            const dy = pos.y - dragStart.value.y;
            q.x = initialObjPos.value.x + dx;
            q.y = initialObjPos.value.y + dy;
            // Also move score if it wasn't customized (optional, but good UX)
            // Actually, if score_x is undefined, it follows ROI automatically in renderer.
            // If defined, it stays absolute. Let's keep it absolute if defined.
            drawSetupPreview();
        }
    }
    if (interactionMode.value === 'dragging_score' && selectedQuestionId.value) {
        const q = assignmentConfig.value.find(item => item.id === selectedQuestionId.value);
        if (q) {
            const dx = pos.x - dragStart.value.x;
            const dy = pos.y - dragStart.value.y;
            q.score_x = initialObjPos.value.x + dx;
            q.score_y = initialObjPos.value.y + dy;
            drawSetupPreview();
        }
    }
}
function onCanvasMouseUp(e) {
    if (interactionMode.value === 'drawing' && tempRect.value) {
        // Finish Drawing
        const finalRect = {
            x: tempRect.value.w < 0 ? tempRect.value.x + tempRect.value.w : tempRect.value.x,
            y: tempRect.value.h < 0 ? tempRect.value.y + tempRect.value.h : tempRect.value.y,
            w: Math.abs(tempRect.value.w),
            h: Math.abs(tempRect.value.h)
        };
        if (finalRect.w > 10 && finalRect.h > 10) {
            tempRect.value = finalRect;
            // Determine what to do based on Tool Mode
            if (activeTool.value === 'omr_grid') {
                // --- GRID SPLIT MODE ---
                // Open Grid Config Modal
                const nextNum = assignmentConfig.value.length + 1;
                gridForm.startLabel = nextNum;
                gridForm.endLabel = nextNum + 4; // Default +4 (total 5)
                gridForm.pointsPerQ = 3;
                gridForm.type = 'single_choice';
                showGridModal.value = true;
                // We keep tempRect to know where to split
            }
            else if (activeTool.value !== 'cursor') {
                // --- BATCH CREATE MODE ---
                // Auto-generate ID and Label
                const nextNum = assignmentConfig.value.length + 1;
                const newQ = {
                    id: crypto.randomUUID(),
                    label: `第${nextNum}题`,
                    type: activeTool.value,
                    x: Math.round(finalRect.x),
                    y: Math.round(finalRect.y),
                    w: Math.round(finalRect.w),
                    h: Math.round(finalRect.h),
                    page: currentPreviewPage.value,
                    correctAnswer: activeTool.value === 'single_choice' ? 'A' : '',
                    maxPoints: 5
                };
                assignmentConfig.value.push(newQ);
                // Auto-select the new question to show properties immediately (optional)
                // selectedQuestionId.value = newQ.id
                // Clear temp rect but STAY in drawing mode
                tempRect.value = null;
                // Update JSON
                configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
                drawSetupPreview();
            }
            else if (pendingMappingQuestionId.value) {
                // --- MAPPING MODE ---
                const qIndex = assignmentConfig.value.findIndex(q => q.id === pendingMappingQuestionId.value);
                if (qIndex !== -1) {
                    const q = assignmentConfig.value[qIndex];
                    q.x = Math.round(finalRect.x);
                    q.y = Math.round(finalRect.y);
                    q.w = Math.round(finalRect.w);
                    q.h = Math.round(finalRect.h);
                    q.page = currentPreviewPage.value;
                    // Auto-select
                    selectedQuestionId.value = q.id;
                }
                pendingMappingQuestionId.value = null;
                tempRect.value = null;
                configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
                drawSetupPreview();
            }
            else {
                // --- DEFAULT MODE (Modal) ---
                const nextIdx = assignmentConfig.value.length + 1;
                newQuestionForm.label = `第${nextIdx}题`;
                newQuestionForm.maxPoints = 5;
                newQuestionForm.correctAnswer = '';
                newQuestionForm.type = 'subjective'; // Default
                showAddModal.value = true;
            }
        }
        else {
            tempRect.value = null;
            drawSetupPreview();
        }
    }
    // Sync JSON if we were dragging or resizing
    if (interactionMode.value !== 'idle' && interactionMode.value !== 'drawing') {
        configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
    }
    interactionMode.value = 'idle';
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
        });
        // Sync to JSON text
        configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
    }
    showAddModal.value = false;
    tempRect.value = null;
    drawSetupPreview();
}
function cancelAddQuestion() {
    showAddModal.value = false;
    tempRect.value = null;
    drawSetupPreview();
}
function confirmGridSplit() {
    if (!tempRect.value)
        return;
    const count = Math.max(1, gridForm.endLabel - gridForm.startLabel + 1);
    const cols = Math.max(1, gridForm.cols);
    const rows = Math.ceil(count / cols);
    const cellW = tempRect.value.w / cols;
    const cellH = tempRect.value.h / rows;
    for (let i = 0; i < count; i++) {
        const qNum = gridForm.startLabel + i;
        // Calculate Grid Position (Z-order: Left->Right, Top->Bottom)
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const qX = tempRect.value.x + (colIdx * cellW);
        const qY = tempRect.value.y + (rowIdx * cellH);
        // Slightly shrink to avoid overlap
        const gap = 2;
        const actualW = cellW - gap;
        const actualH = cellH - gap;
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
        });
    }
    showGridModal.value = false;
    tempRect.value = null;
    configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
    drawSetupPreview();
}
function cancelGridSplit() {
    showGridModal.value = false;
    tempRect.value = null;
    drawSetupPreview();
}
function onJsonChange() {
    try {
        const parsed = JSON.parse(configJson.value);
        if (Array.isArray(parsed)) {
            assignmentConfig.value = parsed;
            refreshPreview();
        }
    }
    catch {
        // Ignore syntax errors
    }
}
async function refreshPreview() {
    if (previewMode.value === 'overlay') {
        drawSetupPreview();
    }
    else {
        await generatePreviewCrops();
    }
}
async function generatePreviewCrops() {
    if (!templateImage.value)
        return;
    const img = new Image();
    img.src = templateImage.value;
    await new Promise(r => img.onload = r);
    const crops = [];
    assignmentConfig.value.forEach(q => {
        // Filter by page if needed
        const qPage = q.page || 1;
        if (qPage !== currentPreviewPage.value)
            return;
        const canvas = document.createElement('canvas');
        canvas.width = q.w;
        canvas.height = q.h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Draw cropped region
            ctx.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
            crops.push({
                id: q.id,
                label: q.label,
                url: canvas.toDataURL('image/jpeg')
            });
        }
    });
    previewCrops.value = crops;
}
function startMapping(id) {
    pendingMappingQuestionId.value = id;
    activeTool.value = 'cursor'; // Ensure we are in cursor mode to avoid creating new items
    // Ideally change cursor to crosshair
    if (setupCanvasRef.value)
        setupCanvasRef.value.style.cursor = 'crosshair';
}
function importJsonConfig(e) {
    const file = e.target.files?.[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;
        try {
            const parsed = JSON.parse(text);
            if (parsed.questions && Array.isArray(parsed.questions)) {
                assignmentConfig.value = parsed.questions;
                templateAnchor.value = parsed.anchor || null;
                backendAssignmentAnchor.value = parsed.anchor || null;
            }
            else if (Array.isArray(parsed)) {
                // Legacy format
                assignmentConfig.value = parsed;
            }
            configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
            refreshPreview();
        }
        catch {
            alert('无法解析配置文件');
        }
    };
    reader.readAsText(file);
}
function exportJsonConfig() {
    const exportData = {
        anchor: templateAnchor.value,
        questions: assignmentConfig.value
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grading-config.json';
    a.click();
    URL.revokeObjectURL(url);
}
// --- Setup Preview Logic ---
const templateFileInput = ref(null);
function onTemplateFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0)
        handleTemplateUpload(files[0]);
}
async function handleTemplateUpload(file) {
    if (file.type === 'application/pdf') {
        try {
            const buffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(buffer).promise;
            pdfDoc = pdf;
            previewTotalPages.value = pdf.numPages;
            currentPreviewPage.value = 1;
            await renderCurrentTemplatePage();
        }
        catch (e) {
            console.error(e);
            alert('PDF 预览加载失败: ' + (e.message || e));
        }
    }
    else if (file.type.startsWith('image/')) {
        pdfDoc = null;
        previewTotalPages.value = 1;
        currentPreviewPage.value = 1;
        const reader = new FileReader();
        reader.onload = (e) => {
            templateImage.value = e.target?.result;
            refreshPreview();
        };
        reader.readAsDataURL(file);
    }
}
async function changePreviewPage(delta) {
    const newPage = currentPreviewPage.value + delta;
    if (newPage >= 1 && newPage <= previewTotalPages.value) {
        currentPreviewPage.value = newPage;
        if (pdfDoc) {
            await renderCurrentTemplatePage();
        }
    }
}
async function renderCurrentTemplatePage() {
    if (!pdfDoc)
        return;
    const page = await pdfDoc.getPage(currentPreviewPage.value);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        templateImage.value = dataUrl;
        // Auto-detect anchor on the template
        await scanTemplateAnchor(dataUrl, canvas.width, canvas.height);
        // Force wait for next tick to ensure v-if="templateImage" renders the canvas wrapper
        nextTick(() => {
            refreshPreview();
        });
    }
}
async function scanTemplateAnchor(dataUrl, w, h) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h);
    if (code) {
        const loc = code.location;
        // Calculate bounding box of QR
        const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x);
        const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x);
        const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y);
        const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y);
        templateAnchor.value = {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY
        };
        backendAssignmentAnchor.value = templateAnchor.value;
        console.log('Template Anchor Found:', templateAnchor.value);
    }
    else {
        templateAnchor.value = null;
        backendAssignmentAnchor.value = null;
        console.log('No Anchor found on template page');
    }
}
function drawSetupPreview() {
    const canvas = setupCanvasRef.value;
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    if (templateImage.value) {
        const img = new Image();
        img.onload = () => {
            // Resize canvas to match image dimensions for accurate coordinate mapping
            canvas.width = img.width;
            canvas.height = img.height;
            templateSize.value = { width: img.width, height: img.height };
            ctx.drawImage(img, 0, 0);
            // Draw Template Anchor
            if (templateAnchor.value) {
                const a = templateAnchor.value;
                ctx.save();
                ctx.strokeStyle = '#10b981'; // Emerald 500
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(a.x, a.y, a.w, a.h);
                // Crosshair
                const cx = a.x + a.w / 2;
                const cy = a.y + a.h / 2;
                ctx.beginPath();
                ctx.moveTo(cx - 10, cy);
                ctx.lineTo(cx + 10, cy);
                ctx.moveTo(cx, cy - 10);
                ctx.lineTo(cx, cy + 10);
                ctx.stroke();
                ctx.fillStyle = '#10b981';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('基准锚点', a.x, a.y - 5);
                ctx.restore();
            }
            drawROIs(ctx);
        };
        img.src = templateImage.value;
    }
    else {
        // Default A4-ish ratio placeholder
        canvas.width = 595 * 1.5;
        canvas.height = 842 * 1.5;
        templateSize.value = { width: canvas.width, height: canvas.height };
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw placeholder text
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '20px sans-serif';
        ctx.fillText('请上传标准答案卷 (PDF) 以校验', 100, 100);
        drawROIs(ctx);
    }
    // Draw temporary selection box or Grid Preview
    if (tempRect.value) {
        if (showGridModal.value) {
            // --- LIVE GRID PREVIEW ---
            const count = Math.max(1, gridForm.endLabel - gridForm.startLabel + 1);
            const cols = Math.max(1, gridForm.cols);
            const rows = Math.ceil(count / cols);
            const cellW = tempRect.value.w / cols;
            const cellH = tempRect.value.h / rows;
            ctx.save();
            // Outer Box
            ctx.strokeStyle = '#f97316'; // Orange 500
            ctx.lineWidth = 3;
            ctx.strokeRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h);
            // Inner Cells
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.fillStyle = 'rgba(249, 115, 22, 0.1)';
            for (let i = 0; i < count; i++) {
                const colIdx = i % cols;
                const rowIdx = Math.floor(i / cols);
                const cx = tempRect.value.x + colIdx * cellW;
                const cy = tempRect.value.y + rowIdx * cellH;
                ctx.strokeRect(cx, cy, cellW, cellH);
                ctx.fillRect(cx, cy, cellW, cellH);
                // Preview Number
                ctx.fillStyle = '#f97316';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(`${gridForm.startLabel + i}`, cx + 4, cy + 14);
                ctx.fillStyle = 'rgba(249, 115, 22, 0.1)'; // Reset fill
            }
            ctx.restore();
        }
        else {
            // --- NORMAL DRAG PREVIEW ---
            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(tempRect.value.x, tempRect.value.y, tempRect.value.w, tempRect.value.h);
            ctx.restore();
        }
    }
}
function drawROIs(ctx) {
    assignmentConfig.value.forEach((q, idx) => {
        // Only draw ROIs for current page. If 'page' is missing, assume page 1.
        const qPage = q.page || 1;
        if (qPage !== currentPreviewPage.value)
            return;
        // Box
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(q.x, q.y, q.w, q.h);
        // Fill slightly
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(q.x, q.y, q.w, q.h);
        // Style based on selection
        const isSelected = selectedQuestionId.value === q.id;
        // Box
        ctx.strokeStyle = isSelected ? '#2563eb' : '#3b82f6';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.setLineDash([]); // Solid line for ROI
        // Draw ROI
        ctx.strokeRect(q.x, q.y, q.w, q.h);
        ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(59, 130, 246, 0.05)';
        ctx.fillRect(q.x, q.y, q.w, q.h);
        // Resize Handle (Bottom-Right)
        if (isSelected) {
            const handleSize = 10;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.fillRect(q.x + q.w - handleSize / 2, q.y + q.h - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(q.x + q.w - handleSize / 2, q.y + q.h - handleSize / 2, handleSize, handleSize);
        }
        // Label
        ctx.fillStyle = isSelected ? '#2563eb' : '#3b82f6';
        ctx.font = isSelected ? 'bold 18px Arial' : 'bold 16px Arial';
        ctx.fillText(`${q.label}`, q.x, q.y - 8);
        // Answer Key Tag (Enhanced Visualization)
        if (q.correctAnswer) {
            const ansText = `Ref: ${q.correctAnswer}`;
            ctx.font = '12px Arial';
            const metrics = ctx.measureText(ansText);
            const tagW = metrics.width + 12;
            const tagH = 20;
            // Draw tag background
            ctx.fillStyle = isSelected ? '#1d4ed8' : '#3b82f6';
            ctx.beginPath();
            ctx.roundRect(q.x + q.w - tagW, q.y + q.h + 4, tagW, tagH, 4);
            ctx.fill();
            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ansText, q.x + q.w - tagW + 6, q.y + q.h + 18);
        }
        // Visualize Score Position
        const scoreX = q.score_x !== undefined ? q.score_x : (q.x + q.w - 40);
        const scoreY = q.score_y !== undefined ? q.score_y : (q.y + 10);
        // Draw Score Mark Preview
        ctx.save();
        // Determine style based on selection
        if (isSelected) {
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        }
        else {
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            ctx.lineWidth = 1;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
        }
        // Draw Score Box Area
        ctx.strokeRect(scoreX, scoreY, 60, 40);
        ctx.fillRect(scoreX, scoreY, 60, 40);
        // Simulate the actual marking (Tick + Score) to help user align
        const markSize = 20;
        const markOriginX = scoreX;
        const markOriginY = scoreY;
        // Draw Ghost Tick
        ctx.beginPath();
        ctx.strokeStyle = isSelected ? '#10b981' : 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]); // Solid tick
        ctx.moveTo(markOriginX, markOriginY + markSize / 2);
        ctx.lineTo(markOriginX + markSize / 3, markOriginY + markSize);
        ctx.lineTo(markOriginX + markSize, markOriginY - markSize / 4);
        ctx.stroke();
        // Draw Ghost Score Text
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.6)';
        ctx.fillText(`+${q.maxPoints}`, markOriginX + markSize + 8, markOriginY + markSize - 2);
        // Drag Handle Hint
        if (isSelected) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ef4444';
            ctx.fillText('拖动调整位置', scoreX, scoreY - 6);
        }
        ctx.restore();
    });
}
// Draw initial state on mount
onMounted(() => {
    nextTick(refreshPreview);
    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Only if in setup tab and something is selected
        if (activeTab.value === 'setup' && selectedQuestionId.value) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Prevent backspace from navigating back if focused on body
                if (document.activeElement === document.body) {
                    e.preventDefault();
                    const idx = assignmentConfig.value.findIndex(q => q.id === selectedQuestionId.value);
                    if (idx !== -1) {
                        removeQuestion(idx);
                        selectedQuestionId.value = null;
                        drawSetupPreview();
                    }
                }
            }
        }
    });
});
// Data Store
const classPapers = ref([]);
const selectedPaperId = ref(null);
const selectedPaper = computed(() => classPapers.value.find(p => p.id === selectedPaperId.value));
const fileInput = ref(null);
const canvasRef = ref(null);
// --- Logic: Navigation ---
function navigateTo(tab) {
    activeTab.value = tab;
}
function returnToPortal() {
    if (router) {
        router.push('/');
    }
    else {
        window.location.href = '/';
    }
}
// --- Logic: Configuration ---
function addQuestion() {
    const last = assignmentConfig.value[assignmentConfig.value.length - 1];
    const newId = `q${assignmentConfig.value.length + 1}`;
    const newY = last ? last.y + last.h + 20 : 100;
    assignmentConfig.value.push({
        id: newId,
        label: `第${assignmentConfig.value.length + 1}题`,
        type: 'subjective',
        x: 50, y: newY, w: 600, h: 100,
        page: currentPreviewPage.value,
        correctAnswer: '', maxPoints: 5
    });
}
function removeQuestion(index) {
    assignmentConfig.value.splice(index, 1);
}
function addEmptyQuestion() {
    const nextNum = assignmentConfig.value.length + 1;
    const newQ = {
        id: crypto.randomUUID(),
        label: `第${nextNum}题`,
        type: 'subjective',
        x: 0, y: 0, w: 0, h: 0, // Invalid coords
        page: currentPreviewPage.value,
        correctAnswer: '',
        maxPoints: 5
    };
    assignmentConfig.value.push(newQ);
    selectedQuestionId.value = newQ.id; // Select it so user can set properties
    configJson.value = JSON.stringify(assignmentConfig.value, null, 2);
}
// --- Logic: File Processing ---
function onFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0)
        handleFile(files[0]);
}
function onDrop(e) {
    dragging.value = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0)
        handleFile(files[0]);
}
async function handleFile(file) {
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
        alert('仅支持 PDF 或图片文件');
        return;
    }
    processingStatus.value = '正在解析文件...';
    classPapers.value = [];
    activeTab.value = 'list';
    if (file.type === 'application/pdf') {
        await processPDF(file);
    }
    else {
        // Image flow
        const reader = new FileReader();
        reader.onload = async (e) => {
            await processSinglePage(e.target?.result, 1);
            processingStatus.value = '处理完成';
        };
        reader.readAsDataURL(file);
    }
}
// --- Logic: File Processing ---
// Session state for multi-page combining
let currentSessionPaper = null;
let currentSessionAnchor = null;
async function processPDF(file) {
    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(buffer).promise;
        processingTotal.value = pdf.numPages;
        // Reset session
        currentSessionPaper = null;
        currentSessionAnchor = null;
        for (let i = 1; i <= pdf.numPages; i++) {
            processingStatus.value = `正在处理第 ${i} / ${pdf.numPages} 页...`;
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                await page.render({ canvasContext: ctx, viewport }).promise;
                // We pass 'i' as the absolute page index in the PDF
                // But for grading config, we need to know: is this Page 1 or Page 2 of the TEMPLATE?
                // Assumption: The student PDF follows the same page structure as the Template PDF.
                // e.g. Student PDF Page 1 = Template Page 1
                //      Student PDF Page 2 = Template Page 2
                //      Student PDF Page 3 = Template Page 1 (Next student)
                // This dynamic mapping is tricky. 
                // For now, let's implement the "QR Code Reset" logic inside processSinglePage.
                await processSinglePage(canvas.toDataURL('image/jpeg', 0.8), i);
            }
            processingProgress.value = i;
        }
        processingStatus.value = '全班阅卷完成';
    }
    catch (e) {
        alert('PDF 解析失败: ' + e.message);
        activeTab.value = 'upload';
    }
}
async function processSinglePage(dataUrl, globalPageIndex) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);
    // 1. Scan QR to detect Student Identity (Start of a new paper)
    let detectedInfo = null;
    let studentAnchor = null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                // Extract content
                try {
                    const parsed = JSON.parse(code.data);
                    detectedInfo = { name: parsed.name, id: parsed.id };
                }
                catch {
                    detectedInfo = { name: '未知', id: code.data };
                }
                // Extract Geometry for Anchor
                const loc = code.location;
                const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x);
                const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x);
                const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y);
                const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y);
                studentAnchor = {
                    x: minX,
                    y: minY,
                    w: maxX - minX,
                    h: maxY - minY
                };
                // Calculate Transform for Session
                if (templateAnchor.value) {
                    const ta = templateAnchor.value;
                    const sa = studentAnchor;
                    const scaleX = sa.w / ta.w;
                    const scaleY = sa.h / ta.h;
                    const offsetX = sa.x - (ta.x * scaleX);
                    const offsetY = sa.y - (ta.y * scaleY);
                    currentSessionAnchor = { scaleX, scaleY, offsetX, offsetY };
                    console.log(`[Session Anchor] Updated from P${globalPageIndex}:`, currentSessionAnchor);
                }
            }
        }
    }
    catch (e) {
        console.error(e);
    }
    // 2. Logic: New Student vs Continuation
    let paper;
    let templatePageIndex = 1; // Which page of the config should we apply?
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
        };
        classPapers.value.push(paper);
        currentSessionPaper = paper;
        templatePageIndex = 1;
    }
    else {
        // No QR -> Continuation of current session
        if (currentSessionPaper) {
            paper = currentSessionPaper;
            // Assume sequential page
            templatePageIndex = (paper.pages.length || 1) + 1;
            // Add this page to the session
            paper.pages.push({ pageIndex: templatePageIndex, image: dataUrl });
        }
        else {
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
            };
            classPapers.value.push(paper);
            currentSessionPaper = paper; // Start a session anyway to catch subsequent pages
            templatePageIndex = 1; // Treat as P1
        }
    }
    if (paper.status !== 'error') {
        console.log(`[Process] Grading paper ${paper.id} (Student: ${paper.studentName}) using Template Page ${templatePageIndex}`);
        await gradePaper(paper, img, templatePageIndex, studentAnchor);
    }
}
async function gradePaper(paper, img, pageIndex, studentAnchor) {
    // Filter config for THIS page
    const pageQuestions = assignmentConfig.value.filter(q => (q.page || 1) === pageIndex);
    if (pageQuestions.length === 0)
        return;
    // --- Calculate Transform Matrix ---
    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;
    if (studentAnchor && templateAnchor.value) {
        const ta = templateAnchor.value;
        const sa = studentAnchor;
        scaleX = sa.w / ta.w;
        scaleY = sa.h / ta.h;
        offsetX = sa.x - (ta.x * scaleX);
        offsetY = sa.y - (ta.y * scaleY);
    }
    else if (currentSessionAnchor) {
        scaleX = currentSessionAnchor.scaleX;
        scaleY = currentSessionAnchor.scaleY;
        offsetX = currentSessionAnchor.offsetX;
        offsetY = currentSessionAnchor.offsetY;
    }
    // Parallel Processing with Concurrency Limit
    const CONCURRENCY = 3;
    let completed = 0;
    const choiceQs = pageQuestions.filter((q) => q.type === 'single_choice' || q.type === 'multiple_choice');
    const tfQs = pageQuestions.filter((q) => q.type === 'true_false');
    const fillQs = pageQuestions.filter((q) => q.type === 'fill_in_blank');
    const subjectiveQs = pageQuestions.filter((q) => q.type === 'subjective');
    // Batch objective questions to avoid per-question API rate limiting.
    const MAX_BATCH_ITEMS = 12;
    const runObjectiveBatch = async (group, label) => {
        for (let i = 0; i < group.length; i += MAX_BATCH_ITEMS) {
            const chunk = group.slice(i, i + MAX_BATCH_ITEMS);
            const batch = await batchGradeObjectiveQuestions(paper, chunk, img, scaleX, scaleY, offsetX, offsetY, label);
            for (const r of batch) {
                paper.results.push(r);
                paper.score += r.score;
            }
            completed += chunk.length;
            processingStatus.value = `正在批改 P${pageIndex}... (${Math.min(completed, pageQuestions.length)}/${pageQuestions.length})`;
        }
    };
    await runObjectiveBatch(choiceQs, 'choice');
    await runObjectiveBatch(tfQs, 'true_false');
    await runObjectiveBatch(fillQs, 'fill');
    // Helper to process a single question
    const processQuestion = async (config) => {
        // Apply Transform
        const finalX = (config.x * scaleX) + offsetX;
        const finalY = (config.y * scaleY) + offsetY;
        const finalW = config.w * scaleX;
        const finalH = config.h * scaleY;
        // 1. Crop Image (Client-side)
        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
        const cropBase64 = canvas.toDataURL('image/jpeg', 0.85);
        const base64Content = cropBase64.split(',')[1];
        let score = 0;
        let studentAnswer = '';
        let feedback = '';
        try {
            // 2. OCR (Call BFF)
            // Try OCR first. If it fails, we will catch it and try to proceed with AI Grading (VLM) directly.
            let ocrText = '';
            try {
                const uploadRes = await axios.post('/api/ocr/upload', {
                    fileName: `q_${config.id}_p${paper.studentId}.jpg`,
                    contentBase64: base64Content,
                    scene: 'lens'
                }, { headers: { Authorization: `Bearer ${token.value}` } });
                const taskId = uploadRes.data.taskId;
                // Poll for OCR
                let attempts = 0;
                while (attempts < 15) {
                    await new Promise(r => setTimeout(r, 600));
                    const statusRes = await axios.get(`/api/ocr/status/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } });
                    if (statusRes.data.status === 'done') {
                        const resRes = await axios.get(`/api/ocr/result/${taskId}`, { headers: { Authorization: `Bearer ${token.value}` } });
                        ocrText = (resRes.data.result || '').trim();
                        break;
                    }
                    attempts++;
                }
                studentAnswer = ocrText;
            }
            catch (ocrErr) {
                console.warn('OCR Failed, attempting VLM fallback:', ocrErr.message);
                // Do not throw, continue to grading step
            }
            // 3. AI Grade (VLM or Text LLM)
            const gradeRes = await axios.post('/api/grading/grade-image', {
                imageBase64: base64Content,
                questionText: config.label + (config.gradingCriteria ? ` (评分标准: ${config.gradingCriteria})` : ''),
                correctAnswer: config.correctAnswer,
                maxPoints: config.maxPoints,
                ocrText: ocrText
            }, { headers: { Authorization: `Bearer ${token.value}` } });
            score = gradeRes.data.score;
            feedback = gradeRes.data.feedback;
            if (gradeRes.data.studentAnswer && gradeRes.data.studentAnswer.length > ocrText.length) {
                studentAnswer = gradeRes.data.studentAnswer;
            }
        }
        catch (err) {
            console.error('Grading Error:', err);
            feedback = '批改失败: ' + err.message;
        }
        completed++;
        processingStatus.value = `正在批改 P${pageIndex}... (${completed}/${pageQuestions.length})`;
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
        };
    };
    // Execute subjective questions with concurrency limit
    const queue = [...subjectiveQs];
    const running = [];
    while (queue.length > 0 || running.length > 0) {
        while (queue.length > 0 && running.length < CONCURRENCY) {
            const config = queue.shift();
            const p = processQuestion(config).then(res => {
                if (res) {
                    paper.results.push(res);
                    paper.score += res.score;
                }
                running.splice(running.indexOf(p), 1);
            });
            running.push(p);
        }
        if (running.length > 0) {
            await Promise.race(running);
        }
    }
    paper.status = 'done';
}
function safeJsonParse(value) {
    if (!value)
        return null;
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
async function savePaperToBackend(paper) {
    if (!token.value) {
        alert('请先登录后再保存到后端');
        return;
    }
    if (!backendAssignmentId.value) {
        alert('请先在「作业配置」中创建/填写后端作业 ID');
        return;
    }
    if (paper.backendSubmissionId)
        return;
    if (!paper.image) {
        alert('当前试卷缺少图像内容，无法保存');
        return;
    }
    paper.saving = true;
    paper.saveError = undefined;
    try {
        const assetTitle = `${backendAssignmentName.value || '阅卷作业'}-${paper.studentId}-P${paper.pageIndex}`;
        const asset = await apiJson('/api/assets', {
            method: 'POST',
            body: JSON.stringify({
                title: assetTitle,
                type: 'image',
                contentUrl: paper.image,
                visibility: 'PRIVATE',
                tags: ['quiz-grading', 'paper']
            })
        });
        const configByLabel = new Map(assignmentConfig.value.map((q) => [q.label, q]));
        let objectiveScore = 0;
        let subjectiveScore = 0;
        for (const r of paper.results) {
            const cfg = configByLabel.get(r.questionId);
            if (cfg?.type === 'subjective')
                subjectiveScore += r.score;
            else
                objectiveScore += r.score;
        }
        const totalScore = objectiveScore + subjectiveScore;
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
        };
        const submission = await apiJson('/api/grading/submissions', {
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
        });
        paper.backendSubmissionId = submission.id;
        paper.payloadAssetId = asset.id;
    }
    catch (e) {
        paper.saveError = e.message || '保存失败';
        alert(paper.saveError);
    }
    finally {
        paper.saving = false;
    }
}
async function saveAllToBackend() {
    if (backendSavingAll.value)
        return;
    backendSavingAll.value = true;
    try {
        const targets = classPapers.value.filter((p) => p.status === 'done' && !p.backendSubmissionId);
        for (const p of targets) {
            await savePaperToBackend(p);
        }
        if (targets.length > 0) {
            alert(`已保存 ${targets.length} 份到后端`);
        }
    }
    finally {
        backendSavingAll.value = false;
    }
}
async function loadSubmissionsFromBackend() {
    if (!token.value) {
        alert('请先登录后再从后端加载');
        return;
    }
    if (!backendAssignmentId.value) {
        alert('请先在「作业配置」中创建/填写后端作业 ID');
        return;
    }
    backendLoadingSubmissions.value = true;
    try {
        const items = await apiJson(`/api/grading/submissions?assignmentId=${encodeURIComponent(backendAssignmentId.value)}`);
        classPapers.value = items.map((s, idx) => {
            const details = safeJsonParse(s?.grading?.details);
            const payloadUrl = String(s?.payloadUrl ?? '');
            const payloadAssetId = payloadUrl.startsWith('asset:') ? payloadUrl.slice('asset:'.length) : undefined;
            const status = String(s?.status ?? '').toUpperCase();
            const normalizedStatus = status === 'DONE' ? 'done' : status === 'PROCESSING' ? 'processing' : status === 'ERROR' ? 'error' : 'pending';
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
            };
        });
        activeTab.value = 'list';
        processingStatus.value = `已从后端加载 ${classPapers.value.length} 份提交`;
    }
    catch (e) {
        alert(e.message || '从后端加载失败');
    }
    finally {
        backendLoadingSubmissions.value = false;
    }
}
async function loadImageFromAsset(assetId) {
    const asset = await apiJson(`/api/assets/${assetId}`);
    const candidate = (asset?.contentUrl || asset?.content);
    if (candidate && typeof candidate === 'string') {
        const url = candidate.trim();
        if (url.startsWith('data:'))
            return url;
        const res = await fetch(url, { headers: url.startsWith('/') ? authHeaders() : undefined });
        if (!res.ok)
            throw new Error(`下载资源失败 (${res.status})`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }
    throw new Error('资源不包含可用的 contentUrl/content');
}
// --- Logic: Details View ---
const currentDetailPage = ref(1);
async function viewPaper(paper) {
    selectedPaperId.value = paper.id;
    activeTab.value = 'detail';
    currentDetailPage.value = 1; // Reset to page 1
    if (!paper.pages || paper.pages.length === 0) {
        paper.pages = [{ pageIndex: 1, image: paper.image || '' }];
    }
    if (!paper.image && paper.payloadAssetId) {
        try {
            const url = await loadImageFromAsset(paper.payloadAssetId);
            paper.image = url;
            if (paper.pages.length === 0)
                paper.pages = [{ pageIndex: 1, image: url }];
            else
                paper.pages[0].image = paper.pages[0].image || url;
        }
        catch (e) {
            // Ignore; user can still view metadata/results.
        }
    }
    refreshDetailView();
}
function refreshDetailView() {
    const paper = selectedPaper.value;
    if (!paper)
        return;
    nextTick(() => {
        if (canvasRef.value) {
            const ctx = canvasRef.value.getContext('2d');
            // Find image for current page
            const pageData = paper.pages.find(p => p.pageIndex === currentDetailPage.value);
            // Fallback to cover if not found (should not happen if logic is correct)
            const imgSrc = pageData ? pageData.image : paper.image;
            const img = new Image();
            img.onload = () => {
                if (!ctx)
                    return;
                canvasRef.value.width = img.width;
                canvasRef.value.height = img.height;
                ctx.drawImage(img, 0, 0);
                // Draw overlays for THIS page only
                ctx.font = 'bold 24px Arial';
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                // Filter results that belong to this template page
                // We need to map result -> question -> page
                // But 'GradingResult' doesn't store pageIndex directly.
                // It stores 'questionId' (which is the label).
                // We can look up the question in 'assignmentConfig'.
                // Wait, 'assignmentConfig' might have changed since grading. 
                // Ideally 'GradingResult' should store 'pageIndex'.
                // But for now, let's lookup.
                const configMap = new Map(assignmentConfig.value.map(q => [q.label, q]));
                paper.results.forEach(r => {
                    const qConfig = configMap.get(r.questionId);
                    if (!qConfig)
                        return;
                    // Check if this question belongs to current detail page
                    if ((qConfig.page || 1) !== currentDetailPage.value)
                        return;
                    const isCorrect = r.score > 0;
                    const color = isCorrect ? '#10b981' : '#ef4444';
                    ctx.strokeStyle = color;
                    ctx.fillStyle = color;
                    ctx.lineWidth = 3;
                    // Draw Box around Answer
                    ctx.strokeRect(r.x, r.y, r.w, r.h);
                    // --- Draw Mark & Score ---
                    const markOriginX = r.score_x !== undefined ? r.score_x : (r.x + r.w - 50);
                    const markOriginY = r.score_y !== undefined ? r.score_y : (r.y + 10);
                    // 1. Draw Tick / Cross
                    const markSize = 24;
                    ctx.beginPath();
                    if (isCorrect) {
                        // Checkmark (√)
                        ctx.moveTo(markOriginX, markOriginY + markSize / 2);
                        ctx.lineTo(markOriginX + markSize / 3, markOriginY + markSize);
                        ctx.lineTo(markOriginX + markSize, markOriginY - markSize / 4);
                    }
                    else {
                        // Cross (×)
                        ctx.moveTo(markOriginX, markOriginY);
                        ctx.lineTo(markOriginX + markSize, markOriginY + markSize);
                        ctx.moveTo(markOriginX + markSize, markOriginY);
                        ctx.lineTo(markOriginX, markOriginY + markSize);
                    }
                    ctx.stroke();
                    // 2. Draw Score Number
                    ctx.font = 'bold 24px Arial';
                    const scoreText = `${r.score > 0 ? '+' : ''}${r.score}`;
                    ctx.fillStyle = color;
                    ctx.fillText(scoreText, markOriginX + markSize + 8, markOriginY + markSize - 2);
                });
            };
            img.src = imgSrc;
        }
    });
}
// --- Logic: Demo ---
async function loadDemo() {
    activeTab.value = 'list';
    processingStatus.value = '加载演示数据...';
    classPapers.value = [];
    const demoData = [
        { name: '张三', id: 'S001', score: 95 },
        { name: '李四', id: 'S002', score: 88 },
        { name: '王五', id: 'S003', score: 60 },
        { name: '赵六', id: 'S004', score: 0, error: '缺考/空白卷' },
    ];
    for (let i = 0; i < demoData.length; i++) {
        await new Promise(r => setTimeout(r, 500));
        const d = demoData[i];
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
        });
    }
    processingStatus.value = '演示完成';
}
function exportData() {
    const data = classPapers.value.map(p => {
        const row = {
            '姓名': p.studentName,
            '学号': p.studentId,
            '总分': p.score,
            '状态': p.status === 'done' ? '完成' : (p.status === 'error' ? '异常' : '处理中'),
        };
        // Add per-question details
        p.results.forEach(r => {
            row[`${r.questionId} 得分`] = r.score;
            row[`${r.questionId} 学生作答(OCR)`] = r.studentAnswer;
            row[`${r.questionId} 评语`] = r.feedback;
        });
        return row;
    });
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩单');
    XLSX.writeFile(wb, `class_grades_${timestamp}.xlsx`);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-[100dvh] w-full bg-slate-50 flex flex-col font-sans overflow-hidden text-slate-800" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:camera-metering-center",
    width: "20",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:camera-metering-center",
    width: "20",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "font-bold text-slate-800 leading-tight" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-xs text-slate-500" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.returnToPortal) },
    ...{ class: "text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:logout",
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:logout",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-1 flex overflow-hidden relative z-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 overflow-y-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "p-4 space-y-1" },
});
for (const [tab] of __VLS_getVForSourceType((['setup', 'upload', 'list']))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.navigateTo(tab);
            } },
        key: (tab),
        ...{ class: "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all" },
        ...{ class: (__VLS_ctx.activeTab === tab || (tab === 'list' && __VLS_ctx.activeTab === 'detail')
                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                : 'text-slate-600 hover:bg-slate-50') },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: (tab === 'setup' ? 'mdi:cog-box' : tab === 'upload' ? 'mdi:cloud-upload' : 'mdi:format-list-bulleted'),
        width: "18",
    }));
    const __VLS_10 = __VLS_9({
        icon: (tab === 'setup' ? 'mdi:cog-box' : tab === 'upload' ? 'mdi:cloud-upload' : 'mdi:format-list-bulleted'),
        width: "18",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (tab === 'setup' ? '1. 作业配置' : tab === 'upload' ? '2. 试卷上传' : '3. 阅卷结果');
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mt-auto p-4 border-t border-slate-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "bg-slate-50 rounded-lg p-3 text-xs text-slate-500" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-between mb-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.processingProgress);
(__VLS_ctx.processingTotal || '-');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-1.5 bg-slate-200 rounded-full overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-full bg-blue-500 transition-all duration-300" },
    ...{ style: ({ width: __VLS_ctx.processingTotal ? (__VLS_ctx.processingProgress / __VLS_ctx.processingTotal) * 100 + '%' : '0%' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "flex-1 bg-[#F8FAFC] flex flex-col min-w-0 overflow-hidden relative z-10" },
});
if (__VLS_ctx.activeTab === 'setup') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col h-full p-4 gap-4 animate-fade-in overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-4 flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col relative group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "text-[10px] text-slate-400 font-bold uppercase tracking-wider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.recordBackendAssignmentNameHistory) },
        value: (__VLS_ctx.backendAssignmentName),
        type: "text",
        list: "name-history",
        ...{ class: "text-sm font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors w-48" },
        placeholder: "未命名作业",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.datalist, __VLS_intrinsicElements.datalist)({
        id: "name-history",
    });
    for (const [n] of __VLS_getVForSourceType((__VLS_ctx.backendAssignmentNameHistory))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (n),
            value: (n),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-px h-8 bg-slate-100" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "text-[10px] text-slate-400 font-bold uppercase tracking-wider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.backendAssignmentSubject),
        type: "text",
        list: "subject-list",
        ...{ class: "text-sm font-medium text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors w-24" },
        placeholder: "科目",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.datalist, __VLS_intrinsicElements.datalist)({
        id: "subject-list",
    });
    for (const [s] of __VLS_getVForSourceType((__VLS_ctx.commonSubjects))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (s),
            value: (s),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-px h-8 bg-slate-100" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "text-[10px] text-slate-400 font-bold uppercase tracking-wider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1.5" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "w-2 h-2 rounded-full" },
        ...{ class: (__VLS_ctx.backendAssignmentId ? 'bg-green-500 shadow-green-500/50 shadow-sm' : 'bg-slate-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs font-bold" },
        ...{ class: (__VLS_ctx.backendAssignmentId ? 'text-green-600' : 'text-slate-500') },
    });
    (__VLS_ctx.backendAssignmentId ? '云端同步' : '本地模式');
    if (__VLS_ctx.backendAssignmentId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (__VLS_ctx.backendAssignmentId),
            type: "text",
            ...{ class: "text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-32 focus:w-48 transition-all outline-none" },
            placeholder: "Backend ID",
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.exportJsonConfig) },
        ...{ class: "flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all" },
    });
    const __VLS_12 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        icon: "mdi:download-outline",
    }));
    const __VLS_14 = __VLS_13({
        icon: "mdi:download-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all cursor-pointer" },
    });
    const __VLS_16 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        icon: "mdi:upload-outline",
    }));
    const __VLS_18 = __VLS_17({
        icon: "mdi:upload-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.importJsonConfig) },
        type: "file",
        ...{ class: "hidden" },
        accept: ".json",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-px h-6 bg-slate-200 mx-1" },
    });
    if (!__VLS_ctx.backendAssignmentId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.createBackendAssignment) },
            ...{ class: "flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all" },
            disabled: (__VLS_ctx.backendBusy),
        });
        if (__VLS_ctx.backendBusy) {
            const __VLS_20 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
                icon: "mdi:loading",
                ...{ class: "animate-spin" },
            }));
            const __VLS_22 = __VLS_21({
                icon: "mdi:loading",
                ...{ class: "animate-spin" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        }
        else {
            const __VLS_24 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
                icon: "mdi:cloud-upload-outline",
            }));
            const __VLS_26 = __VLS_25({
                icon: "mdi:cloud-upload-outline",
            }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.syncAnswerKeysToBackend) },
            ...{ class: "flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-md shadow-green-500/20 transition-all" },
            disabled: (__VLS_ctx.backendBusy),
        });
        if (__VLS_ctx.backendBusy) {
            const __VLS_28 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
                icon: "mdi:loading",
                ...{ class: "animate-spin" },
            }));
            const __VLS_30 = __VLS_29({
                icon: "mdi:loading",
                ...{ class: "animate-spin" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        }
        else {
            const __VLS_32 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
                icon: "mdi:sync",
            }));
            const __VLS_34 = __VLS_33({
                icon: "mdi:sync",
            }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-white rounded-2xl border border-slate-200 shadow-sm p-4 shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "font-bold text-slate-800 text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs text-slate-500 mt-0.5" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-slate-50 rounded-xl border border-slate-100 p-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs font-bold text-slate-600" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.objectiveScoringSettings.multiChoiceMode),
        ...{ class: "mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "all_or_nothing",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "partial_missing_no_wrong",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-2 text-[11px] text-slate-500 leading-relaxed" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-slate-50 rounded-xl border border-slate-100 p-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs font-bold text-slate-600" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-2 flex items-center gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-[11px] text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        step: "0.01",
        min: "0",
        ...{ class: "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" },
    });
    (__VLS_ctx.objectiveScoringSettings.fillNumericTolerance);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "flex items-center gap-2 text-sm text-slate-600 select-none mt-5" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "checkbox",
        ...{ class: "rounded border-slate-300" },
    });
    (__VLS_ctx.objectiveScoringSettings.fillIgnoreUnits);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs font-medium" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-2 text-[11px] text-slate-500 leading-relaxed" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-slate-50 rounded-xl border border-slate-100 p-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs font-bold text-slate-600" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.objectiveScoringSettings.fillSynonymsText),
        rows: "4",
        ...{ class: "mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 font-mono" },
        placeholder: "每行一条：A=B&#10;例如：√=对&#10;例如：正确=对",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-2 text-[11px] text-slate-500 leading-relaxed" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 flex gap-6 min-h-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-slate-700" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.addEmptyQuestion) },
        ...{ class: "p-1 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded shadow-sm transition-all" },
        title: "添加空题目",
    });
    const __VLS_36 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        icon: "mdi:plus",
    }));
    const __VLS_38 = __VLS_37({
        icon: "mdi:plus",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2" },
    });
    for (const [q, idx] of __VLS_getVForSourceType((__VLS_ctx.assignmentConfig))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    __VLS_ctx.selectedQuestionId = q.id;
                    __VLS_ctx.drawSetupPreview();
                } },
            key: (q.id),
            ...{ class: "p-3 rounded-xl border transition-all cursor-pointer group relative" },
            ...{ class: (__VLS_ctx.selectedQuestionId === q.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:border-blue-200') },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between items-start" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-bold text-sm" },
            ...{ class: (__VLS_ctx.selectedQuestionId === q.id ? 'text-blue-700' : 'text-slate-700') },
        });
        (q.label);
        if (q.w > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500" },
            });
            (q.page || 1);
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold animate-pulse" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-xs text-slate-400 mt-1 flex gap-3 items-center" },
        });
        if (q.w > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (q.maxPoints);
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'setup'))
                            return;
                        if (!!(q.w > 0))
                            return;
                        __VLS_ctx.startMapping(q.id);
                    } },
                ...{ class: "px-2 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 font-bold transition-colors" },
            });
        }
        if (q.w > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "truncate max-w-[120px]" },
                title: "参考答案",
            });
            (q.correctAnswer || '-');
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    __VLS_ctx.removeQuestion(idx);
                } },
            ...{ class: "absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all" },
            title: "删除",
        });
        const __VLS_40 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            icon: "mdi:trash-can-outline",
            width: "16",
        }));
        const __VLS_42 = __VLS_41({
            icon: "mdi:trash-can-outline",
            width: "16",
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    if (__VLS_ctx.assignmentConfig.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-center py-8 text-slate-400 text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs mt-1" },
        });
    }
    if (__VLS_ctx.activeQuestion) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-3 animate-slide-up" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs font-bold text-slate-500 uppercase" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!(__VLS_ctx.activeQuestion))
                        return;
                    __VLS_ctx.selectedQuestionId = null;
                    __VLS_ctx.drawSetupPreview();
                } },
            ...{ class: "text-xs text-slate-400 hover:text-slate-600" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-2 gap-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "block text-[10px] font-bold text-slate-400 mb-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (__VLS_ctx.activeQuestion.label),
            type: "text",
            ...{ class: "w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "block text-[10px] font-bold text-slate-400 mb-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "number",
            ...{ class: "w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
        });
        (__VLS_ctx.activeQuestion.maxPoints);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "block text-[10px] font-bold text-slate-400 mb-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.activeQuestion.type),
            ...{ class: "w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "single_choice",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "multiple_choice",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "true_false",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "fill_in_blank",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "subjective",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "block text-[10px] font-bold text-slate-400 mb-1" },
        });
        if (__VLS_ctx.activeQuestion.type === 'single_choice') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex gap-2" },
            });
            for (const [opt] of __VLS_getVForSourceType((['A', 'B', 'C', 'D']))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeTab === 'setup'))
                                return;
                            if (!(__VLS_ctx.activeQuestion))
                                return;
                            if (!(__VLS_ctx.activeQuestion.type === 'single_choice'))
                                return;
                            __VLS_ctx.activeQuestion.correctAnswer = opt;
                        } },
                    key: (opt),
                    ...{ class: "w-8 h-8 rounded-lg text-xs font-bold transition-all border" },
                    ...{ class: (__VLS_ctx.activeQuestion.correctAnswer === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400') },
                });
                (opt);
            }
        }
        else if (__VLS_ctx.activeQuestion.type === 'true_false') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex gap-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'setup'))
                            return;
                        if (!(__VLS_ctx.activeQuestion))
                            return;
                        if (!!(__VLS_ctx.activeQuestion.type === 'single_choice'))
                            return;
                        if (!(__VLS_ctx.activeQuestion.type === 'true_false'))
                            return;
                        __VLS_ctx.activeQuestion.correctAnswer = 'T';
                    } },
                ...{ class: "flex-1 py-1.5 rounded border text-xs font-bold" },
                ...{ class: (__VLS_ctx.activeQuestion.correctAnswer === 'T' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 border-slate-200') },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'setup'))
                            return;
                        if (!(__VLS_ctx.activeQuestion))
                            return;
                        if (!!(__VLS_ctx.activeQuestion.type === 'single_choice'))
                            return;
                        if (!(__VLS_ctx.activeQuestion.type === 'true_false'))
                            return;
                        __VLS_ctx.activeQuestion.correctAnswer = 'F';
                    } },
                ...{ class: "flex-1 py-1.5 rounded border text-xs font-bold" },
                ...{ class: (__VLS_ctx.activeQuestion.correctAnswer === 'F' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 border-slate-200') },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.activeQuestion.correctAnswer),
                type: "text",
                ...{ class: "w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
                placeholder: (__VLS_ctx.activeQuestion.type === 'multiple_choice' ? '如: ACD' : '输入答案...'),
            });
        }
        if (__VLS_ctx.activeQuestion.type === 'subjective') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "pt-2 border-t border-slate-200/50" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex items-center justify-between mb-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "block text-[10px] font-bold text-slate-400" },
            });
            const __VLS_44 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
                icon: "mdi:robot-excited-outline",
                ...{ class: "text-purple-500" },
                width: "14",
            }));
            const __VLS_46 = __VLS_45({
                icon: "mdi:robot-excited-outline",
                ...{ class: "text-purple-500" },
                width: "14",
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
                value: (__VLS_ctx.activeQuestion.gradingCriteria),
                rows: "3",
                ...{ class: "w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:border-purple-500 outline-none resize-none" },
                placeholder: "例如：答出'能量守恒'得2分；公式写对得3分...",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.simulateAIGrading) },
                ...{ class: "mt-2 w-full py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded text-xs font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all flex items-center justify-center gap-1" },
                disabled: (__VLS_ctx.isSimulating),
            });
            if (__VLS_ctx.isSimulating) {
                const __VLS_48 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
                    icon: "mdi:loading",
                    ...{ class: "animate-spin" },
                }));
                const __VLS_50 = __VLS_49({
                    icon: "mdi:loading",
                    ...{ class: "animate-spin" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_49));
            }
            else {
                const __VLS_52 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
                    icon: "mdi:play-circle-outline",
                }));
                const __VLS_54 = __VLS_53({
                    icon: "mdi:play-circle-outline",
                }, ...__VLS_functionalComponentArgsRest(__VLS_53));
            }
            (__VLS_ctx.isSimulating ? 'AI 分析中...' : '模拟 AI 批改');
            if (__VLS_ctx.simulationResult) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "mt-2 p-2 bg-purple-50 border border-purple-100 rounded text-[10px] text-purple-800 animate-fade-in" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
                (__VLS_ctx.simulationResult);
            }
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 bg-slate-200 rounded-2xl border border-slate-300 flex flex-col relative overflow-hidden shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-2 bg-white/90 backdrop-blur border-b border-slate-200 flex justify-between items-center z-10 shrink-0 gap-2" },
    });
    if (!__VLS_ctx.pendingMappingQuestionId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg border border-slate-200/50" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!(!__VLS_ctx.pendingMappingQuestionId))
                        return;
                    __VLS_ctx.activeTool = 'cursor';
                } },
            ...{ class: "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold transition-all" },
            ...{ class: (__VLS_ctx.activeTool === 'cursor' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50') },
            title: "选择/移动 (V)",
        });
        const __VLS_56 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            icon: "mdi:cursor-default-outline",
        }));
        const __VLS_58 = __VLS_57({
            icon: "mdi:cursor-default-outline",
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-px h-4 bg-slate-300 mx-1" },
        });
        for (const [tool] of __VLS_getVForSourceType(([
            { id: 'single_choice', label: '单选', icon: 'mdi:radiobox-marked' },
            { id: 'multiple_choice', label: '多选', icon: 'mdi:checkbox-marked-outline' },
            { id: 'omr_grid', label: '批量网格', icon: 'mdi:grid' },
            { id: 'true_false', label: '判断', icon: 'mdi:check-circle-outline' },
            { id: 'fill_in_blank', label: '填空', icon: 'mdi:form-textbox' },
            { id: 'subjective', label: '主观', icon: 'mdi:text-box-edit-outline' }
        ]))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'setup'))
                            return;
                        if (!(!__VLS_ctx.pendingMappingQuestionId))
                            return;
                        __VLS_ctx.activeTool = tool.id;
                        __VLS_ctx.selectedQuestionId = null;
                    } },
                key: (tool.id),
                ...{ class: "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all" },
                ...{ class: (__VLS_ctx.activeTool === tool.id ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50') },
            });
            const __VLS_60 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
                icon: (tool.icon),
            }));
            const __VLS_62 = __VLS_61({
                icon: (tool.icon),
            }, ...__VLS_functionalComponentArgsRest(__VLS_61));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "hidden xl:inline" },
            });
            (tool.label);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-1 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold flex items-center justify-between animate-fade-in" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center gap-2" },
        });
        const __VLS_64 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            icon: "mdi:target",
            ...{ class: "animate-pulse" },
        }));
        const __VLS_66 = __VLS_65({
            icon: "mdi:target",
            ...{ class: "animate-pulse" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!!(!__VLS_ctx.pendingMappingQuestionId))
                        return;
                    __VLS_ctx.pendingMappingQuestionId = null;
                } },
            ...{ class: "text-amber-500 hover:text-amber-800" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center bg-slate-100 rounded-lg p-0.5 mr-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'setup'))
                    return;
                __VLS_ctx.zoomLevel = Math.max(0.2, __VLS_ctx.zoomLevel - 0.1);
            } },
        ...{ class: "p-1 text-slate-500 hover:text-blue-600 transition-colors" },
        title: "缩小",
    });
    const __VLS_68 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        icon: "mdi:magnify-minus-outline",
    }));
    const __VLS_70 = __VLS_69({
        icon: "mdi:magnify-minus-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-[10px] font-mono text-slate-600 px-1 min-w-[3rem] text-center" },
    });
    (Math.round(__VLS_ctx.zoomLevel * 100));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'setup'))
                    return;
                __VLS_ctx.zoomLevel = Math.min(3.0, __VLS_ctx.zoomLevel + 0.1);
            } },
        ...{ class: "p-1 text-slate-500 hover:text-blue-600 transition-colors" },
        title: "放大",
    });
    const __VLS_72 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        icon: "mdi:magnify-plus-outline",
    }));
    const __VLS_74 = __VLS_73({
        icon: "mdi:magnify-plus-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    if (__VLS_ctx.previewTotalPages > 1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center bg-slate-100 rounded-lg p-0.5 mr-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!(__VLS_ctx.previewTotalPages > 1))
                        return;
                    __VLS_ctx.changePreviewPage(-1);
                } },
            disabled: (__VLS_ctx.currentPreviewPage <= 1),
            ...{ class: "p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors" },
        });
        const __VLS_76 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
            icon: "mdi:chevron-left",
        }));
        const __VLS_78 = __VLS_77({
            icon: "mdi:chevron-left",
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-[10px] font-mono text-slate-600 px-1 min-w-[3rem] text-center" },
        });
        (__VLS_ctx.currentPreviewPage);
        (__VLS_ctx.previewTotalPages);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!(__VLS_ctx.previewTotalPages > 1))
                        return;
                    __VLS_ctx.changePreviewPage(1);
                } },
            disabled: (__VLS_ctx.currentPreviewPage >= __VLS_ctx.previewTotalPages),
            ...{ class: "p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors" },
        });
        const __VLS_80 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            icon: "mdi:chevron-right",
        }));
        const __VLS_82 = __VLS_81({
            icon: "mdi:chevron-right",
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    }
    if (__VLS_ctx.templateImage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 text-slate-600 text-xs font-medium rounded-lg cursor-pointer shadow-sm flex items-center gap-1 transition-all" },
        });
        const __VLS_84 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            icon: "mdi:image-refresh",
        }));
        const __VLS_86 = __VLS_85({
            icon: "mdi:image-refresh",
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.onTemplateFileSelect) },
            type: "file",
            ref: "templateFileInput",
            ...{ class: "hidden" },
            accept: "application/pdf,image/*",
        });
        /** @type {typeof __VLS_ctx.templateFileInput} */ ;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 w-full relative overflow-auto custom-scrollbar flex flex-col items-center justify-center p-4 bg-slate-200" },
    });
    if (__VLS_ctx.templateImage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "relative shadow-2xl bg-white border border-slate-200 cursor-crosshair transition-transform duration-200 ease-out origin-center" },
            ...{ style: ({ transform: `scale(${__VLS_ctx.zoomLevel})` }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
            ...{ onMousedown: (__VLS_ctx.onCanvasMouseDown) },
            ...{ onMousemove: (__VLS_ctx.onCanvasMouseMove) },
            ...{ onMouseup: (__VLS_ctx.onCanvasMouseUp) },
            ...{ onMouseleave: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!(__VLS_ctx.templateImage))
                        return;
                    __VLS_ctx.isDrawing = false;
                } },
            ref: "setupCanvasRef",
            ...{ class: "block max-w-full" },
        });
        /** @type {typeof __VLS_ctx.setupCanvasRef} */ ;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'setup'))
                        return;
                    if (!!(__VLS_ctx.templateImage))
                        return;
                    __VLS_ctx.templateFileInput?.click();
                } },
            ...{ class: "flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-400 rounded-xl bg-slate-100 hover:bg-white hover:border-blue-400 transition-all cursor-pointer group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-16 h-16 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mb-4 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors" },
        });
        const __VLS_88 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            icon: "mdi:file-document-outline",
            width: "32",
        }));
        const __VLS_90 = __VLS_89({
            icon: "mdi:file-document-outline",
            width: "32",
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-sm font-bold text-slate-600 group-hover:text-blue-600" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs text-slate-400 mt-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.onTemplateFileSelect) },
            type: "file",
            ref: "templateFileInput",
            ...{ class: "hidden" },
            accept: "application/pdf,image/*",
        });
        /** @type {typeof __VLS_ctx.templateFileInput} */ ;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "h-8 bg-white/80 backdrop-blur flex items-center justify-center text-[10px] text-slate-400 border-t border-slate-200 shrink-0" },
    });
}
if (__VLS_ctx.activeTab === 'upload') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col h-full items-center justify-center p-6 animate-fade-in" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'upload'))
                    return;
                __VLS_ctx.fileInput?.click();
            } },
        ...{ onDragover: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'upload'))
                    return;
                __VLS_ctx.dragging = true;
            } },
        ...{ onDragleave: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'upload'))
                    return;
                __VLS_ctx.dragging = false;
            } },
        ...{ onDrop: (__VLS_ctx.onDrop) },
        ...{ class: "w-full max-w-2xl aspect-video bg-white rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all group shrink-0 shadow-sm hover:shadow-md" },
        ...{ class: ({ 'border-blue-500 bg-blue-50/50': __VLS_ctx.dragging }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-24 h-24 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300" },
    });
    const __VLS_92 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        icon: "mdi:cloud-upload",
        width: "48",
    }));
    const __VLS_94 = __VLS_93({
        icon: "mdi:cloud-upload",
        width: "48",
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center space-y-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-2xl font-bold text-slate-700 group-hover:text-blue-700 transition-colors" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-base text-slate-400" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "pt-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow group-hover:bg-blue-700 transition-colors" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.onFileSelect) },
        type: "file",
        ref: "fileInput",
        ...{ class: "hidden" },
        accept: "application/pdf,image/*",
    });
    /** @type {typeof __VLS_ctx.fileInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-6 flex items-center gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'upload'))
                    return;
                __VLS_ctx.assetPickerOpen = true;
            } },
        ...{ class: "px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60" },
        disabled: (__VLS_ctx.loadingFromAsset),
        title: "从资源库选择已保存的 PDF/图片",
    });
    const __VLS_96 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        icon: "mdi:folder-search-outline",
    }));
    const __VLS_98 = __VLS_97({
        icon: "mdi:folder-search-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    (__VLS_ctx.loadingFromAsset ? '加载中...' : '从资源库选择');
    if (__VLS_ctx.processingStatus) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mt-8 flex items-center gap-4 bg-white px-6 py-4 rounded-2xl shadow-card border border-slate-100 animate-fade-in" },
        });
        if (__VLS_ctx.processingStatus.includes('...')) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-medium text-slate-600" },
        });
        (__VLS_ctx.processingStatus);
    }
}
/** @type {[typeof AssetPickerDialog, ]} */ ;
// @ts-ignore
const __VLS_100 = __VLS_asFunctionalComponent(AssetPickerDialog, new AssetPickerDialog({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.assetPickerOpen),
    multiple: (false),
    title: "选择阅卷输入资源",
    hint: "选择一份 PDF/图片资源作为阅卷输入（需要资源包含可访问的 contentUrl 或 data URL）",
}));
const __VLS_101 = __VLS_100({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.assetPickerOpen),
    multiple: (false),
    title: "选择阅卷输入资源",
    hint: "选择一份 PDF/图片资源作为阅卷输入（需要资源包含可访问的 contentUrl 或 data URL）",
}, ...__VLS_functionalComponentArgsRest(__VLS_100));
let __VLS_103;
let __VLS_104;
let __VLS_105;
const __VLS_106 = {
    onConfirm: (__VLS_ctx.loadFromAsset)
};
var __VLS_102;
if (__VLS_ctx.activeTab === 'list') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col h-full p-6 animate-fade-in overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between items-center mb-4 shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-xl font-bold text-slate-800" },
    });
    if (__VLS_ctx.processingStatus) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-sm text-slate-500" },
        });
        (__VLS_ctx.processingStatus);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    if (__VLS_ctx.backendAssignmentId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.loadSubmissionsFromBackend) },
            ...{ class: "flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium shadow-sm disabled:opacity-60" },
            disabled: (__VLS_ctx.backendLoadingSubmissions),
            title: "从后端加载该作业的提交记录",
        });
        const __VLS_107 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
            icon: "mdi:cloud-download",
        }));
        const __VLS_109 = __VLS_108({
            icon: "mdi:cloud-download",
        }, ...__VLS_functionalComponentArgsRest(__VLS_108));
        (__VLS_ctx.backendLoadingSubmissions ? '加载中...' : '从后端加载');
    }
    if (__VLS_ctx.backendAssignmentId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.saveAllToBackend) },
            ...{ class: "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm disabled:opacity-60" },
            disabled: (__VLS_ctx.backendSavingAll),
            title: "保存当前列表中已完成但未保存的试卷到后端（并写入学业成绩）",
        });
        const __VLS_111 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
            icon: "mdi:cloud-upload",
        }));
        const __VLS_113 = __VLS_112({
            icon: "mdi:cloud-upload",
        }, ...__VLS_functionalComponentArgsRest(__VLS_112));
        (__VLS_ctx.backendSavingAll ? '保存中...' : '保存到后端');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.exportData) },
        ...{ class: "flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium shadow-sm" },
    });
    const __VLS_115 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_116 = __VLS_asFunctionalComponent(__VLS_115, new __VLS_115({
        icon: "mdi:file-excel",
    }));
    const __VLS_117 = __VLS_116({
        icon: "mdi:file-excel",
    }, ...__VLS_functionalComponentArgsRest(__VLS_116));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-1 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-2 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-2 text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 overflow-y-auto custom-scrollbar" },
    });
    for (const [p] of __VLS_getVForSourceType((__VLS_ctx.classPapers))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'list'))
                        return;
                    __VLS_ctx.viewPaper(p);
                } },
            key: (p.id),
            ...{ class: "grid grid-cols-12 gap-4 p-4 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "col-span-1 flex justify-center" },
        });
        if (p.status === 'done') {
            const __VLS_119 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
                icon: "mdi:check-circle",
                ...{ class: "text-emerald-500 w-5 h-5" },
            }));
            const __VLS_121 = __VLS_120({
                icon: "mdi:check-circle",
                ...{ class: "text-emerald-500 w-5 h-5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_120));
        }
        else if (p.status === 'error') {
            const __VLS_123 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
                icon: "mdi:alert-circle",
                ...{ class: "text-red-500 w-5 h-5" },
            }));
            const __VLS_125 = __VLS_124({
                icon: "mdi:alert-circle",
                ...{ class: "text-red-500 w-5 h-5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_124));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "col-span-1 text-slate-400 font-mono text-sm" },
        });
        (p.pageIndex);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "col-span-3 font-medium text-slate-700" },
        });
        (p.studentName);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "col-span-3 text-slate-500 text-sm font-mono" },
        });
        (p.studentId);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "col-span-2 text-center font-bold" },
            ...{ class: (p.score >= 60 ? 'text-emerald-600' : 'text-red-500') },
        });
        (p.score);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "col-span-2 text-right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium" },
        });
    }
    if (__VLS_ctx.classPapers.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "p-12 text-center text-slate-400" },
        });
    }
}
if (__VLS_ctx.activeTab === 'detail' && __VLS_ctx.selectedPaper) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-1 h-full p-6 gap-6 animate-slide-up bg-[#F8FAFC] overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 bg-slate-200 rounded-2xl overflow-hidden relative shadow-inner border border-slate-300 flex items-center justify-center min-w-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "absolute inset-0 opacity-10" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "relative w-full h-full overflow-auto flex items-center justify-center p-8 custom-scrollbar" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
        ref: "canvasRef",
        ...{ class: "shadow-2xl rounded max-w-full" },
    });
    /** @type {typeof __VLS_ctx.canvasRef} */ ;
    if (!__VLS_ctx.selectedPaper.image) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "absolute text-slate-400 font-medium" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'detail' && __VLS_ctx.selectedPaper))
                    return;
                __VLS_ctx.activeTab = 'list';
            } },
        ...{ class: "absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium hover:bg-white transition-colors z-10" },
    });
    if (__VLS_ctx.selectedPaper && __VLS_ctx.selectedPaper.pages.length > 1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1.5 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2 z-10" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'detail' && __VLS_ctx.selectedPaper))
                        return;
                    if (!(__VLS_ctx.selectedPaper && __VLS_ctx.selectedPaper.pages.length > 1))
                        return;
                    __VLS_ctx.currentDetailPage = Math.max(1, __VLS_ctx.currentDetailPage - 1);
                    __VLS_ctx.refreshDetailView();
                } },
            disabled: (__VLS_ctx.currentDetailPage <= 1),
            ...{ class: "p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all" },
        });
        const __VLS_127 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
            icon: "mdi:chevron-left",
        }));
        const __VLS_129 = __VLS_128({
            icon: "mdi:chevron-left",
        }, ...__VLS_functionalComponentArgsRest(__VLS_128));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs font-mono font-bold text-slate-600 px-2" },
        });
        (__VLS_ctx.currentDetailPage);
        (__VLS_ctx.selectedPaper.pages.length);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'detail' && __VLS_ctx.selectedPaper))
                        return;
                    if (!(__VLS_ctx.selectedPaper && __VLS_ctx.selectedPaper.pages.length > 1))
                        return;
                    __VLS_ctx.currentDetailPage = Math.min(__VLS_ctx.selectedPaper.pages.length, __VLS_ctx.currentDetailPage + 1);
                    __VLS_ctx.refreshDetailView();
                } },
            disabled: (__VLS_ctx.currentDetailPage >= __VLS_ctx.selectedPaper.pages.length),
            ...{ class: "p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all" },
        });
        const __VLS_131 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({
            icon: "mdi:chevron-right",
        }));
        const __VLS_133 = __VLS_132({
            icon: "mdi:chevron-right",
        }, ...__VLS_functionalComponentArgsRest(__VLS_132));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-96 bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-6 border-b border-slate-100 bg-slate-50 shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-xl font-bold text-slate-800" },
    });
    (__VLS_ctx.selectedPaper.studentName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-slate-500 text-sm font-mono mt-1" },
    });
    (__VLS_ctx.selectedPaper.studentId);
    if (__VLS_ctx.selectedPaper.errorMsg) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100" },
        });
        (__VLS_ctx.selectedPaper.errorMsg);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" },
    });
    for (const [r, idx] of __VLS_getVForSourceType((__VLS_ctx.selectedPaper.results))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (idx),
            ...{ class: "p-4 rounded-xl border border-slate-100 shadow-sm bg-white" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-bold text-slate-700 text-sm" },
        });
        (r.questionId);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs font-bold px-2 py-1 rounded" },
            ...{ class: (r.score > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600') },
        });
        (r.score);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "bg-slate-50 p-2 rounded text-xs text-slate-600 font-mono border border-slate-100 mb-2" },
        });
        (r.studentAnswer);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-xs text-amber-600 font-medium flex items-center gap-1" },
        });
        const __VLS_135 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({
            icon: "mdi:comment-quote-outline",
        }));
        const __VLS_137 = __VLS_136({
            icon: "mdi:comment-quote-outline",
        }, ...__VLS_functionalComponentArgsRest(__VLS_136));
        (r.feedback);
    }
}
if (__VLS_ctx.showAddModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-white rounded-2xl shadow-2xl w-96 p-6 animate-slide-up" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-lg font-bold text-slate-800 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-xs font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.newQuestionForm.label),
        type: "text",
        ...{ class: "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" },
        placeholder: "例如：第1题",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-xs font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        ...{ class: "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" },
    });
    (__VLS_ctx.newQuestionForm.maxPoints);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-xs font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.newQuestionForm.type),
        ...{ class: "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "single_choice",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "multiple_choice",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "true_false",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "fill_in_blank",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "subjective",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-xs font-bold text-slate-500 mb-1" },
    });
    if (__VLS_ctx.newQuestionForm.type === 'single_choice') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex gap-3" },
        });
        for (const [opt] of __VLS_getVForSourceType((['A', 'B', 'C', 'D']))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showAddModal))
                            return;
                        if (!(__VLS_ctx.newQuestionForm.type === 'single_choice'))
                            return;
                        __VLS_ctx.newQuestionForm.correctAnswer = opt;
                    } },
                key: (opt),
                ...{ class: "flex-1 py-2 rounded-lg border text-sm font-bold transition-all" },
                ...{ class: (__VLS_ctx.newQuestionForm.correctAnswer === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400') },
            });
            (opt);
        }
    }
    else if (__VLS_ctx.newQuestionForm.type === 'true_false') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex gap-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showAddModal))
                        return;
                    if (!!(__VLS_ctx.newQuestionForm.type === 'single_choice'))
                        return;
                    if (!(__VLS_ctx.newQuestionForm.type === 'true_false'))
                        return;
                    __VLS_ctx.newQuestionForm.correctAnswer = 'T';
                } },
            ...{ class: "flex-1 py-2 rounded-lg border text-sm font-bold" },
            ...{ class: (__VLS_ctx.newQuestionForm.correctAnswer === 'T' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 border-slate-200') },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showAddModal))
                        return;
                    if (!!(__VLS_ctx.newQuestionForm.type === 'single_choice'))
                        return;
                    if (!(__VLS_ctx.newQuestionForm.type === 'true_false'))
                        return;
                    __VLS_ctx.newQuestionForm.correctAnswer = 'F';
                } },
            ...{ class: "flex-1 py-2 rounded-lg border text-sm font-bold" },
            ...{ class: (__VLS_ctx.newQuestionForm.correctAnswer === 'F' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 border-slate-200') },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (__VLS_ctx.newQuestionForm.correctAnswer),
            type: "text",
            ...{ class: "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" },
            placeholder: (__VLS_ctx.newQuestionForm.type === 'subjective' ? '简答题可留空' : '输入参考答案...'),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-3 mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelAddQuestion) },
        ...{ class: "flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.saveNewQuestion) },
        ...{ class: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-md shadow-blue-500/30" },
    });
}
if (__VLS_ctx.showGridModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "absolute top-16 right-6 z-40 w-80 bg-white/95 backdrop-blur shadow-2xl border border-slate-200 rounded-xl p-4 animate-slide-up" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between items-center mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-sm font-bold text-slate-800 flex items-center gap-2" },
    });
    const __VLS_139 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({
        icon: "mdi:grid",
        ...{ class: "text-blue-600" },
    }));
    const __VLS_141 = __VLS_140({
        icon: "mdi:grid",
        ...{ class: "text-blue-600" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_140));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelGridSplit) },
        ...{ class: "text-slate-400 hover:text-slate-600" },
    });
    const __VLS_143 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({
        icon: "mdi:close",
    }));
    const __VLS_145 = __VLS_144({
        icon: "mdi:close",
    }, ...__VLS_functionalComponentArgsRest(__VLS_144));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-[10px] font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onInput: (__VLS_ctx.drawSetupPreview) },
        type: "number",
        ...{ class: "w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
    });
    (__VLS_ctx.gridForm.startLabel);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-[10px] font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onInput: (__VLS_ctx.drawSetupPreview) },
        type: "number",
        ...{ class: "w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
    });
    (__VLS_ctx.gridForm.endLabel);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-[10px] font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onInput: (__VLS_ctx.drawSetupPreview) },
        type: "number",
        min: "1",
        ...{ class: "w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
    });
    (__VLS_ctx.gridForm.cols);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-[10px] font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        ...{ class: "w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 outline-none" },
    });
    (__VLS_ctx.gridForm.pointsPerQ);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-[10px] font-bold text-slate-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.gridForm.type),
        ...{ class: "w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:border-blue-500 bg-white outline-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "single_choice",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "multiple_choice",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "true_false",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-2 bg-blue-50/50 rounded text-[10px] text-blue-600 leading-relaxed" },
    });
    (Math.max(0, __VLS_ctx.gridForm.endLabel - __VLS_ctx.gridForm.startLabel + 1));
    (Math.ceil(Math.max(1, __VLS_ctx.gridForm.endLabel - __VLS_ctx.gridForm.startLabel + 1) / Math.max(1, __VLS_ctx.gridForm.cols)));
    (__VLS_ctx.gridForm.cols);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.br, __VLS_intrinsicElements.br)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.confirmGridSplit) },
        ...{ class: "w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all" },
    });
}
/** @type {__VLS_StyleScopedClasses['h-[100dvh]']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['font-sans']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[#F8FAFC]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
/** @type {__VLS_StyleScopedClasses['w-px']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['w-px']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-32']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:w-48']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['w-px']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-blue-500/20']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-green-500/20']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-200']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50/50']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-slide-up']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-none']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-r']} */ ;
/** @type {__VLS_StyleScopedClasses['from-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['to-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:shadow-purple-500/20']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-purple-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-800']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/90']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['w-px']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:inline']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-700']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-amber-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[3rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:hover:text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[3rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:hover:text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-blue-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-crosshair']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['ease-out']} */ ;
/** @type {__VLS_StyleScopedClasses['origin-center']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-blue-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:bg-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:text-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/80']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['aspect-video']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-50/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-50/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:scale-110']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:bg-blue-100']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:text-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-card']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-emerald-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-slide-up']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[#F8FAFC]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-10']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['left-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/90']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
/** @type {__VLS_StyleScopedClasses['left-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-x-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/90']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['w-96']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/50']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['w-96']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-slide-up']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-slate-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-blue-500/30']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-16']} */ ;
/** @type {__VLS_StyleScopedClasses['right-6']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/95']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-slide-up']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-slate-600']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-50/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-blue-500/20']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            AssetPickerDialog: AssetPickerDialog,
            backendAssignmentId: backendAssignmentId,
            backendAssignmentName: backendAssignmentName,
            backendAssignmentSubject: backendAssignmentSubject,
            backendBusy: backendBusy,
            backendLoadingSubmissions: backendLoadingSubmissions,
            backendSavingAll: backendSavingAll,
            backendAssignmentNameHistory: backendAssignmentNameHistory,
            commonSubjects: commonSubjects,
            objectiveScoringSettings: objectiveScoringSettings,
            recordBackendAssignmentNameHistory: recordBackendAssignmentNameHistory,
            createBackendAssignment: createBackendAssignment,
            syncAnswerKeysToBackend: syncAnswerKeysToBackend,
            activeTab: activeTab,
            dragging: dragging,
            processingStatus: processingStatus,
            processingProgress: processingProgress,
            processingTotal: processingTotal,
            assetPickerOpen: assetPickerOpen,
            loadingFromAsset: loadingFromAsset,
            loadFromAsset: loadFromAsset,
            assignmentConfig: assignmentConfig,
            templateImage: templateImage,
            setupCanvasRef: setupCanvasRef,
            currentPreviewPage: currentPreviewPage,
            previewTotalPages: previewTotalPages,
            zoomLevel: zoomLevel,
            activeTool: activeTool,
            pendingMappingQuestionId: pendingMappingQuestionId,
            selectedQuestionId: selectedQuestionId,
            isDrawing: isDrawing,
            showAddModal: showAddModal,
            showGridModal: showGridModal,
            newQuestionForm: newQuestionForm,
            gridForm: gridForm,
            activeQuestion: activeQuestion,
            isSimulating: isSimulating,
            simulationResult: simulationResult,
            simulateAIGrading: simulateAIGrading,
            onCanvasMouseDown: onCanvasMouseDown,
            onCanvasMouseMove: onCanvasMouseMove,
            onCanvasMouseUp: onCanvasMouseUp,
            saveNewQuestion: saveNewQuestion,
            cancelAddQuestion: cancelAddQuestion,
            confirmGridSplit: confirmGridSplit,
            cancelGridSplit: cancelGridSplit,
            startMapping: startMapping,
            importJsonConfig: importJsonConfig,
            exportJsonConfig: exportJsonConfig,
            templateFileInput: templateFileInput,
            onTemplateFileSelect: onTemplateFileSelect,
            changePreviewPage: changePreviewPage,
            drawSetupPreview: drawSetupPreview,
            classPapers: classPapers,
            selectedPaper: selectedPaper,
            fileInput: fileInput,
            canvasRef: canvasRef,
            navigateTo: navigateTo,
            returnToPortal: returnToPortal,
            removeQuestion: removeQuestion,
            addEmptyQuestion: addEmptyQuestion,
            onFileSelect: onFileSelect,
            onDrop: onDrop,
            saveAllToBackend: saveAllToBackend,
            loadSubmissionsFromBackend: loadSubmissionsFromBackend,
            currentDetailPage: currentDetailPage,
            viewPaper: viewPaper,
            refreshDetailView: refreshDetailView,
            exportData: exportData,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
