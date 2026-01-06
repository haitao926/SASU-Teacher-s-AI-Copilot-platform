<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

const API_BASE = '/api/academic/scores'
// Use relative path or configured alias if possible, or keep absolute for now
const STATS_APP_URL = 'http://localhost:5174' 

const exams = ref<{ id: string; name: string; date: string; type: string }[]>([])
const selectedExam = ref('')
const classFilter = ref('')
const summary = ref<{ total: number; average: number; max: number; min: number } | null>(null)
const loadingSummary = ref(false)
const loadingExport = ref(false)
const errorMsg = ref('')

async function fetchExams() {
  try {
    const res = await fetch(`${API_BASE}/exams`)
    if (!res.ok) throw new Error('无法获取考试列表')
    const data = await res.json()
    exams.value = Array.isArray(data) ? data : []
    if (exams.value.length > 0 && !selectedExam.value) {
      const first = exams.value[0]
      if (first?.id) {
        selectedExam.value = first.id
      }
      await fetchSummary()
    }
  } catch (err: any) {
    errorMsg.value = err.message || '获取考试列表失败'
  }
}

async function fetchSummary() {
  if (!selectedExam.value) return
  loadingSummary.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ examId: selectedExam.value })
    if (classFilter.value) params.set('class', classFilter.value)
    const res = await fetch(`${API_BASE}/scores/summary?${params.toString()}`)
    if (!res.ok) throw new Error('获取成绩概览失败')
    summary.value = await res.json()
  } catch (err: any) {
    errorMsg.value = err.message || '获取成绩概览失败'
    summary.value = null
  } finally {
    loadingSummary.value = false
  }
}

async function exportScores() {
  if (!selectedExam.value) {
    errorMsg.value = '请先选择考试'
    return
  }
  loadingExport.value = true
  errorMsg.value = ''
  try {
    const params = new URLSearchParams({ examId: selectedExam.value, format: 'csv' })
    if (classFilter.value) params.set('class', classFilter.value)
    const res = await fetch(`${API_BASE}/scores/export?${params.toString()}`)
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scores_${selectedExam.value}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (err: any) {
    errorMsg.value = err.message || '导出失败'
  } finally {
    loadingExport.value = false
  }
}

function openUploader() {
  // Direct to the separate app URL
  window.open(STATS_APP_URL, '_blank', 'noopener')
}

onMounted(() => {
  fetchExams()
})
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:chart-box" class="text-primary w-6 h-6" />
        <div>
          <h1 class="text-2xl font-bold">学生成绩与学情</h1>
          <p class="text-sm text-gray-500">支持教师/教务上传成绩、导出表单（CSV，可转 PDF）、查看概览</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="openUploader" class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow-sm hover:bg-primary/90">
          <Icon icon="mdi:upload" />
          成绩上传入口
        </button>
        <button @click="exportScores" :disabled="loadingExport" class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60">
          <Icon icon="mdi:file-download" />
          {{ loadingExport ? '导出中...' : '导出成绩表 (CSV)' }}
        </button>
      </div>
    </header>

    <div class="bg-white border border-gray-100 rounded-xl p-4 md:p-6 shadow-sm mb-6 flex flex-col gap-4">
      <div class="flex flex-col md:flex-row md:items-center gap-4">
        <div class="flex-1">
          <label class="text-sm text-gray-600">选择考试</label>
          <select v-model="selectedExam" @change="fetchSummary" class="mt-1 w-full border rounded-lg px-3 py-2">
            <option value="" disabled>请选择</option>
            <option v-for="exam in exams" :key="exam.id" :value="exam.id">
              {{ exam.name }} ({{ exam.date?.slice(0, 10) }})
            </option>
          </select>
        </div>
        <div class="w-full md:w-64">
          <label class="text-sm text-gray-600">班级（可选）</label>
          <input v-model="classFilter" @keyup.enter="fetchSummary" class="mt-1 w-full border rounded-lg px-3 py-2" placeholder="如 701" />
        </div>
        <button @click="fetchSummary" class="h-10 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">刷新概览</button>
      </div>

      <div v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</div>

      <div v-if="summary && !loadingSummary" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-indigo-50 text-indigo-800 rounded-lg p-4">
          <p class="text-xs text-indigo-700">参考人数</p>
          <p class="text-2xl font-bold mt-1">{{ summary.total }}</p>
        </div>
        <div class="bg-green-50 text-green-800 rounded-lg p-4">
          <p class="text-xs text-green-700">平均分</p>
          <p class="text-2xl font-bold mt-1">{{ summary.average }}</p>
        </div>
        <div class="bg-blue-50 text-blue-800 rounded-lg p-4">
          <p class="text-xs text-blue-700">最高分</p>
          <p class="text-2xl font-bold mt-1">{{ summary.max }}</p>
        </div>
        <div class="bg-orange-50 text-orange-800 rounded-lg p-4">
          <p class="text-xs text-orange-700">最低分</p>
          <p class="text-2xl font-bold mt-1">{{ summary.min }}</p>
        </div>
      </div>

      <div v-else-if="loadingSummary" class="text-sm text-gray-500">加载中...</div>
      <div v-else class="text-sm text-gray-400">请选择考试查看概览</div>
    </div>

    <div class="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
      <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Icon icon="mdi:lightbulb-outline" />
        使用说明
      </h3>
      <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
        <li>教师/教务在“成绩上传入口”中上传 Excel，系统自动写入 BFF（/api/academic/scores）。</li>
        <li>在上方选择考试及班级后，可直接导出成绩表为 CSV（可在本地用 Excel/PDF 打印）。</li>
        <li>如需更复杂的报表/可视化，可在学生成绩小应用中查看（默认跳转 {{ STATS_APP_URL }}）。</li>
      </ul>
    </div>
  </div>
</template>
