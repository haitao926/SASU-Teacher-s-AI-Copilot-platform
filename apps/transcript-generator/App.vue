<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage, useDebounceFn } from '@vueuse/core'

const token = useStorage('iai-token', '')
const searchQuery = ref('')
const students = ref<any[]>([])
const exams = ref<any[]>([])
const selectedExamId = ref('')
const selectedStudent = ref<any>(null)
const generating = ref(false)

// 后端地址
const TRANSCRIPT_API = '/api/academic/transcript'

onMounted(async () => {
  await fetchExams()
})

async function fetchExams() {
  try {
    const res = await fetch(`${TRANSCRIPT_API}/exams`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      exams.value = await res.json()
      if (exams.value.length > 0) selectedExamId.value = exams.value[0].id
    }
  } catch (e) {
    console.error('Failed to fetch exams', e)
  }
}

const handleSearch = useDebounceFn(async () => {
  if (!searchQuery.value) {
    students.value = []
    return
  }
  try {
    const res = await fetch(`${TRANSCRIPT_API}/students?q=${encodeURIComponent(searchQuery.value)}`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      students.value = await res.json()
    }
  } catch (e) {
    console.error('Search failed', e)
  }
}, 300)

watch(searchQuery, handleSearch)

async function generatePDF() {
  if (!selectedStudent.value) return
  generating.value = true
  try {
    const url = `${TRANSCRIPT_API}/export/${selectedStudent.value.id}?examId=${selectedExamId.value || ''}`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    
    if (!res.ok) throw new Error('Generation failed')
    
    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `成绩单_${selectedStudent.value.name}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (e) {
    alert('生成失败，请重试')
    console.error(e)
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 class="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <Icon icon="mdi:printer" class="text-indigo-600" /> 成绩证明生成器
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- 1. 选择考试 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">选择考试/学期</label>
          <select v-model="selectedExamId" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            <option v-for="exam in exams" :key="exam.id" :value="exam.id">
              {{ exam.name }} ({{ new Date(exam.date).toLocaleDateString() }})
            </option>
          </select>
        </div>

        <!-- 2. 搜索学生 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">输入学生姓名</label>
          <div class="relative">
            <Icon icon="mdi:magnify" class="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="例如：陈牧心" 
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <!-- Search Results Dropdown -->
          <div v-if="students.length > 0" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div 
              v-for="student in students" 
              :key="student.id"
              @click="selectedStudent = student; students = []; searchQuery = student.name"
              class="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-100 flex justify-between items-center"
            >
              <span class="font-medium text-gray-800">{{ student.name }}</span>
              <span class="text-xs text-gray-500">{{ student.class }}班 | {{ student.studentId }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview / Action Area -->
      <div v-if="selectedStudent" class="bg-indigo-50 rounded-xl p-6 border border-indigo-100 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
            <Icon icon="mdi:account-school" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-sm text-indigo-900 font-medium">即将生成</p>
            <p class="text-lg font-bold text-indigo-700">{{ selectedStudent.name }} 的成绩证明</p>
            <p class="text-xs text-indigo-500">学号: {{ selectedStudent.studentId }}</p>
          </div>
        </div>
        
        <button 
          @click="generatePDF"
          :disabled="generating"
          class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Icon v-if="generating" icon="mdi:loading" class="animate-spin" />
          <Icon v-else icon="mdi:file-certificate" />
          {{ generating ? '生成中...' : '下载 PDF 证明' }}
        </button>
      </div>

      <div v-else class="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
         <Icon icon="mdi:text-box-search-outline" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
         <p class="text-gray-400">请在上方搜索并选择一位学生</p>
      </div>

    </div>
  </div>
</template>
