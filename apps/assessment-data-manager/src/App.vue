<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'

const token = useStorage('iai-token', '')

// Exam Data
const allExams = ref<any[]>([])
const loadingExams = ref(false)
const deletingExamId = ref<string | null>(null)

// Filters
const selectedGrade = ref('all')
const selectedClass = ref('all')

// Import State
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importExamName = ref('')
const importing = ref(false)
const importResult = ref<string>('')

// Import Configuration
const importConfig = ref({
  cohort: '2026',
  gradeLevel: '高二',
  semester: '上',
  type: '期末',
  scope: 'class', // Default to Class scope for teacher uploads
  classNum: '1',
  subject: 'all'
})

// Auto-generate exam name
watch(importConfig, (newVal) => {
  const base = `${newVal.cohort}届 ${newVal.gradeLevel}${newVal.semester}`
  const suffix = newVal.type
  let name = ''
  
  if (newVal.scope === 'class') {
    name = `${base} (${newVal.classNum}班) ${suffix}`
  } else {
    name = `${base} ${suffix}`
  }

  if (newVal.subject && newVal.subject !== 'all') {
    name += ` - ${newVal.subject}`
  }
  
  importExamName.value = name
}, { deep: true, immediate: true })

const cohorts = computed(() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => String(currentYear - 2 + i)) // e.g. 2024-2029
})

const gradeLevels = ['三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级', '高一', '高二', '高三']
const semesters = ['上', '下']
const examTypes = ['期中', '期末', '月考', '周测', '模拟考']
const subjects = ['all', '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '技术']
const classes = Array.from({ length: 10 }, (_, i) => String(i + 1))

// Parsing Helper
function parseExamInfo(name: string) {
  const gradeMatch = name.match(/(高[一二三]|(?:[三四五六七八九]年级))/)
  const classMatch = name.match(/(\d+)班/)
  return {
    grade: gradeMatch ? gradeMatch[1] : '其他',
    classNum: classMatch ? classMatch[1] : null
  }
}

// Filtered Exams
const filteredExams = computed(() => {
  return allExams.value.filter(exam => {
    const info = parseExamInfo(exam.name)
    
    // Grade Filter
    if (selectedGrade.value !== 'all' && info.grade !== selectedGrade.value) {
      return false
    }
    
    // Class Filter
    // If 'all' selected, show everything.
    // If specific class selected, show exams for that class OR grade-wide exams (maybe?)
    // Usually user wants to see specific class exams if filtered.
    // Let's strict filter: if selecting Class 1, only show exams tagged Class 1.
    // BUT grade-wide exams apply to Class 1 too. This is tricky.
    // User Requirement: "Display by Grade and Class".
    // If I select "Class 1", I expect to see Class 1's specific tests AND Grade exams (which contain Class 1).
    // Logic: 
    // IF selectedClass != all:
    //    Show if exam is explicitly Class X OR exam has NO class (Grade scope).
    if (selectedClass.value !== 'all') {
      if (info.classNum && info.classNum !== selectedClass.value) return false
      // If info.classNum is null (Grade exam), we keep it (it applies to all classes)
    }
    
    return true
  })
})

// Dashboard Stats
const stats = computed(() => {
  const total = allExams.value.length
  const records = allExams.value.reduce((acc, e) => acc + (e.scoreCount || 0), 0)
  const lastDate = allExams.value.length > 0 
    ? new Date(Math.max(...allExams.value.map(e => new Date(e.date).getTime())))
    : null
  
  return { total, records, lastDate }
})

// Login State
const showLoginModal = ref(false)
const loginForm = ref({ username: 'admin', password: 'password' })
const loggingIn = ref(false)
const loginError = ref('')

const TRANSCRIPT_API = '/api/academic/transcript'
const API_AUTH = '/api/auth/login'

function authHeaders() {
  return (token.value ? { Authorization: `Bearer ${token.value}` } : {}) as Record<string, string>
}

// Check auth on mount
onMounted(() => {
  if (!token.value) {
    showLoginModal.value = true
  } else {
    fetchExams()
  }
})

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
    fetchExams()
  } catch (e: any) {
    loginError.value = e.message
  } finally {
    loggingIn.value = false
  }
}

async function fetchExams() {
  loadingExams.value = true
  try {
    const res = await fetch(`${TRANSCRIPT_API}/exams`, {
      headers: authHeaders()
    })
    if (res.ok) {
      allExams.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to fetch exams', e)
  } finally {
    loadingExams.value = false
  }
}

async function deleteExam(examId: string) {
  if (!confirm('确定要删除这场考试吗？相关的学生成绩也将被清除，且无法恢复。')) return
  
  deletingExamId.value = examId
  try {
    const res = await fetch(`${TRANSCRIPT_API}/exams/${examId}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '删除失败')
    }
    
    await fetchExams()
  } catch (e: any) {
    alert(`删除失败: ${e.message}`)
  } finally {
    deletingExamId.value = null
  }
}

function openImportModal() {
  importFile.value = null
  importResult.value = ''
  showImportModal.value = true
}

async function handleImport() {
  if (!importFile.value || !importExamName.value) return
  importing.value = true
  importResult.value = ''
  
  const formData = new FormData()
  formData.append('file', importFile.value)

  try {
    const url = `${TRANSCRIPT_API}/import?examName=${encodeURIComponent(importExamName.value)}&date=${new Date().toISOString()}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: formData
    })

    const resText = await res.text()
    let data
    try {
      data = JSON.parse(resText)
    } catch (e) {
      throw new Error(`Server Error (${res.status}): ${resText.slice(0, 100) || res.statusText}`)
    }

    if (data.success === false) {
      throw new Error(data.message || '导入失败 (Unknown Error)')
    }

    if (!res.ok) {
      throw new Error(data.message || '导入失败')
    }

    importResult.value = `导入成功: 新增/更新 ${data.createdScores} 条成绩记录。`
    setTimeout(() => {
      showImportModal.value = false
      fetchExams()
    }, 2000)
  } catch (e: any) {
    importResult.value = `错误: ${e.message}`
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-8">
    <div class="max-w-6xl mx-auto">
      
      <!-- Header -->
      <header class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <div class="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
              <Icon icon="mdi:database-edit-outline" class="w-8 h-8" />
            </div>
            测评数据管理
          </h1>
          <p class="text-slate-500 mt-2 ml-1">
            集中管理考试数据，支持 Excel/ZIP 批量上传、覆盖与清理
          </p>
        </div>
        
        <button 
          @click="openImportModal"
          class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <Icon icon="mdi:cloud-upload" class="w-5 h-5" />
          上传新考试数据
        </button>
      </header>

      <!-- Dashboard Overview -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-scale-in">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div class="absolute -right-4 -top-4 text-indigo-50 opacity-50 transform rotate-12">
            <Icon icon="mdi:folder-multiple" class="w-32 h-32" />
          </div>
          <div class="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 z-10">
            <Icon icon="mdi:folder-table-outline" class="w-8 h-8" />
          </div>
          <div class="z-10">
            <div class="text-sm text-gray-500 font-medium mb-1">已归档考试批次</div>
            <div class="text-3xl font-extrabold text-gray-900">{{ stats.total }} <span class="text-sm font-normal text-gray-400">场</span></div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div class="absolute -right-4 -top-4 text-emerald-50 opacity-50 transform rotate-12">
            <Icon icon="mdi:database" class="w-32 h-32" />
          </div>
          <div class="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 z-10">
            <Icon icon="mdi:database-check-outline" class="w-8 h-8" />
          </div>
          <div class="z-10">
            <div class="text-sm text-gray-500 font-medium mb-1">累计存储成绩记录</div>
            <div class="text-3xl font-extrabold text-gray-900">{{ stats.records.toLocaleString() }} <span class="text-sm font-normal text-gray-400">条</span></div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div class="absolute -right-4 -top-4 text-blue-50 opacity-50 transform rotate-12">
            <Icon icon="mdi:clock-time-eight" class="w-32 h-32" />
          </div>
          <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 z-10">
            <Icon icon="mdi:history" class="w-8 h-8" />
          </div>
          <div class="z-10">
            <div class="text-sm text-gray-500 font-medium mb-1">最近数据更新</div>
            <div class="text-lg font-bold text-gray-900 leading-tight">
              {{ stats.lastDate ? stats.lastDate.toLocaleDateString() : '暂无数据' }}
            </div>
            <div class="text-xs text-gray-400 mt-1" v-if="stats.lastDate">
              {{ Math.floor((Date.now() - stats.lastDate.getTime()) / (1000 * 60 * 60 * 24)) }} 天前
            </div>
          </div>
        </div>
      </div>

      <!-- Filters & List -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <!-- Filter Toolbar -->
        <div class="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-4 bg-gray-50/50">
          
          <!-- Grade Tabs -->
          <div class="flex bg-gray-200/50 p-1 rounded-xl gap-1">
            <button 
              @click="selectedGrade = 'all'"
              :class="selectedGrade === 'all' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-700'"
              class="px-4 py-1.5 rounded-lg text-sm transition-all"
            >
              全部年级
            </button>
            <button 
              v-for="g in gradeLevels" 
              :key="g"
              @click="selectedGrade = g"
              :class="selectedGrade === g ? 'bg-white shadow text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-700'"
              class="px-4 py-1.5 rounded-lg text-sm transition-all"
            >
              {{ g }}
            </button>
          </div>

          <!-- Class Filter -->
          <div class="flex items-center gap-2 md:ml-auto">
            <span class="text-sm font-medium text-gray-500">班级筛选:</span>
            <select v-model="selectedClass" class="text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white py-1.5 pl-2 pr-8">
              <option value="all">所有班级</option>
              <option v-for="c in classes" :key="c" :value="c">{{ c }}班</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto min-h-[300px]">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <tr>
                <th class="px-6 py-4">考试名称</th>
                <th class="px-6 py-4">分类</th>
                <th class="px-6 py-4">考试日期</th>
                <th class="px-6 py-4 text-center">成绩记录数</th>
                <th class="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="loadingExams">
                <td colspan="5" class="px-6 py-12 text-center text-gray-400">
                  <Icon icon="mdi:loading" class="animate-spin w-8 h-8 mx-auto mb-2 opacity-50" />
                  正在加载数据...
                </td>
              </tr>
              <tr v-else v-for="exam in filteredExams" :key="exam.id" class="hover:bg-indigo-50/30 transition-colors group">
                <td class="px-6 py-4">
                  <div class="font-bold text-gray-900 text-base">{{ exam.name }}</div>
                  <div class="text-xs text-gray-400 mt-0.5">{{ exam.id }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex gap-2">
                    <span class="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold">
                      {{ exam.type }}
                    </span>
                    <!-- Extract Subject Tag if present -->
                    <span v-if="exam.name.includes('-')" class="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold">
                      {{ exam.name.split('-').pop().trim() }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 text-gray-600">
                  <div class="flex items-center gap-1.5">
                    <Icon icon="mdi:calendar-blank-outline" class="text-gray-400" />
                    {{ new Date(exam.date).toLocaleDateString() }}
                  </div>
                </td>
                <td class="px-6 py-4 text-center">
                   <div class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold">
                     {{ exam.scoreCount }}
                   </div>
                </td>
                <td class="px-6 py-4 text-right">
                  <button 
                    @click="deleteExam(exam.id)" 
                    :disabled="deletingExamId === exam.id"
                    class="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all disabled:opacity-30 group-hover:text-red-500"
                    title="删除该场考试及所有相关成绩"
                  >
                    <Icon v-if="deletingExamId === exam.id" icon="mdi:loading" class="animate-spin w-5 h-5" />
                    <Icon v-else icon="mdi:trash-can-outline" class="w-5 h-5" />
                  </button>
                </td>
              </tr>
              <tr v-if="!loadingExams && filteredExams.length === 0">
                <td colspan="5" class="px-6 py-20 text-center">
                  <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <Icon icon="mdi:filter-off-outline" class="w-10 h-10" />
                  </div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">无匹配数据</h3>
                  <p class="text-gray-500 text-sm">当前筛选条件下暂无考试记录</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div v-if="showImportModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl animate-scale-in">
        <div class="flex justify-between items-start mb-6">
          <h3 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon="mdi:cloud-upload" class="text-indigo-600" /> 
            上传考试数据
          </h3>
          <button @click="showImportModal = false" class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <Icon icon="mdi:close" class="w-6 h-6" />
          </button>
        </div>
        
        <div class="space-y-5">
          <!-- Configuration -->
          <div class="bg-slate-50 p-5 rounded-xl border border-gray-200 space-y-4">
            <div class="flex gap-6 border-b border-gray-200 pb-4">
              <label class="flex items-center gap-2 cursor-pointer group">
                <input type="radio" v-model="importConfig.scope" value="grade" class="text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm font-bold text-gray-600 group-hover:text-gray-900">年级统考</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer group">
                <input type="radio" v-model="importConfig.scope" value="class" class="text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm font-bold text-gray-600 group-hover:text-gray-900">班级测验</span>
              </label>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">届数</label>
                <select v-model="importConfig.cohort" class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                  <option v-for="y in cohorts" :key="y" :value="y">{{ y }}届</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">年级</label>
                <select v-model="importConfig.gradeLevel" class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                  <option v-for="g in gradeLevels" :key="g" :value="g">{{ g }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">学期</label>
                <select v-model="importConfig.semester" class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                  <option v-for="s in semesters" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </div>

            <div class="grid gap-3" :class="importConfig.scope === 'class' ? 'grid-cols-3' : 'grid-cols-2'">
              <div>
                <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">考试类型</label>
                <select v-model="importConfig.type" class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                  <option v-for="t in examTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">学科</label>
                <select v-model="importConfig.subject" class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                  <option value="all">全科 (All)</option>
                  <option v-for="s in subjects.filter(x => x !== 'all')" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div v-if="importConfig.scope === 'class'">
                <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">班级</label>
                <select v-model="importConfig.classNum" class="w-full text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                  <option v-for="c in classes" :key="c" :value="c">{{ c }}班</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">生成的考试名称</label>
              <input v-model="importExamName" type="text" class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-300" placeholder="例如：2026届 高二上 期末" />
            </div>
          </div>
          
          <!-- File Drop -->
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">成绩文件</label>
            <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 hover:border-indigo-400 transition-all cursor-pointer relative group">
              <input type="file" accept=".xlsx, .xls, .zip" @change="e => importFile = (e.target as HTMLInputElement).files?.[0] || null" class="absolute inset-0 opacity-0 cursor-pointer z-10" />
              
              <div v-if="importFile" class="text-indigo-600 font-medium break-all flex flex-col items-center">
                <Icon icon="mdi:file-document-check" class="w-10 h-10 mb-2" />
                {{ importFile.name }}
                <span class="text-xs text-gray-400 mt-1 font-normal">点击更换文件</span>
              </div>
              <div v-else class="text-gray-400 group-hover:text-gray-500">
                <Icon icon="mdi:cloud-upload-outline" class="w-12 h-12 mx-auto mb-3 opacity-50 group-hover:scale-110 transition-transform" />
                <p class="font-medium">点击上传或拖拽文件至此</p>
                <p class="text-xs mt-1 opacity-70">支持 .xlsx, .zip (包含多个Excel)</p>
              </div>
            </div>
          </div>

          <!-- Result Message -->
          <div v-if="importResult" class="text-sm p-4 rounded-xl flex gap-3 items-start" :class="importResult.includes('错误') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'">
            <Icon :icon="importResult.includes('错误') ? 'mdi:alert-circle' : 'mdi:check-circle'" class="w-5 h-5 flex-shrink-0 mt-0.5" />
            {{ importResult }}
          </div>
        </div>

        <div class="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button @click="showImportModal = false" class="px-5 py-2.5 text-gray-500 hover:text-gray-800 font-medium transition-colors">取消</button>
          <button 
            @click="handleImport" 
            :disabled="!importFile || !importExamName || importing"
            class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition-all active:scale-95"
          >
            <Icon v-if="importing" icon="mdi:loading" class="animate-spin" />
            {{ importing ? '正在导入...' : '开始上传' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Login Modal -->
    <div v-if="showLoginModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div class="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl animate-scale-in text-center">
        <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon icon="mdi:shield-lock" class="w-8 h-8" />
        </div>
        
        <h3 class="text-2xl font-bold text-slate-900 mb-2">请先登录</h3>
        <p class="text-slate-500 mb-6 text-sm">需要验证身份以管理数据</p>

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
.animate-scale-in {
  animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>