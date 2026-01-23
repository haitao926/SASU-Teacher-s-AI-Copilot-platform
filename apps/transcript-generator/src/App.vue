<script setup lang="ts">
import { computed, ref, watch, nextTick, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { useDebounceFn, useStorage } from '@vueuse/core'
import Chart from 'chart.js/auto'

const token = useStorage('iai-token', '')
const searchQuery = ref('')
const students = ref<any[]>([])
const selectedStudent = ref<any>(null)
const selectedScores = ref<string[]>([])

const examsWithScores = ref<any[]>([])

// Trend State
const showTrendModal = ref(false)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// Config State
const showConfigModal = ref(false)
const pdfOptions = reactive({
  subjects: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '技术'],
  extraColumns: ['总分', '名次'],
  hideEmptyRows: true
})

const availableSubjects = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '技术']
const availableExtras = ['总分', '名次', '3科总分', '6科总分', '3科排名', '6科排名', '班级排名', '年级排名']

const generating = ref(false)
const saving = ref(false)
const savedAssetId = ref<string | null>(null)
const saveMessage = ref('')

// Login State
const showLoginModal = ref(false)
const loginForm = ref({ username: 'admin', password: 'password' })
const loggingIn = ref(false)
const loginError = ref('')

const TRANSCRIPT_API = '/api/academic/transcript'
const API_ASSETS = '/api/assets'
const API_EVENTS = '/api/events'
const API_AUTH = '/api/auth/login'

async function openTrendModal() {
  if (!selectedStudent.value || examsWithScores.value.length === 0) return
  showTrendModal.value = true
  
  await nextTick()
  if (!chartCanvas.value) return

  if (chartInstance) chartInstance.destroy()

  const sortedExams = [...examsWithScores.value].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const labels = sortedExams.map(e => e.name.replace('2026届高中', '').replace('2026届', ''))
  const subjects = new Set<string>()
  sortedExams.forEach(e => e.subjects.forEach((s: any) => subjects.add(s.subject)))
  
  const validSubjects = Array.from(subjects).filter(s => !['名次', '人数'].includes(s))

  const datasets = validSubjects.map((subj, idx) => {
    const data = sortedExams.map(e => {
      const s = e.subjects.find((sub: any) => sub.subject === subj)
      return s ? s.value : null
    })
    
    const colors = ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
    const color = colors[idx % colors.length]
    
    return {
      label: subj,
      data,
      borderColor: color,
      backgroundColor: color,
      tension: 0.3,
      spanGaps: true
    }
  })

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: `${selectedStudent.value.name} - 成绩变化趋势` }
      }
    }
  })
}

function downloadChart() {
  if (!chartInstance) return
  const url = chartInstance.toBase64Image()
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedStudent.value.name}_成绩趋势图.png`
  a.click()
}

function authHeaders() {
  return (token.value ? { Authorization: `Bearer ${token.value}` } : {}) as Record<string, string>
}

if (!token.value) {
  showLoginModal.value = true
}

async function handleLogin() {
  loggingIn.value = true
  loginError.value = ''
  try {
    const res = await fetch(API_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || '登录失败')
    
    token.value = data.token
    showLoginModal.value = false
  } catch (e: any) {
    loginError.value = e.message
  } finally {
    loggingIn.value = false
  }
}

const handleSearch = useDebounceFn(async () => {
  if (!searchQuery.value) {
    students.value = []
    return
  }
  try {
    const res = await fetch(`${TRANSCRIPT_API}/students?q=${encodeURIComponent(searchQuery.value)}`, {
      headers: authHeaders()
    })
    if (res.ok) {
      students.value = await res.json()
    }
  } catch (e) {
    console.error('Search failed', e)
  }
}, 300)

watch(searchQuery, handleSearch)

function processScores(scores: any[]) {
  const map = new Map<string, any>()

  scores.forEach((s: any) => {
    if (!map.has(s.examId)) {
      map.set(s.examId, {
        id: s.examId,
        name: s.exam.name,
        date: s.exam.date,
        type: s.exam.type,
        subjects: []
      })
    }
    map.get(s.examId).subjects.push({
      subject: s.subject,
      value: s.value
    })
  })

  examsWithScores.value = Array.from(map.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  if (examsWithScores.value.length > 0) {
    selectedScores.value = [examsWithScores.value[0].id]
  } else {
    selectedScores.value = []
  }
}

async function selectStudent(student: any) {
  selectedStudent.value = student
  students.value = []
  searchQuery.value = student.name

  try {
    const res = await fetch(`${TRANSCRIPT_API}/students/${student.id}/scores`, {
      headers: authHeaders()
    })
    if (res.ok) {
      const scores = await res.json()
      processScores(scores)
    }
  } catch (e) {
    console.error(e)
  }
}

function toggleExam(examId: string) {
  const idx = selectedScores.value.indexOf(examId)
  if (idx > -1) selectedScores.value.splice(idx, 1)
  else selectedScores.value.push(examId)
}

const selectionKey = computed(() => `${selectedStudent.value?.id || ''}|${selectedScores.value.join(',')}`)
const lastPdf = ref<{ key: string; blob: Blob } | null>(null)

watch(selectionKey, () => {
  lastPdf.value = null
  savedAssetId.value = null
  saveMessage.value = ''
})

async function fetchFileBlob(format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
  if (!selectedStudent.value || selectedScores.value.length === 0) {
    throw new Error('请选择学生与考试')
  }

  const ids = selectedScores.value.join(',')
  const optionsJson = JSON.stringify(pdfOptions)
  const url = `${TRANSCRIPT_API}/export/${selectedStudent.value.id}?examIds=${encodeURIComponent(ids)}&options=${encodeURIComponent(optionsJson)}&format=${format}`

  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Generation failed')
  return await res.blob()
}

async function downloadFile(format: 'pdf' | 'excel') {
  if (!selectedStudent.value || selectedScores.value.length === 0) return
  generating.value = true

  try {
    const blob = await fetchFileBlob(format)
    // Cache PDF only
    if (format === 'pdf') {
      lastPdf.value = { key: selectionKey.value, blob }
    }

    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    const ext = format === 'excel' ? 'xlsx' : 'pdf'
    a.download = `成绩证明_${selectedStudent.value.name}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (e) {
    alert('生成失败，请重试')
    console.error(e)
  } finally {
    generating.value = false
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read PDF'))
    reader.readAsDataURL(blob)
  })
}

async function saveToAssets() {
  if (!selectedStudent.value || selectedScores.value.length === 0) return
  if (!token.value) {
    alert('请先在工作台登录后使用')
    return
  }

  saving.value = true
  savedAssetId.value = null
  saveMessage.value = ''
  try {
    const blob =
      lastPdf.value?.key === selectionKey.value && lastPdf.value?.blob
        ? lastPdf.value.blob
        : await fetchFileBlob('pdf')
    lastPdf.value = { key: selectionKey.value, blob }

    const dataUrl = await blobToDataUrl(blob)
    const title = `成绩证明_${selectedStudent.value.name}_${new Date().toLocaleDateString()}`

    const assetRes = await fetch(API_ASSETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title,
        summary: '成绩证明（PDF）',
        type: 'pdf',
        contentUrl: dataUrl,
        tags: ['transcript', 'pdf'],
        visibility: 'PRIVATE',
        metadata: {
          studentId: selectedStudent.value.studentId,
          studentName: selectedStudent.value.name,
          class: selectedStudent.value.class,
          examIds: selectedScores.value
        }
      })
    })
    if (!assetRes.ok) {
      const err = await assetRes.json().catch(() => ({}))
      throw new Error(err.message || '保存失败')
    }

    const asset = await assetRes.json()
    savedAssetId.value = asset.id
    saveMessage.value = '已存入资源库'

    await fetch(API_EVENTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        action: 'asset.created',
        appCode: 'transcript-generator',
        targetType: 'Asset',
        targetId: asset.id,
        payload: { type: 'pdf', kind: 'transcript' }
      })
    }).catch(() => {})
  } catch (e: any) {
    saveMessage.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function reset() {
  selectedStudent.value = null
  searchQuery.value = ''
  examsWithScores.value = []
  selectedScores.value = []
}
</script>

<template>
  <div class="p-8 max-w-5xl mx-auto min-h-screen">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
      <!-- Header -->
      <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Icon icon="mdi:certificate-outline" class="text-indigo-600" />
            成绩证明自助打印
          </h2>
          <p class="text-sm text-gray-500 mt-1">选择学生，勾选需要的考试成绩，一键生成正式证明文件</p>
        </div>
        <div class="flex gap-2">
          <button @click="openTrendModal" v-if="selectedStudent" class="px-4 py-2 bg-white border border-gray-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-2">
            <Icon icon="mdi:chart-line" /> 成绩趋势
          </button>
          <button v-if="selectedStudent" @click="reset" class="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 px-3">
            <Icon icon="mdi:refresh" /> 重置
          </button>
        </div>
      </div>

      <div class="flex-1 flex flex-col md:flex-row">
        <!-- Left: Search & Student Profile -->
        <div class="w-full md:w-1/3 border-r border-gray-100 p-6 bg-white z-10">
          <label class="block text-sm font-bold text-gray-700 mb-2">第一步：查找学生</label>
          <div class="relative mb-6">
            <Icon icon="mdi:magnify" class="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="输入姓名或学号..."
              class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
            />

            <!-- Dropdown -->
            <div v-if="students.length > 0" class="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-20">
              <div
                v-for="student in students"
                :key="student.id"
                @click="selectStudent(student)"
                class="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 border-gray-50 flex justify-between items-center group"
              >
                <div>
                  <div class="font-bold text-gray-800 group-hover:text-indigo-700">{{ student.name }}</div>
                  <div class="text-xs text-gray-400">{{ student.studentId }}</div>
                </div>
                <div class="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded">{{ student.class }}班</div>
              </div>
            </div>
          </div>

          <!-- Selected Profile Card -->
          <div v-if="selectedStudent" class="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 text-center animate-fade-in">
            <div class="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm text-indigo-200">
              <Icon icon="mdi:account" class="w-10 h-10" />
            </div>
            <h3 class="text-xl font-bold text-gray-900">{{ selectedStudent.name }}</h3>
            <p class="text-indigo-600 font-medium mb-4">{{ selectedStudent.class }}班 | {{ selectedStudent.studentId }}</p>

            <div class="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div class="bg-white p-2 rounded-lg border border-indigo-50">
                <div class="font-bold text-gray-800 text-lg">{{ examsWithScores.length }}</div>
                <div>参与考试</div>
              </div>
              <div class="bg-white p-2 rounded-lg border border-indigo-50">
                <div class="font-bold text-gray-800 text-lg">{{ examsWithScores.reduce((acc, e) => acc + e.subjects.length, 0) }}</div>
                <div>科目记录</div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-12 text-gray-400">
            <Icon icon="mdi:account-search-outline" class="w-16 h-16 mx-auto mb-3 opacity-30" />
            <p>请先搜索并选择一位学生</p>
          </div>
        </div>

        <!-- Right: Exam List & Action -->
        <div class="flex-1 p-6 bg-slate-50/50 flex flex-col">
          <label class="block text-sm font-bold text-gray-700 mb-4">
            第二步：选择需要打印的成绩记录
            <span v-if="selectedStudent" class="font-normal text-gray-400 ml-2">(已选 {{ selectedScores.length }} 项)</span>
          </label>

          <div v-if="selectedStudent" class="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            <div
              v-for="exam in examsWithScores"
              :key="exam.id"
              @click="toggleExam(exam.id)"
              class="bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md relative overflow-hidden group"
              :class="selectedScores.includes(exam.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'"
            >
              <!-- Checkbox Indicator -->
              <div
                class="absolute top-4 right-4 text-indigo-600 transition-transform duration-200"
                :class="selectedScores.includes(exam.id) ? 'scale-100' : 'scale-0 opacity-0'"
              >
                <Icon icon="mdi:check-circle" class="w-6 h-6" />
              </div>

              <div class="pr-8">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-gray-800 text-lg">{{ exam.name }}</span>
                  <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">{{ exam.type }}</span>
                </div>
                <div class="text-xs text-gray-400 mb-3 flex items-center gap-1">
                  <Icon icon="mdi:calendar" /> {{ new Date(exam.date).toLocaleDateString() }}
                </div>

                <!-- Mini Score Tags -->
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="sub in exam.subjects"
                    :key="sub.subject"
                    class="text-xs px-2 py-1 bg-slate-50 rounded text-slate-600 border border-slate-100 flex gap-1"
                  >
                    <span>{{ sub.subject }}</span>
                    <span class="font-bold" :class="sub.value < 60 ? 'text-red-500' : 'text-indigo-600'">{{ sub.value }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div v-if="examsWithScores.length === 0" class="text-center py-10 text-gray-400">该学生暂无考试记录</div>
          </div>

          <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-xl m-4">
            <Icon icon="mdi:file-document-edit-outline" class="w-16 h-16 mb-2" />
            <p>等待选择学生...</p>
          </div>

          <!-- Action Bar -->
          <div class="mt-6 border-t border-gray-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <div v-if="saveMessage" class="text-sm sm:mr-auto" :class="savedAssetId ? 'text-emerald-700' : 'text-rose-700'">
              {{ saveMessage }}
            </div>
            
            <button
              @click="showConfigModal = true"
              :disabled="!selectedStudent"
              class="px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon="mdi:cog-outline" /> 配置
            </button>

            <!-- Excel Export -->
            <button
              @click="downloadFile('excel')"
              :disabled="!selectedStudent || selectedScores.length === 0 || generating"
              class="px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon="mdi:file-excel-outline" /> 导出Excel
            </button>

            <button
              @click="saveToAssets"
              :disabled="!selectedStudent || selectedScores.length === 0 || saving"
              class="px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="将生成的 PDF 存入资源库"
            >
              <Icon v-if="saving" icon="mdi:loading" class="animate-spin" />
              <Icon v-else icon="mdi:content-save" />
              存入资源库
            </button>
            <button
              @click="downloadFile('pdf')"
              :disabled="!selectedStudent || selectedScores.length === 0 || generating"
              class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              <Icon v-if="generating" icon="mdi:loading" class="animate-spin" />
              <Icon v-else icon="mdi:printer" />
              {{ generating ? '生成中...' : '生成成绩证明' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Trend Modal -->
    <div v-if="showTrendModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div class="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon="mdi:chart-line" class="text-indigo-600" /> 成绩趋势分析
          </h3>
          <button @click="showTrendModal = false" class="text-gray-400 hover:text-gray-600">
            <Icon icon="mdi:close" class="w-6 h-6" />
          </button>
        </div>
        
        <div class="flex-1 min-h-0 relative bg-slate-50 rounded-xl border border-gray-200 p-4">
          <canvas ref="chartCanvas"></canvas>
        </div>

        <div class="mt-4 flex justify-end gap-3">
          <button @click="downloadChart" class="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
            <Icon icon="mdi:download" /> 导出图片
          </button>
        </div>
      </div>
    </div>

    <!-- Config Modal -->
    <div v-if="showConfigModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div class="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon="mdi:table-cog" class="text-indigo-600" /> 成绩单模板配置
          </h3>
          <button @click="showConfigModal = false" class="text-gray-400 hover:text-gray-600">
            <Icon icon="mdi:close" class="w-6 h-6" />
          </button>
        </div>

        <div class="space-y-6">
          <!-- Subjects -->
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-3">展示学科</label>
            <div class="grid grid-cols-5 gap-3">
              <label v-for="subj in availableSubjects" :key="subj" class="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" v-model="pdfOptions.subjects" :value="subj" class="rounded text-indigo-600 focus:ring-indigo-500" />
                {{ subj }}
              </label>
            </div>
          </div>

          <!-- Extras -->
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-3">扩展列 (统计/排名)</label>
            <div class="grid grid-cols-4 gap-3">
              <label v-for="col in availableExtras" :key="col" class="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" v-model="pdfOptions.extraColumns" :value="col" class="rounded text-indigo-600 focus:ring-indigo-500" />
                {{ col }}
              </label>
            </div>
          </div>

          <!-- Options -->
          <div class="pt-4 border-t border-gray-100">
            <label class="flex items-center gap-3 cursor-pointer">
              <div class="relative inline-flex items-center">
                <input type="checkbox" v-model="pdfOptions.hideEmptyRows" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
              <span class="text-sm font-medium text-gray-700">仅展示有成绩的考试 (不显示空白行)</span>
            </label>
          </div>
        </div>

        <div class="mt-8 flex justify-end">
          <button @click="showConfigModal = false" class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">
            确认配置
          </button>
        </div>
      </div>
    </div>

    <!-- Login Modal -->
    <div v-if="showLoginModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div class="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl animate-fade-in text-center">
        <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon icon="mdi:shield-lock" class="w-8 h-8" />
        </div>
        
        <h3 class="text-2xl font-bold text-slate-900 mb-2">请先登录</h3>
        <p class="text-slate-500 mb-6 text-sm">需要验证身份以访问成绩数据</p>

        <form @submit.prevent="handleLogin" class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">用户名</label>
            <input v-model="loginForm.username" type="text" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">密码</label>
            <input v-model="loginForm.password" type="password" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          </div>

          <div v-if="loginError" class="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex gap-2 items-start">
            <Icon icon="mdi:alert-circle" class="mt-0.5 flex-shrink-0" />
            {{ loginError }}
          </div>

          <button 
            type="submit" 
            :disabled="loggingIn"
            class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-70"
          >
            <Icon v-if="loggingIn" icon="mdi:loading" class="animate-spin" />
            {{ loggingIn ? '登录中...' : '立即登录' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>