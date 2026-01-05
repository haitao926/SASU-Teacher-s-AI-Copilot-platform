<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface HistoryItem {
  id: string
  fileName: string
  status: string
  fullZipUrl?: string
  createdAt?: string
}

const file = ref<File | null>(null)
const taskId = ref('')
const status = ref<Status>('idle')
const progress = ref(0)
const result = ref('')
const zipUrl = ref('')
const error = ref('')
const history = ref<HistoryItem[]>([])
let timer: number | null = null

const { isLoggedIn } = useAuth()

const isWorking = computed(() => ['uploading', 'processing'].includes(status.value))

function reset() {
  file.value = null
  taskId.value = ''
  status.value = 'idle'
  progress.value = 0
  result.value = ''
  zipUrl.value = ''
  error.value = ''
  if (timer) {
    window.clearTimeout(timer)
    timer = null
  }
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    file.value = target.files[0]
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const dropped = e.dataTransfer?.files?.[0]
  if (dropped) {
    file.value = dropped
  }
}

function preventDefault(e: DragEvent) {
  e.preventDefault()
}

function renderMarkdown(md: string) {
  // very small renderer to avoid extra deps; enough for prototype preview
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  let html = escaped
    .replace(/^### (.*)$/gm, '<h3 class="text-lg font-semibold mb-2">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="text-xl font-bold mb-3">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
    .replace(/^\> (.*)$/gm, '<blockquote class="border-l-4 border-primary/40 pl-3 text-slate-600">$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-100 rounded text-sm">$1</code>')
    .replace(/\n- (.*)/g, '<ul class="list-disc list-inside"><li>$1</li></ul>')
    .replace(/\$(.+?)\$/g, '<span class="font-mono text-primary">$1</span>')
    .replace(/\n\n/g, '<br/><br/>')

  return html
}

async function toBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function loadHistory() {
  if (!isLoggedIn.value) return
  try {
    const res = await fetch('/api/ocr/history')
    if (res.ok) {
      history.value = await res.json()
    }
  } catch (e) {
    console.warn('历史记录加载失败', e)
  }
}

async function upload() {
  if (!file.value) return
  error.value = ''
  status.value = 'uploading'
  progress.value = 10

  try {
    const contentBase64 = await toBase64(file.value)
    const res = await fetch('/api/ocr/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.value.name,
        mimeType: file.value.type,
        contentBase64
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '上传失败')
    }

      const data = await res.json()
      taskId.value = data.taskId
      status.value = 'processing'
      progress.value = data.progress ?? 20
      pollStatus()
      loadHistory()
    } catch (e: any) {
      status.value = 'error'
      error.value = e.message || '上传失败'
    }
}

async function pollStatus() {
  if (!taskId.value) return
  try {
    const res = await fetch(`/api/ocr/status/${taskId.value}`)
    if (!res.ok) {
      throw new Error('状态查询失败')
    }
    const data = await res.json()
    progress.value = data.progress ?? progress.value
    if (data.status === 'done') {
      status.value = 'done'
      await fetchResult()
      return
    }
    if (data.status === 'error') {
      status.value = 'error'
      error.value = data.error || '解析失败'
      return
    }
    status.value = data.status ?? 'processing'
  } catch (e: any) {
    error.value = e.message
    status.value = 'error'
  }

  timer = window.setTimeout(pollStatus, 1200)
}

async function fetchResult() {
  if (!taskId.value) return
  const res = await fetch(`/api/ocr/result/${taskId.value}`)
  if (res.ok) {
    const data = await res.json()
    zipUrl.value = data.fullZipUrl || ''
    result.value = data.result || ''
    if (data.status === 'done') {
      status.value = 'done'
    } else if (data.status === 'error') {
      status.value = 'error'
    }
  } else {
    error.value = '获取解析结果失败'
  }
}

onBeforeUnmount(() => {
  if (timer) {
    window.clearTimeout(timer)
  }
})

onMounted(() => {
  loadHistory()
})

function viewHistory(item: HistoryItem) {
  taskId.value = item.id
  status.value = (item.status as Status) ?? 'processing'
  zipUrl.value = item.fullZipUrl || ''
  fetchResult()
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto space-y-6">
    <div class="flex flex-col gap-3">
      <h1 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Icon icon="mdi:text-recognition" class="text-primary text-3xl" />
        智能 OCR 解析 (MinerU)
      </h1>
      <p class="text-slate-600">上传教材或试卷，获取结构化 Markdown 结果，支持公式与表格。</p>
      <div v-if="!isLoggedIn" class="p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-sm">
        请先登录以调用解析服务。
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div
          class="relative border-2 border-dashed border-slate-300 rounded-xl h-64 flex flex-col items-center justify-center p-4 transition-all duration-200"
          :class="file ? 'border-primary bg-primary/5' : 'hover:border-primary'"
          @dragover="preventDefault"
          @drop="handleDrop"
        >
          <input type="file" class="absolute opacity-0 w-full h-full" @change="handleFileChange" accept=".pdf,image/*" />
          <Icon icon="mdi:cloud-upload" class="w-12 h-12 text-slate-400 mb-2" />
          <p class="text-slate-600">{{ file ? file.name : '点击或拖拽上传文件 (PDF/图片)' }}</p>
          <p class="text-xs text-slate-400 mt-1">文件将通过 BFF 转发至 MinerU，开发环境自动使用 Mock。</p>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-4 py-2 rounded-lg text-white bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="!file || isWorking || !isLoggedIn"
            @click="upload"
          >
            {{ isWorking ? '处理中...' : '开始解析' }}
          </button>
          <button class="text-slate-500 text-sm underline" @click="reset">重置</button>
        </div>

        <div v-if="isWorking" class="mt-2">
          <div class="flex justify-between text-xs text-slate-500 mb-1">
            <span>进度</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-primary to-primary-dark transition-all" :style="{ width: `${progress}%` }"></div>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
          {{ error }}
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[320px]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">解析结果预览</h3>
          <span class="text-xs px-2 py-1 rounded-full" :class="{
            'bg-slate-100 text-slate-600': status === 'idle',
            'bg-blue-100 text-blue-700': status === 'processing' || status === 'uploading',
            'bg-green-100 text-green-700': status === 'done',
            'bg-red-100 text-red-700': status === 'error'
          }">
            {{ status }}
          </span>
        </div>

        <div v-if="zipUrl" class="mb-3">
          <div class="flex gap-3">
            <a :href="zipUrl" target="_blank" rel="noopener" class="text-primary underline text-sm flex items-center gap-1">
              <Icon icon="mdi:folder-zip" class="w-4 h-4" />
              原始 ZIP
            </a>
            <a :href="`/api/ocr/export/${taskId}?format=docx`" target="_blank" rel="noopener" class="text-primary underline text-sm flex items-center gap-1">
              <Icon icon="mdi:file-word" class="w-4 h-4" />
              导出 Word
            </a>
            <a :href="`/api/ocr/export/${taskId}?format=pdf`" target="_blank" rel="noopener" class="text-primary underline text-sm flex items-center gap-1">
              <Icon icon="mdi:file-pdf-box" class="w-4 h-4" />
              导出 PDF
            </a>
          </div>
        </div>

        <div v-if="result" class="prose prose-sm max-w-none text-slate-800" v-html="renderMarkdown(result)" />
        <div v-else class="h-full flex items-center justify-center text-slate-400 text-sm">
          等待解析结果...
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">我的解析历史</h3>
        <button class="text-sm text-primary hover:underline" @click="loadHistory">刷新</button>
      </div>
      <div v-if="history.length === 0" class="text-slate-500 text-sm">暂无记录</div>
      <div v-else class="divide-y divide-slate-100">
        <div v-for="item in history" :key="item.id" class="py-3 flex items-center justify-between">
          <div>
            <p class="font-medium text-slate-800">{{ item.fileName }}</p>
            <p class="text-xs text-slate-400">{{ item.createdAt ? new Date(item.createdAt).toLocaleString() : '' }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs px-2 py-1 rounded-full"
              :class="{
                'bg-blue-100 text-blue-700': item.status === 'processing',
                'bg-green-100 text-green-700': item.status === 'done',
                'bg-red-100 text-red-700': item.status === 'error',
                'bg-slate-100 text-slate-600': item.status === 'queued'
              }"
            >
              {{ item.status }}
            </span>
            <button class="text-primary text-sm hover:underline" @click="viewHistory(item)">
              查看
            </button>
            <a v-if="item.fullZipUrl" :href="item.fullZipUrl" target="_blank" rel="noopener" class="text-sm text-primary underline">
              下载
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
