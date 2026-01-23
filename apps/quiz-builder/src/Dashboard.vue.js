import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
const API_QUIZZES = '/api/quizzes';
const API_QUESTIONS = '/api/questions';
const API_ASSETS = '/api/assets';
const API_EVENTS = '/api/events';
const token = ref(localStorage.getItem('iai-token') || '');
const listLoading = ref(false);
const listError = ref('');
const keyword = ref('');
const subjectFilter = ref('');
const gradeFilter = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const questions = ref([]);
const preview = ref(null);
const selected = ref([]);
const draggingIndex = ref(null);
const quizTitle = ref('试卷草稿');
const quizSubject = ref('');
const quizGrade = ref('');
const quizTags = ref('');
const quizVisibility = ref('PRIVATE');
const saving = ref(false);
const saveResult = ref(null);
const exportingMarkdown = ref(false);
const exportingDoc = ref(false);
const printingPdf = ref(false);
const regenerating = ref(false);
const authHeaders = computed(() => (token.value ? { Authorization: `Bearer ${token.value}` } : {}));
const canUse = computed(() => Boolean(token.value));
function safeParseJson(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
async function loadQuestions() {
    listLoading.value = true;
    listError.value = '';
    try {
        const params = new URLSearchParams({
            page: String(page.value),
            pageSize: String(pageSize.value)
        });
        if (keyword.value.trim())
            params.set('keyword', keyword.value.trim());
        if (subjectFilter.value.trim())
            params.set('subject', subjectFilter.value.trim());
        if (gradeFilter.value.trim())
            params.set('grade', gradeFilter.value.trim());
        const res = await fetch(`${API_QUESTIONS}?${params.toString()}`, {
            headers: authHeaders.value
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `加载失败 (${res.status})`);
        }
        const data = await res.json();
        questions.value = data.items || [];
        total.value = data.total || 0;
    }
    catch (e) {
        listError.value = e.message || '加载失败';
        questions.value = [];
        total.value = 0;
    }
    finally {
        listLoading.value = false;
    }
}
async function loadQuestionDetail(id) {
    const res = await fetch(`${API_QUESTIONS}/${id}`, { headers: authHeaders.value });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '读取题目失败');
    }
    const raw = await res.json();
    const detail = {
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
    };
    preview.value = detail;
    return detail;
}
async function regenerateSimilar() {
    if (!preview.value)
        return;
    if (!canUse.value) {
        alert('请先登录后使用');
        return;
    }
    regenerating.value = true;
    try {
        const res = await fetch(`${API_QUESTIONS}/${preview.value.id}/regenerate`, {
            method: 'POST',
            headers: authHeaders.value
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `生成失败 (${res.status})`);
        }
        const created = await res.json();
        const detail = await loadQuestionDetail(created.id);
        selected.value.push(detail);
        await loadQuestions().catch(() => { });
    }
    catch (e) {
        alert(e.message || '生成失败');
    }
    finally {
        regenerating.value = false;
    }
}
async function addQuestion(item) {
    if (selected.value.some((q) => q.id === item.id))
        return;
    try {
        const detail = await loadQuestionDetail(item.id);
        selected.value.push(detail);
        if (selected.value.length === 1) {
            quizSubject.value = quizSubject.value || (detail.subject ?? '');
            quizGrade.value = quizGrade.value || (detail.grade ?? '');
        }
    }
    catch (e) {
        alert(e.message || '添加失败');
    }
}
function removeQuestion(id) {
    selected.value = selected.value.filter((q) => q.id !== id);
    if (preview.value?.id === id) {
        preview.value = selected.value[0] ?? null;
    }
}
function onDragStart(index, e) {
    draggingIndex.value = index;
    e.dataTransfer?.setData('text/plain', String(index));
    e.dataTransfer?.setDragImage?.(new Image(), 0, 0);
}
function onDrop(index) {
    const from = draggingIndex.value;
    draggingIndex.value = null;
    if (from === null || from === index)
        return;
    const next = [...selected.value];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    selected.value = next;
}
function buildQuizJson() {
    const tags = quizTags.value
        .split(/[,， ]+/)
        .map((t) => t.trim())
        .filter(Boolean);
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
    };
}
function toMarkdown() {
    const quiz = buildQuizJson();
    const lines = [];
    lines.push(`# ${quiz.title}`);
    const meta = [];
    if (quiz.subject)
        meta.push(`学科：${quiz.subject}`);
    if (quiz.grade)
        meta.push(`年级：${quiz.grade}`);
    if (meta.length)
        lines.push(`> ${meta.join(' ｜ ')}`);
    lines.push('');
    quiz.questions.forEach((q) => {
        lines.push(`${q.order}. ${q.stem}`);
        const options = Array.isArray(q.options) ? q.options : null;
        if (options && options.length) {
            const letters = 'ABCDEFGH';
            options.forEach((opt, i) => {
                lines.push(`   ${letters[i]}. ${opt}`);
            });
        }
        lines.push('');
    });
    return lines.join('\n');
}
function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function toHtmlDocument() {
    const quiz = buildQuizJson();
    const meta = [];
    if (quiz.subject)
        meta.push(`学科：${escapeHtml(String(quiz.subject))}`);
    if (quiz.grade)
        meta.push(`年级：${escapeHtml(String(quiz.grade))}`);
    if (quiz.tags?.length)
        meta.push(`标签：${escapeHtml(quiz.tags.join('、'))}`);
    const questionsHtml = quiz.questions
        .map((q) => {
        const lines = [];
        lines.push(`<div class="q">`);
        lines.push(`<div class="q-title"><span class="q-no">${q.order}.</span> <span class="q-stem">${escapeHtml(String(q.stem ?? ''))}</span></div>`);
        const options = Array.isArray(q.options) ? q.options : null;
        if (options && options.length) {
            const letters = 'ABCDEFGH';
            lines.push('<ol class="q-options">');
            options.forEach((opt, idx) => {
                const letter = letters[idx] ?? String(idx + 1);
                lines.push(`<li><span class="opt-letter">${letter}.</span> <span class="opt-text">${escapeHtml(String(opt ?? ''))}</span></li>`);
            });
            lines.push('</ol>');
        }
        lines.push('</div>');
        return lines.join('\n');
    })
        .join('\n');
    const title = escapeHtml(String(quiz.title ?? '试卷'));
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
</html>`;
}
async function downloadMarkdown() {
    if (selected.value.length === 0)
        return;
    exportingMarkdown.value = true;
    try {
        const md = toMarkdown();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quizTitle.value.trim() || 'quiz'}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
    finally {
        exportingMarkdown.value = false;
    }
}
async function downloadWord() {
    if (selected.value.length === 0)
        return;
    exportingDoc.value = true;
    try {
        const html = toHtmlDocument();
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quizTitle.value.trim() || 'quiz'}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    }
    finally {
        exportingDoc.value = false;
    }
}
async function exportPdfViaPrint() {
    if (selected.value.length === 0)
        return;
    printingPdf.value = true;
    try {
        const html = toHtmlDocument();
        const win = window.open('', '_blank', 'noopener,noreferrer');
        if (!win) {
            alert('无法打开新窗口，请允许浏览器弹窗后重试。');
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        const trigger = () => {
            win.focus();
            win.print();
        };
        win.addEventListener?.('load', () => setTimeout(trigger, 50));
        setTimeout(trigger, 300);
    }
    finally {
        printingPdf.value = false;
    }
}
async function saveAsAsset() {
    if (selected.value.length === 0)
        return;
    saving.value = true;
    saveResult.value = null;
    try {
        const quiz = buildQuizJson();
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
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || '保存失败');
        }
        const asset = (await res.json());
        saveResult.value = { assetId: asset.id, title: asset.title };
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
        }).catch(() => { });
    }
    catch (e) {
        alert(e.message || '保存失败');
    }
    finally {
        saving.value = false;
    }
}
async function generateMockQuiz() {
    if (!canUse.value)
        return;
    const res = await fetch(`${API_QUIZZES}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders.value },
        body: JSON.stringify({
            topic: quizTitle.value || '示例试卷',
            knowledgePoints: '',
            difficulty: 'medium'
        })
    });
    if (!res.ok)
        return;
    const data = await res.json();
    if (data?.markdown) {
        await navigator.clipboard.writeText(String(data.markdown));
        alert('已复制 mock 生成的 Markdown 到剪贴板');
    }
}
function goPage(next) {
    const totalPages = Math.max(1, Math.ceil(total.value / pageSize.value));
    const p = Math.min(Math.max(1, next), totalPages);
    if (p !== page.value) {
        page.value = p;
        loadQuestions();
    }
}
onMounted(() => {
    // Token may be injected by portal route params; keep a light sync.
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    if (authToken) {
        token.value = authToken;
        localStorage.setItem('iai-token', authToken);
        const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }
    token.value = localStorage.getItem('iai-token') || token.value;
    if (token.value)
        loadQuestions();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "p-6 max-w-6xl mx-auto space-y-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-2" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:file-document-edit",
    ...{ class: "text-primary w-6 h-6" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:file-document-edit",
    ...{ class: "text-primary w-6 h-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-2 flex-wrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.generateMockQuiz) },
    ...{ class: "px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1" },
    disabled: (!__VLS_ctx.canUse),
    title: "调用 /api/quizzes/generate (mock) 并复制结果",
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:sparkles",
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:sparkles",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.downloadWord) },
    ...{ class: "px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60" },
    disabled: (__VLS_ctx.selected.length === 0 || __VLS_ctx.exportingDoc),
    title: "导出为 Word（.doc，HTML 格式）",
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:file-word",
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:file-word",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
(__VLS_ctx.exportingDoc ? '导出中...' : '导出 Word');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.exportPdfViaPrint) },
    ...{ class: "px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60" },
    disabled: (__VLS_ctx.selected.length === 0 || __VLS_ctx.printingPdf),
    title: "打开打印预览，可选择“另存为 PDF”",
});
const __VLS_12 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    icon: "mdi:file-pdf-box",
}));
const __VLS_14 = __VLS_13({
    icon: "mdi:file-pdf-box",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
(__VLS_ctx.printingPdf ? '打开中...' : '导出 PDF');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.downloadMarkdown) },
    ...{ class: "px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1" },
    disabled: (__VLS_ctx.selected.length === 0 || __VLS_ctx.exportingMarkdown),
});
const __VLS_16 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    icon: "mdi:file-download",
}));
const __VLS_18 = __VLS_17({
    icon: "mdi:file-download",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
(__VLS_ctx.exportingMarkdown ? '导出中...' : '导出 Markdown');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.saveAsAsset) },
    ...{ class: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1 disabled:opacity-60" },
    disabled: (__VLS_ctx.selected.length === 0 || __VLS_ctx.saving),
});
const __VLS_20 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    icon: "mdi:content-save",
}));
const __VLS_22 = __VLS_21({
    icon: "mdi:content-save",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
(__VLS_ctx.saving ? '保存中...' : '保存到资源库');
if (!__VLS_ctx.canUse) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "bg-white border rounded-lg p-4 space-y-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "font-bold text-gray-800 flex items-center gap-2" },
});
const __VLS_24 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    icon: "mdi:database-search",
}));
const __VLS_26 = __VLS_25({
    icon: "mdi:database-search",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.loadQuestions();
        } },
    ...{ class: "px-3 py-1.5 bg-white border rounded hover:bg-gray-50 text-sm" },
    disabled: (!__VLS_ctx.canUse || __VLS_ctx.listLoading),
});
const __VLS_28 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    icon: "mdi:reload",
    ...{ class: "inline-block" },
}));
const __VLS_30 = __VLS_29({
    icon: "mdi:reload",
    ...{ class: "inline-block" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "md:col-span-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeyup: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.loadQuestions();
        } },
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "题干/解析关键词...",
});
(__VLS_ctx.keyword);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeyup: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.loadQuestions();
        } },
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "如：数学",
});
(__VLS_ctx.subjectFilter);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeyup: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.loadQuestions();
        } },
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "如：高一",
});
(__VLS_ctx.gradeFilter);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "md:col-span-2 flex items-end gap-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.page = 1;
            __VLS_ctx.loadQuestions();
        } },
    ...{ class: "px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60 w-full" },
    disabled: (!__VLS_ctx.canUse || __VLS_ctx.listLoading),
});
(__VLS_ctx.listLoading ? '加载中...' : '搜索');
if (__VLS_ctx.listError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm text-red-600" },
    });
    (__VLS_ctx.listError);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "border rounded-lg overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "max-h-[420px] overflow-auto" },
});
for (const [q] of __VLS_getVForSourceType((__VLS_ctx.questions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (q.id),
        ...{ class: "px-4 py-3 border-b last:border-0 hover:bg-gray-50 flex items-start gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.loadQuestionDetail(q.id).catch(() => { });
            } },
        ...{ class: "flex-1 text-left" },
        title: (q.stem),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm font-medium text-gray-900 overflow-hidden" },
        ...{ style: {} },
    });
    (q.stem);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "px-2 py-0.5 bg-gray-100 rounded" },
    });
    (q.type);
    if (q.subject) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "px-2 py-0.5 bg-blue-50 text-blue-700 rounded" },
        });
        (q.subject);
    }
    if (q.grade) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "px-2 py-0.5 bg-amber-50 text-amber-700 rounded" },
        });
        (q.grade);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-auto" },
    });
    (new Date(q.updatedAt).toLocaleString());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.addQuestion(q);
            } },
        ...{ class: "px-3 py-2 bg-white border rounded hover:bg-gray-50 text-sm disabled:opacity-60" },
        disabled: (__VLS_ctx.selected.some((s) => s.id === q.id)),
    });
    const __VLS_32 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        icon: "mdi:plus",
        ...{ class: "inline-block" },
    }));
    const __VLS_34 = __VLS_33({
        icon: "mdi:plus",
        ...{ class: "inline-block" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
if (!__VLS_ctx.listLoading && __VLS_ctx.questions.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "px-4 py-8 text-center text-sm text-gray-400" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.total);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.goPage(__VLS_ctx.page - 1);
        } },
    ...{ class: "px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-60" },
    disabled: (__VLS_ctx.page <= 1),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.page);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.goPage(__VLS_ctx.page + 1);
        } },
    ...{ class: "px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-60" },
    disabled: (__VLS_ctx.page >= Math.ceil(__VLS_ctx.total / __VLS_ctx.pageSize)),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "bg-white border rounded-lg p-4 space-y-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "font-bold text-gray-800 flex items-center gap-2" },
});
const __VLS_36 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    icon: "mdi:clipboard-list-outline",
}));
const __VLS_38 = __VLS_37({
    icon: "mdi:clipboard-list-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-xs text-gray-500" },
});
(__VLS_ctx.selected.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "md:col-span-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "如：七年级数学期中测验",
});
(__VLS_ctx.quizTitle);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.quizVisibility),
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "PRIVATE",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "INTERNAL",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "PUBLIC",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "如：数学",
});
(__VLS_ctx.quizSubject);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "如：高一",
});
(__VLS_ctx.quizGrade);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "md:col-span-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "mt-1 border rounded px-3 py-2 w-full" },
    placeholder: "期中, 一元一次方程, 应用题",
});
(__VLS_ctx.quizTags);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "border rounded-lg overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "max-h-[340px] overflow-auto" },
});
for (const [q, idx] of __VLS_getVForSourceType((__VLS_ctx.selected))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onDragstart: (...[$event]) => {
                __VLS_ctx.onDragStart(idx, $event);
            } },
        ...{ onDragover: () => { } },
        ...{ onDrop: (...[$event]) => {
                __VLS_ctx.onDrop(idx);
            } },
        key: (q.id),
        ...{ class: "px-4 py-3 border-b last:border-0 flex items-start gap-3 bg-white" },
        ...{ class: (__VLS_ctx.draggingIndex === idx ? 'opacity-60' : '') },
        draggable: "true",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "pt-1 text-gray-300 cursor-move" },
        title: "拖拽排序",
    });
    const __VLS_40 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        icon: "mdi:drag",
        ...{ class: "w-5 h-5" },
    }));
    const __VLS_42 = __VLS_41({
        icon: "mdi:drag",
        ...{ class: "w-5 h-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.preview = q;
            } },
        ...{ class: "flex-1 text-left" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm font-medium text-gray-900 overflow-hidden" },
        ...{ style: {} },
    });
    (idx + 1);
    (q.stem);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "px-2 py-0.5 bg-gray-100 rounded" },
    });
    (q.type);
    if (q.difficulty) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "px-2 py-0.5 bg-slate-100 rounded" },
        });
        (q.difficulty);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeQuestion(q.id);
            } },
        ...{ class: "px-2 py-2 text-red-600 hover:bg-red-50 rounded" },
        title: "移除",
    });
    const __VLS_44 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        icon: "mdi:close",
    }));
    const __VLS_46 = __VLS_45({
        icon: "mdi:close",
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
}
if (__VLS_ctx.selected.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "px-4 py-10 text-center text-sm text-gray-400" },
    });
}
if (__VLS_ctx.saveResult) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3" },
    });
    (__VLS_ctx.saveResult.title);
    (__VLS_ctx.saveResult.assetId);
}
if (__VLS_ctx.preview) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-white border rounded-lg p-4 space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    const __VLS_48 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        icon: "mdi:eye-outline",
    }));
    const __VLS_50 = __VLS_49({
        icon: "mdi:eye-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-gray-800" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs text-gray-500" },
    });
    (__VLS_ctx.preview.type);
    if (__VLS_ctx.preview.difficulty) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs text-gray-500" },
        });
        (__VLS_ctx.preview.difficulty);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.regenerateSimilar) },
        ...{ class: "ml-auto px-3 py-1.5 bg-white border rounded hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60" },
        disabled: (__VLS_ctx.regenerating),
        title: "生成一题相似的变式题（当前为 mock 逻辑，可后续接入 LLM）",
    });
    const __VLS_52 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        icon: "mdi:refresh",
    }));
    const __VLS_54 = __VLS_53({
        icon: "mdi:refresh",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    (__VLS_ctx.regenerating ? '生成中...' : '生成变式题');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
        ...{ class: "bg-gray-50 border rounded p-3 text-sm overflow-auto whitespace-pre-wrap" },
    });
    (__VLS_ctx.preview.stem);
    if (Array.isArray(__VLS_ctx.preview.options)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "bg-white border rounded p-3 text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "font-medium text-gray-700 mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.ol, __VLS_intrinsicElements.ol)({
            ...{ class: "list-decimal list-inside space-y-1" },
        });
        for (const [opt, i] of __VLS_getVForSourceType(__VLS_ctx.preview.options)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                key: (i),
            });
            (opt);
        }
    }
    if (__VLS_ctx.preview.analysis) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "bg-white border rounded p-3 text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "font-medium text-gray-700 mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ class: "whitespace-pre-wrap text-gray-700" },
        });
        (__VLS_ctx.preview.analysis);
    }
}
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-6xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['md:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['md:justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-800']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[420px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['last:border-0']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[340px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['last:border-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-move']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-emerald-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-emerald-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['list-decimal']} */ ;
/** @type {__VLS_StyleScopedClasses['list-inside']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            listLoading: listLoading,
            listError: listError,
            keyword: keyword,
            subjectFilter: subjectFilter,
            gradeFilter: gradeFilter,
            page: page,
            pageSize: pageSize,
            total: total,
            questions: questions,
            preview: preview,
            selected: selected,
            draggingIndex: draggingIndex,
            quizTitle: quizTitle,
            quizSubject: quizSubject,
            quizGrade: quizGrade,
            quizTags: quizTags,
            quizVisibility: quizVisibility,
            saving: saving,
            saveResult: saveResult,
            exportingMarkdown: exportingMarkdown,
            exportingDoc: exportingDoc,
            printingPdf: printingPdf,
            regenerating: regenerating,
            canUse: canUse,
            loadQuestions: loadQuestions,
            loadQuestionDetail: loadQuestionDetail,
            regenerateSimilar: regenerateSimilar,
            addQuestion: addQuestion,
            removeQuestion: removeQuestion,
            onDragStart: onDragStart,
            onDrop: onDrop,
            downloadMarkdown: downloadMarkdown,
            downloadWord: downloadWord,
            exportPdfViaPrint: exportPdfViaPrint,
            saveAsAsset: saveAsAsset,
            generateMockQuiz: generateMockQuiz,
            goPage: goPage,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
