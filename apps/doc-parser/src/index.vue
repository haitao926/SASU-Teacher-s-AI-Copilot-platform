<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'
import { useDropZone } from '@vueuse/core'
import { marked } from 'marked'

interface OcrTask {
  id: string
  fileName: string
  status: 'queued' | 'processing' | 'done' | 'error'
  progress?: number
  result?: string
  fullZipUrl?: string // For original file reference if supported
  fileUrl?: string // Local preview url
  createdAt?: string
}

const { token } = useAuth()
const tasks = ref<OcrTask[]>([])
const activeTaskId = ref<string>('')
const loading = ref(false)
const showSaveDialog = ref(false)

// Save Asset Form
const saveForm = ref({
  title: '',
  type: 'courseware', // courseware, quiz, note
  tags: '',
  visibility: 'PRIVATE'
})
const saving = ref(false)

const activeTask = computed(() => tasks.value.find(t => t.id === activeTaskId.value))
const parsedHtml = computed(() => {
  if (!activeTask.value?.result) return ''
  return marked.parse(activeTask.value.result)
})

// File Upload
const dropZoneRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

onMounted(() => {
  fetchHistory()
})

async function fetchHistory() {
  try {
    const res = await fetch('/api/ocr/history', {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      const history = await res.json()
      tasks.value = history.map((h: any) => ({
        ...h,
        progress: h.status === 'done' ? 100 : 0
      }))
      // Select first one if exists
      if (tasks.value.length > 0 && !activeTaskId.value) {
        selectTask(tasks.value[0].id)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function uploadFile(file: File) {
  loading.value = true
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      
      const res = await fetch('/api/ocr/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.value}`
        },
        body: JSON.stringify({
          fileName: file.name,
          contentBase64: base64,
          mimeType: file.type,
          scene: 'doc'
        })
      })

      if (res.ok) {
        const data = await res.json()
        const newTask: OcrTask = {
          id: data.taskId,
          fileName: file.name,
          status: 'queued',
          progress: 0,
          fileUrl: URL.createObjectURL(file) // For preview
        }
        tasks.value.unshift(newTask)
        activeTaskId.value = newTask.id
        pollStatus(newTask.id)
      } else {
        alert('上传失败')
      }
      loading.value = false
    }
    reader.readAsDataURL(file)
  } catch (e) {
    console.error(e)
    loading.value = false
  }
}

async function pollStatus(id: string) {
  const timer = setInterval(async () => {
    const task = tasks.value.find(t => t.id === id)
    if (!task) {
      clearInterval(timer)
      return
    }

    try {
      // 1. Check Status
      const res = await fetch(`/api/ocr/status/${id}`, {
        headers: { 'Authorization': `Bearer ${token.value}` }
      })
      const statusData = await res.json()
      
      task.status = statusData.status
      task.progress = statusData.progress

      if (task.status === 'done') {
        clearInterval(timer)
        // 2. Fetch Result
        const res2 = await fetch(`/api/ocr/result/${id}`, {
          headers: { 'Authorization': `Bearer ${token.value}` }
        })
        const resultData = await res2.json()
        task.result = resultData.result
        task.fullZipUrl = resultData.fullZipUrl
      } else if (task.status === 'error') {
        clearInterval(timer)
      }
    } catch (e) {
      console.error(e)
    }
  }, 2000)
}

function selectTask(id: string) {
  activeTaskId.value = id
  const task = tasks.value.find(t => t.id === id)
  if (task && task.status === 'done' && !task.result) {
    // Retry fetch result if missing
    pollStatus(id)
  }
}

// Drag & Drop
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => {
    isDragging.value = false
    if (files && files.length > 0) uploadFile(files[0])
  },
  onEnter: () => isDragging.value = true,
  onLeave: () => isDragging.value = false,
})

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    uploadFile(input.files[0])
  }
}

// Save Asset Logic
function openSaveDialog() {
  if (!activeTask.value) return
  saveForm.value.title = activeTask.value.fileName.replace(/\.[^/.]+$/, "")
  saveForm.value.tags = ''
  showSaveDialog.value = true
}

async function handleSaveAsset() {
  if (!activeTask.value) return
  saving.value = true
  
  try {
    const tagsArray = saveForm.value.tags.split(/[,， ]+/).filter(Boolean)
    
    const res = await fetch(`/api/ocr/tasks/${activeTask.value.id}/save-asset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        title: saveForm.value.title,
        type: saveForm.value.type,
        tags: tagsArray,
        visibility: saveForm.value.visibility
      })
    })

    if (res.ok) {
      alert('已成功保存到资源库！')
      showSaveDialog.value = false
    } else {
      throw new Error('保存失败')
    }
  } catch (e) {
    alert('保存出错，请重试')
    console.error(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
    <!-- Top Bar -->
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
          <Icon icon="mdi:text-recognition" class="w-5 h-5" />
        </div>
        <div>
          <h1 class="font-bold text-gray-900 leading-tight">智能文档解析</h1>
          <p class="text-xs text-gray-500">支持 PDF/图片 转 Markdown/Word</p>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <a href="/" class="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
          <Icon icon="mdi:arrow-left" class="w-4 h-4" />
          返回工作台
        </a>
        <button 
          @click="($refs.fileInput as HTMLInputElement).click()"
          class="btn-secondary"
        >
          <Icon icon="mdi:plus" /> 新建解析
          <input type="file" ref="fileInput" class="hidden" @change="onFileSelect" accept=".pdf,.png,.jpg,.jpeg" />
        </button>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar: History -->
      <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div class="p-4 border-b border-gray-100">
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">历史记录</h3>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div 
            v-for="task in tasks" 
            :key="task.id"
            @click="selectTask(task.id)"
            class="p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
            :class="{ 'bg-indigo-50 border-l-4 border-l-indigo-600': activeTaskId === task.id }"
          >
            <div class="flex items-start gap-2">
              <Icon icon="mdi:file-document-outline" class="w-5 h-5 text-gray-400 mt-0.5" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 truncate" :title="task.fileName">{{ task.fileName }}</p>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-gray-500">{{ new Date(task.createdAt || Date.now()).toLocaleDateString() }}</span>
                  
                  <span v-if="task.status === 'done'" class="text-xs text-green-600 flex items-center gap-0.5">
                    <Icon icon="mdi:check-circle" class="w-3 h-3" /> 完成
                  </span>
                  <span v-else-if="task.status === 'error'" class="text-xs text-red-600">失败</span>
                  <span v-else class="text-xs text-indigo-600 flex items-center gap-0.5">
                    <Icon icon="mdi:loading" class="animate-spin w-3 h-3" /> {{ task.progress }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-w-0 bg-slate-100 relative">
        
        <!-- Empty State -->
        <div v-if="!activeTask" class="absolute inset-0 flex items-center justify-center p-8">
           <div 
             ref="dropZoneRef"
             class="max-w-xl w-full border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer"
             :class="isOverDropZone ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400'"
             @click="($refs.fileInput as HTMLInputElement).click()"
           >
             <Icon icon="mdi:cloud-upload" class="w-16 h-16 text-indigo-200 mx-auto mb-4" />
             <h3 class="text-xl font-bold text-gray-800 mb-2">点击或拖拽文件到这里</h3>
             <p class="text-gray-500">支持 PDF, PNG, JPG 文档，AI 自动还原版面</p>
           </div>
        </div>

        <!-- Split View -->
        <div v-else class="flex flex-1 overflow-hidden">
          
          <!-- Left: Original View (Placeholder for now) -->
          <div class="w-1/2 border-r border-gray-200 bg-gray-200 flex flex-col relative">
             <div class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-100">
                <div v-if="activeTask.fileUrl || activeTask.fullZipUrl" class="w-full h-full p-4">
                  <!-- Simple Image Preview if image -->
                  <img v-if="activeTask.fileName.match(/\.(png|jpg|jpeg)$/i)" :src="activeTask.fileUrl" class="w-full h-full object-contain" />
                  <!-- PDF iframe placeholder -->
                  <div v-else class="flex flex-col items-center justify-center h-full">
                     <Icon icon="mdi:file-pdf-box" class="w-20 h-20 text-red-400 mb-4" />
                     <p>PDF/文档 预览</p>
                     <p class="text-sm text-gray-500 mt-2">（原文件预览功能待完善）</p>
                  </div>
                </div>
                <div v-else class="text-center">
                  <Icon icon="mdi:eye-off-outline" class="w-12 h-12 mx-auto mb-2" />
                  <p>原文件未加载</p>
                </div>
             </div>
             <div class="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur-md">
               原始文档
             </div>
          </div>

          <!-- Right: Result View -->
          <div class="w-1/2 flex flex-col bg-white">
            <!-- Toolbar -->
            <div class="h-12 border-b border-gray-100 flex items-center justify-between px-4 shrink-0">
               <span class="text-xs font-bold text-gray-500 uppercase">解析结果 (Markdown)</span>
               
               <div class="flex items-center gap-2" v-if="activeTask.status === 'done'">
                 <a :href="`/api/ocr/export/${activeTask.id}?format=docx`" target="_blank" class="btn-xs-secondary">
                   <Icon icon="mdi:file-word-box" class="text-blue-600" /> Word
                 </a>
                 <a :href="`/api/ocr/export/${activeTask.id}?format=pdf`" target="_blank" class="btn-xs-secondary">
                   <Icon icon="mdi:file-pdf-box" class="text-red-600" /> PDF
                 </a>
                 <button @click="openSaveDialog" class="btn-xs-primary">
                   <Icon icon="mdi:content-save" /> 存入资源库
                 </button>
               </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-8 prose prose-indigo max-w-none">
               <div v-if="activeTask.status === 'done' && activeTask.result">
                 <div v-html="parsedHtml"></div>
               </div>
               <div v-else-if="activeTask.status === 'processing'" class="flex flex-col items-center justify-center h-full text-gray-400">
                 <Icon icon="mdi:loading" class="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <p>AI 正在全力解析中...</p>
                 <p class="text-xs mt-2">进度: {{ activeTask.progress }}%</p>
               </div>
               <div v-else-if="activeTask.status === 'error'" class="flex flex-col items-center justify-center h-full text-red-400">
                 <Icon icon="mdi:alert-circle" class="w-10 h-10 mb-4" />
                 <p>解析失败</p>
               </div>
            </div>
          </div>
        </div>

      </main>
    </div>

    <!-- Save Dialog -->
    <div v-if="showSaveDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-900">存入资源库</h3>
          <button @click="showSaveDialog = false" class="text-gray-400 hover:text-gray-600">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>
        
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">资源标题</label>
            <input v-model="saveForm.title" type="text" class="input-field" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">资源类型</label>
            <div class="grid grid-cols-3 gap-3">
              <button 
                type="button"
                v-for="t in [
                  { id: 'quiz-json', label: '试题资源', icon: 'mdi:format-list-checks' },
                  { id: 'courseware', label: '课件/讲义', icon: 'mdi:presentation' },
                  { id: 'note', label: '知识点/笔记', icon: 'mdi:notebook' }
                ]"
                :key="t.id"
                @click="saveForm.type = t.id"
                class="flex flex-col items-center justify-center p-3 rounded-lg border transition-all"
                :class="saveForm.type === t.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'"
              >
                <Icon :icon="t.icon" class="w-6 h-6 mb-1" />
                <span class="text-xs">{{ t.label }}</span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
            <input v-model="saveForm.tags" type="text" class="input-field" placeholder="例如：七年级, 数学, 期末复习" />
          </div>

          <div>
             <label class="block text-sm font-medium text-gray-700 mb-1">可见性</label>
             <select v-model="saveForm.visibility" class="input-field">
               <option value="PRIVATE">私有 (仅自己可见)</option>
               <option value="PUBLIC">公开 (全校可见)</option>
             </select>
          </div>
        </div>

        <div class="p-4 bg-gray-50 flex justify-end gap-3">
          <button @click="showSaveDialog = false" class="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">取消</button>
          <button @click="handleSaveAsset" :disabled="saving" class="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2">
            <Icon v-if="saving" icon="mdi:loading" class="animate-spin" />
            {{ saving ? '保存中...' : '确认保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-secondary {
  @apply px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors;
}
.btn-xs-secondary {
  @apply px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-50 flex items-center gap-1 transition-colors no-underline;
}
.btn-xs-primary {
  @apply px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1 transition-colors;
}
.input-field {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all;
}
.animate-scale-in {
  animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Scrollbar styling for sidebar */
aside::-webkit-scrollbar {
  width: 4px;
}
aside::-webkit-scrollbar-thumb {
  background-color: #e2e8f0;
  border-radius: 4px;
}
</style>