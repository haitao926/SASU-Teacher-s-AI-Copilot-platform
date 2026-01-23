<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'

const token = useStorage('iai-token', '')
const exams = ref<any[]>([])
const selectedExam = ref<string>('')

// Analysis State
const analysisData = ref<any[]>([])
const analysisLoading = ref(false)
const selectedStudent = ref<any>(null)
const studentTrend = ref<any[]>([])
const showDetailModal = ref(false)

const API_BASE = '/api/academic/scores'

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
  if (exams.value.length > 0) {
    fetchAnalysis()
  }
})

async function fetchExams() {
  try {
    const res = await fetch(`${API_BASE}/exams`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      exams.value = await res.json()
      if (exams.value.length > 0 && !selectedExam.value) {
        selectedExam.value = exams.value[0].id
      }
    }
  } catch (e) { console.error(e) }
}

async function fetchAnalysis() {
  if (!selectedExam.value) return
  analysisLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/scores?examId=${selectedExam.value}&subject=总分&limit=1000`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      const data = await res.json()
      analysisData.value = data.items.map((item: any) => {
        let details: any = {}
        try { details = JSON.parse(item.details || '{}') } catch (e) {}
        return {
          ...item,
          rankClass: details['班级排名'] || '-',
          rankGrade: details['6排'] || details['rank'] || '-',
          totalCount: details['totalCount'] || '-'
        }
      }).sort((a: any, b: any) => b.value - a.value)
    }
  } catch (e) {
    console.error(e)
  } finally {
    analysisLoading.value = false
  }
}

async function openStudentDetail(student: any) {
  selectedStudent.value = student
  showDetailModal.value = true
  try {
    const res = await fetch(`${API_BASE}/scores/trend/${student.studentId}`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (res.ok) {
      studentTrend.value = await res.json()
    }
  } catch (e) { console.error(e) }
}

async function exportCsv() {
  if (!selectedExam.value) return
  try {
    const res = await fetch(`${API_BASE}/scores/export?examId=${encodeURIComponent(selectedExam.value)}&format=csv`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scores_${selectedExam.value}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (e: any) {
    alert(e.message || '导出失败')
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between sticky top-0 z-50 shadow-sm">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Icon icon="mdi:chart-box" class="w-5 h-5" />
          </div>
          <h1 class="text-lg font-bold text-gray-900">学生成绩全景分析</h1>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <div v-if="exams.length > 0" class="flex items-center gap-2">
           <select v-model="selectedExam" @change="fetchAnalysis()" class="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
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
      <div class="animate-fade-in">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 class="font-bold text-gray-800 flex items-center gap-2">
              <Icon icon="mdi:podium" class="text-indigo-500" /> 
              成绩排名 (总分)
            </h3>
            <span class="text-xs text-gray-500">共 {{ analysisData.length }} 人</span>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-600">
              <thead class="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                <tr>
                  <th class="px-6 py-3">排名</th>
                  <th class="px-6 py-3">姓名</th>
                  <th class="px-6 py-3">班级</th>
                  <th class="px-6 py-3 text-right">总分</th>
                  <th class="px-6 py-3 text-center">年级排名</th>
                  <th class="px-6 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="analysisLoading">
                  <td colspan="6" class="p-8 text-center text-gray-400">
                    <Icon icon="mdi:loading" class="animate-spin inline w-6 h-6" /> 加载中...
                  </td>
                </tr>
                <tr v-else v-for="(item, index) in analysisData" :key="item.id" class="hover:bg-indigo-50/50 transition-colors group">
                  <td class="px-6 py-4 font-bold text-gray-400">#{{ index + 1 }}</td>
                  <td class="px-6 py-4 font-bold text-gray-900">{{ item.student.name }}</td>
                  <td class="px-6 py-4">{{ item.student.class }}</td>
                  <td class="px-6 py-4 text-right font-mono font-bold text-indigo-600 text-lg">{{ item.value }}</td>
                  <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">{{ item.rankGrade }}</span>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <button @click="openStudentDetail(item.student)" class="text-indigo-600 hover:text-indigo-800 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      查看详情
                    </button>
                  </td>
                </tr>
                <tr v-if="!analysisLoading && analysisData.length === 0">
                  <td colspan="6" class="p-12 text-center text-gray-400">
                    <div class="flex flex-col items-center gap-2">
                       <Icon icon="mdi:database-off" class="w-8 h-8 text-gray-300" />
                       <p>暂无数据</p>
                       <p class="text-xs text-gray-400">请前往“测评数据管理”应用上传考试数据</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <!-- Student Detail Modal -->
    <div v-if="showDetailModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div class="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        <div class="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">{{ selectedStudent?.name }}</h3>
            <p class="text-sm text-gray-500">{{ selectedStudent?.class }} | {{ selectedStudent?.studentId }}</p>
          </div>
          <button @click="showDetailModal = false" class="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
            <Icon icon="mdi:close" class="w-6 h-6" />
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto pr-2">
          <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="mdi:history" /> 历史成绩趋势
          </h4>
          <div class="bg-slate-50 rounded-xl p-4 mb-6 border border-gray-200">
             <div class="space-y-2">
               <div v-for="s in studentTrend" :key="s.id" class="flex justify-between text-sm border-b border-gray-200 last:border-0 pb-2">
                 <span>{{ s.exam.name }} - {{ s.subject }}</span>
                 <span class="font-bold text-indigo-600">{{ s.value }}</span>
               </div>
               <div v-if="studentTrend.length === 0" class="text-center text-gray-400 py-4">暂无历史数据</div>
             </div>
          </div>
        </div>
      </div>
    </div>
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