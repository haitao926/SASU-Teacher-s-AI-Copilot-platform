<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useDropZone, useStorage } from '@vueuse/core'
import { read, utils } from 'xlsx'

const token = useStorage('iai-token', '')
const isDragging = ref(false)
const dropZoneRef = ref<HTMLElement | null>(null)
const filesData = ref<any[]>([])
const loading = ref(false)
const uploadStatus = ref<'idle' | 'success' | 'error'>('idle')
const statusMessage = ref('')
const exams = ref<any[]>([])
const selectedExam = ref('')

// 后端地址
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/academic/scores'

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const authToken = params.get('auth_token')
  if (authToken) {
    token.value = authToken
    // Clean URL
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname
    window.history.replaceState({ path: newUrl }, '', newUrl)
  }
  await fetchExams()
})

async function fetchExams() {
  try {
    const res = await fetch(`${API_BASE}/exams`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      exams.value = await res.json()
      if (exams.value.length > 0) selectedExam.value = exams.value[0].id
    }
  } catch (e) { console.error(e) }
}

async function processFile(file: File) {
  loading.value = true
  uploadStatus.value = 'idle'
  
  try {
    const data = await file.arrayBuffer()
    const workbook = read(data)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = utils.sheet_to_json(worksheet)
    
    if (jsonData.length === 0) throw new Error('Excel 文件为空')

    const mappedData = jsonData.map((row: any) => ({
      studentName: row['姓名'] || row['Name'],
      studentId: String(row['学号'] || row['ID']),
      className: String(row['班级'] || row['Class']),
      subject: row['科目'] || row['Subject'] || '综合',
      score: Number(row['成绩'] || row['分数'] || row['Score']),
      examName: row['考试名称'] || row['Exam'] || '默认考试'
    }))

    if (!mappedData[0].studentName || !mappedData[0].score) {
      throw new Error('Excel 格式不正确，缺少"姓名"或"成绩"列')
    }

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
        'x-tenant-id': 'default'
      },
      body: JSON.stringify({ data: mappedData })
    })

    if (!res.ok) throw new Error('上传失败: ' + res.statusText)

    const result = await res.json()
    uploadStatus.value = 'success'
    statusMessage.value = `成功导入 ${result.count} 条成绩数据！`
    filesData.value = mappedData
    await fetchExams() // Refresh exam list

  } catch (err: any) {
    console.error(err)
    uploadStatus.value = 'error'
    statusMessage.value = err.message || '处理文件时发生错误'
  } finally {
    loading.value = false
  }
}

function onDrop(files: File[] | null) {
  isDragging.value = false
  if (files && files.length > 0) processFile(files[0])
}

async function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    await processFile(input.files[0])
    input.value = ''
  }
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop,
  onEnter: () => isDragging.value = true,
  onLeave: () => isDragging.value = false,
})

// Export Logic
async function exportCsv() {
  if (!selectedExam.value) return
  const url = `${API_BASE}/export?examId=${selectedExam.value}&format=csv`
  window.open(url, '_blank')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between sticky top-0 z-50 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
          <Icon icon="mdi:chart-box" class="w-5 h-5" />
        </div>
        <h1 class="text-lg font-bold text-gray-900">学生成绩全景分析</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div v-if="exams.length > 0" class="flex items-center gap-2">
           <select v-model="selectedExam" class="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
             <option v-for="e in exams" :key="e.id" :value="e.id">{{ e.name }}</option>
           </select>
           <button @click="exportCsv" class="btn-secondary">
             <Icon icon="mdi:file-download" /> 导出 CSV
           </button>
        </div>
        
        <a href="http://localhost:5173" class="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
          <Icon icon="mdi:arrow-left" class="w-4 h-4" />
          返回工作台
        </a>
      </div>
    </header>

    <!-- Main -->
    <main class="flex-1 p-8 max-w-7xl mx-auto w-full">
      
      <div class="max-w-2xl mx-auto mt-12 text-center">
        <h2 class="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">
          让数据告诉您<br/>该如何教学
        </h2>
        <p class="text-lg text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
          上传期中/期末考试成绩单 (Excel)，系统将自动归档并提供多维度分析与导出功能。
        </p>

        <!-- Upload Zone -->
        <div v-if="uploadStatus !== 'success'"
          ref="dropZoneRef"
          class="border-2 border-dashed rounded-3xl p-12 transition-all duration-300 cursor-pointer group bg-white relative overflow-hidden shadow-sm hover:shadow-md"
          :class="[
            isOverDropZone ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50',
            uploadStatus === 'error' ? 'border-red-300 bg-red-50' : ''
          ]"
          @click="($refs.fileInput as HTMLInputElement).click()"
        >
           <div v-if="loading" class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
             <Icon icon="mdi:loading" class="w-12 h-12 text-indigo-600 animate-spin mb-3" />
             <p class="text-indigo-600 font-medium">正在解析并安全上传数据...</p>
           </div>

           <div class="flex flex-col items-center gap-4">
             <div class="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                :class="uploadStatus === 'error' ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-600'"
             >
               <Icon :icon="uploadStatus === 'error' ? 'mdi:alert-circle' : 'mdi:cloud-upload'" class="w-8 h-8" />
             </div>
             <div>
               <p class="text-lg font-bold text-slate-700">
                 {{ uploadStatus === 'error' ? '上传失败' : '点击或拖拽 Excel 文件到这里' }}
               </p>
               <p class="text-sm text-slate-400 mt-1">
                 {{ uploadStatus === 'error' ? statusMessage : '支持 .xlsx, .xls 格式' }}
               </p>
             </div>
             
             <button class="mt-4 px-6 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
               选择文件
             </button>
             <input type="file" ref="fileInput" class="hidden" @change="onFileSelect" accept=".xlsx,.xls" />
           </div>
        </div>

        <!-- Success State -->
        <div v-else class="bg-green-50 border border-green-200 rounded-3xl p-12 text-center animate-fade-in">
           <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
             <Icon icon="mdi:check-circle" class="w-10 h-10" />
           </div>
           <h2 class="text-2xl font-bold text-green-800 mb-2">导入成功！</h2>
           <p class="text-green-600 mb-8">{{ statusMessage }}</p>
           
           <div class="flex justify-center gap-4">
             <button @click="uploadStatus = 'idle'; filesData = []" class="px-6 py-2.5 bg-white border border-green-200 text-green-700 rounded-xl hover:bg-green-50 font-medium transition-colors">
               继续导入
             </button>
             <button @click="exportCsv" class="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium shadow-lg shadow-green-600/20 transition-all hover:-translate-y-0.5">
               导出本次成绩
             </button>
           </div>
        </div>

        <div class="mt-8">
          <button class="text-sm text-indigo-500 hover:text-indigo-700 font-medium flex items-center justify-center gap-1">
            <Icon icon="mdi:file-download-outline" />
            下载标准模板 (Excel)
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.btn-secondary {
  @apply px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors;
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
