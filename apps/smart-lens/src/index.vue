<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'
import MarkdownIt from 'markdown-it'
import mk from 'markdown-it-katex'
import 'katex/dist/katex.min.css'

// Init markdown
const md = new MarkdownIt({ html: true }).use(mk)

interface LensTask {
  id: string
  imageUrl: string
  result: string
  status: 'processing' | 'done' | 'error'
  createdAt: number
}

const { isLoggedIn } = useAuth()
const currentImage = ref<string | null>(null)
const currentResult = ref('')
const isProcessing = ref(false)
const history = ref<LensTask[]>([])
const error = ref('')

// Load history from local storage for MVP (since API is async)
onMounted(() => {
  const saved = localStorage.getItem('smart-lens-history')
  if (saved) {
    history.value = JSON.parse(saved)
  }
})

function saveHistory() {
  localStorage.setItem('smart-lens-history', JSON.stringify(history.value.slice(0, 20)))
}

async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      if (file) await processImage(file)
      break
    }
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) {
    await processImage(file)
  }
}

function preventDefault(e: Event) {
  e.preventDefault()
}

async function fileInput(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) {
    await processImage(target.files[0])
  }
}

async function processImage(file: File) {
  if (!isLoggedIn.value) {
    alert('请先登录后使用')
    return
  }
  error.value = ''
  isProcessing.value = true
  currentResult.value = ''
  
  // 1. Create preview immediately
  const reader = new FileReader()
  reader.onload = async (e) => {
    // Set preview first
    currentImage.value = e.target?.result as string
    
    // 2. Then upload
    try {
      const base64 = currentImage.value
      const res = await fetch('/api/ocr/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `lens-snap-${Date.now()}.png`,
          contentBase64: base64,
          scene: 'lens'
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `上传失败 (${res.status})`)
      }
      
      const { taskId } = await res.json()
      // 3. Poll for result
      await pollResult(taskId)

    } catch (e: any) {
      console.error('OCR Process Error:', e)
      error.value = e.message || '识别失败，请检查网络或 Key'
      isProcessing.value = false
    }
  }
  reader.readAsDataURL(file)
}

async function pollResult(taskId: string) {
  const timer = setInterval(async () => {
    try {
      const res = await fetch(`/api/ocr/result/${taskId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'done') {
          clearInterval(timer)
          currentResult.value = data.result || ''
          isProcessing.value = false
          // Add to history
          history.value.unshift({
            id: taskId,
            imageUrl: currentImage.value || '',
            result: data.result || '',
            status: 'done',
            createdAt: Date.now()
          })
          saveHistory()
        } else if (data.status === 'error') {
          clearInterval(timer)
          error.value = data.error || '识别出错'
          isProcessing.value = false
        }
      }
    } catch (e) {
      clearInterval(timer)
      isProcessing.value = false
    }
  }, 1000)
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  // toast?
}

function loadFromHistory(task: LensTask) {
  currentImage.value = task.imageUrl
  currentResult.value = task.result
}

const renderedResult = computed(() => {
  return md.render(currentResult.value || '')
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <!-- App Header -->
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div class="flex items-center gap-4">
        <router-link 
          to="/" 
          class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="返回首页"
        >
          <Icon icon="mdi:arrow-left" class="w-6 h-6" />
        </router-link>
        <div>
          <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            <div class="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <Icon icon="mdi:camera-iris" class="w-5 h-5" />
            </div>
            智能识图 (Smart Lens)
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">极速识别公式、化学分子式与文字，支持 LaTeX 导出</p>
        </div>
      </div>
      
      <!-- Optional: Settings or Help button could go here -->
    </header>

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex max-w-[1440px] w-full mx-auto p-8 gap-8">
      
      <!-- Workspace -->
      <main class="flex-1 flex gap-8 min-w-0" @paste="handlePaste">
        <!-- Input Area -->
        <section class="flex-1 flex flex-col gap-6">
           <div class="bg-white/80 border border-blue-100 rounded-2xl p-4 text-sm text-slate-600 flex items-start gap-3 shadow-sm backdrop-blur-sm">
              <div class="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Icon icon="mdi:information-outline" class="w-5 h-5" />
              </div>
              <div class="mt-0.5 leading-relaxed">
                <span class="font-bold text-slate-800">快捷操作：</span>
                直接按下 <kbd class="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-xs text-slate-500 mx-1">Ctrl + V</kbd> 粘贴截图，或拖拽图片到下方区域。
              </div>
           </div>

           <div 
            class="flex-1 bg-white rounded-3xl border-2 border-dashed border-slate-200 relative group overflow-hidden flex flex-col items-center justify-center transition-all duration-300 shadow-sm hover:border-blue-400/50 hover:bg-blue-50/30 hover:shadow-md"
            :class="{ 'border-blue-500 bg-blue-50/50': !currentImage, 'border-transparent bg-slate-100': currentImage }"
            @dragover="preventDefault"
            @drop="handleDrop"
          >
            <div v-if="currentImage" class="relative w-full h-full p-8 flex items-center justify-center">
               <img :src="currentImage" class="max-w-full max-h-full object-contain shadow-2xl rounded-xl" />
               
               <div class="absolute top-6 right-6 flex gap-2">
                 <button 
                   @click="currentImage = null; currentResult = ''" 
                   class="bg-white/90 p-2.5 rounded-xl shadow-lg hover:text-red-500 hover:scale-105 transition-all"
                   title="清除图片"
                 >
                   <Icon icon="mdi:delete-outline" class="w-5 h-5" />
                 </button>
               </div>
            </div>

            <div v-else class="text-center p-10 pointer-events-none">
              <div class="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <Icon icon="mdi:image-filter-center-focus" class="w-12 h-12" />
              </div>
              <h3 class="text-xl font-bold text-slate-700 mb-2">点击上传或拖拽图片</h3>
              <p class="text-slate-400 text-sm">支持 JPG, PNG, WEBP</p>
            </div>
            
            <input 
              v-if="!currentImage"
              type="file" 
              accept="image/*" 
              class="absolute inset-0 opacity-0 cursor-pointer"
              @change="fileInput"
            />
          </div>
        </section>

        <!-- Result Area -->
        <section class="flex-1 bg-white rounded-3xl border border-slate-200/60 flex flex-col overflow-hidden shadow-lg shadow-slate-200/50 relative">
          <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:text-recognition" class="text-slate-400" />
              识别结果
            </h3>
            <div class="flex gap-2" v-if="currentResult">
              <button 
                @click="copyText(currentResult)"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-white hover:border-primary hover:text-primary transition-all shadow-sm"
              >
                <Icon icon="mdi:content-copy" /> 复制源码
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6 relative bg-white">
            <div v-if="isProcessing" class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20 backdrop-blur-[1px]">
              <div class="w-16 h-16 border-4 border-blue-100 border-t-primary rounded-full animate-spin mb-4"></div>
              <p class="text-slate-600 font-medium animate-pulse">AI 正在识别公式...</p>
            </div>

            <div v-if="currentResult" class="prose prose-slate prose-sm max-w-none">
               <div v-html="renderedResult" class="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6"></div>
               
               <div class="relative group">
                 <div class="absolute -top-3 left-2 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-wider">LaTeX / Source</div>
                 <pre class="bg-slate-800 text-slate-200 p-4 rounded-xl text-xs overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-700">{{ currentResult }}</pre>
                 <button 
                    @click="copyText(currentResult)"
                    class="absolute top-2 right-2 p-1.5 bg-white/10 text-white rounded hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="复制"
                 >
                    <Icon icon="mdi:content-copy" class="w-4 h-4" />
                 </button>
               </div>
            </div>

            <div v-else-if="!isProcessing && !error" class="h-full flex flex-col items-center justify-center text-slate-300 select-none">
               <Icon icon="mdi:math-integral-box" class="text-7xl mb-4 opacity-50" />
               <p class="font-medium">等待图片输入...</p>
            </div>

            <div v-if="error" class="flex flex-col items-center justify-center h-full text-red-500 p-6 bg-red-50/50">
              <Icon icon="mdi:alert-circle" class="text-4xl mb-2" />
              <p class="text-sm font-medium">{{ error }}</p>
            </div>
          </div>
        </section>
      </main>

      <!-- History Sidebar -->
      <aside class="w-80 flex flex-col gap-4 hidden md:flex order-last shrink-0">
        <div class="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-200/50 flex flex-col overflow-hidden h-full">
          <div class="p-5 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm flex justify-between items-center">
            <span class="font-bold text-slate-700 flex items-center gap-2">
              <Icon icon="mdi:history" class="text-slate-400" /> 最近记录
            </span>
            <span class="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-200">{{ history.length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <div v-if="history.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400">
              <Icon icon="mdi:clipboard-text-clock-outline" class="text-4xl mb-2 opacity-30" />
              <p class="text-xs">暂无识别记录</p>
            </div>
            <div 
              v-for="task in history" 
              :key="task.id"
              class="group relative bg-white border border-slate-100 rounded-2xl p-3 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-300"
              @click="loadFromHistory(task)"
            >
              <div class="aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden mb-3 relative">
                 <img :src="task.imageUrl" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                 <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div class="flex justify-between items-center px-1">
                <span class="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Icon icon="mdi:clock-outline" class="w-3 h-3" />
                  {{ new Date(task.createdAt).toLocaleTimeString() }}
                </span>
                <span class="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100" v-if="task.status === 'done'">成功</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
