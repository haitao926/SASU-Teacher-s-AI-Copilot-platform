<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

const API_BASE = '/api/grading'

const assignments = ref<any[]>([])
const submissions = ref<any[]>([])
const loading = ref(false)
const selectedAssignment = ref('')
const newAssignment = ref({ name: '', subject: '', description: '' })
const answerJson = ref('[{"questionId":"Q1","questionType":"single","content":"A","points":5}]')
const sampleSubmission = ref('[{"questionId":"Q1","answer":"A"}]')
const message = ref('')

async function loadAssignments() {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/assignments`)
    if (!res.ok) throw new Error('加载失败')
    assignments.value = await res.json()
    if (assignments.value.length > 0 && !selectedAssignment.value) {
      selectedAssignment.value = assignments.value[0].id
      await loadSubmissions()
    }
  } catch (e: any) {
    message.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function createAssignment() {
  message.value = ''
  const body = { ...newAssignment.value }
  if (!body.name || !body.subject) {
    message.value = '请填写名称与学科'
    return
  }
  const res = await fetch(`${API_BASE}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    message.value = '创建失败'
    return
  }
  newAssignment.value = { name: '', subject: '', description: '' }
  await loadAssignments()
}

async function uploadAnswerKeys() {
  if (!selectedAssignment.value) {
    message.value = '请选择作业'
    return
  }
  try {
    const items = JSON.parse(answerJson.value)
    const res = await fetch(`${API_BASE}/answer-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: selectedAssignment.value, items })
    })
    if (!res.ok) throw new Error('上传失败')
    message.value = '答案上传成功'
  } catch (e: any) {
    message.value = e.message || '上传失败'
  }
}

async function submitSample() {
  if (!selectedAssignment.value) {
    message.value = '请选择作业'
    return
  }
  try {
    const answers = JSON.parse(sampleSubmission.value)
    const res = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId: selectedAssignment.value,
        studentId: 'mock-student',
        answers
      })
    })
    if (!res.ok) throw new Error('提交失败')
    message.value = '已提交并自动判分（客观题）'
    await loadSubmissions()
  } catch (e: any) {
    message.value = e.message || '提交失败'
  }
}

async function loadSubmissions() {
  if (!selectedAssignment.value) return
  const res = await fetch(`${API_BASE}/submissions?assignmentId=${selectedAssignment.value}`)
  if (res.ok) {
    submissions.value = await res.json()
  }
}

async function exportCsv() {
  if (!selectedAssignment.value) {
    message.value = '请选择作业'
    return
  }
  const res = await fetch(`${API_BASE}/export?assignmentId=${selectedAssignment.value}`)
  if (!res.ok) {
    message.value = '导出失败'
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `grading_${selectedAssignment.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadAssignments()
})
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-6">
    <header class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:checkbox-marked-outline" class="text-primary w-6 h-6" />
        <div>
          <h1 class="text-2xl font-bold">智能阅卷 / 批改</h1>
          <p class="text-sm text-gray-500">上传答案，提交作答，自动判分客观题，导出成绩</p>
        </div>
      </div>
      <button @click="exportCsv" class="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-1">
        <Icon icon="mdi:file-download" />
        导出成绩 CSV
      </button>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white border rounded-lg p-4 space-y-3">
        <h3 class="font-bold text-gray-800 flex items-center gap-2">
          <Icon icon="mdi:plus-box" /> 创建作业/试卷
        </h3>
        <input v-model="newAssignment.name" class="border rounded px-3 py-2 w-full" placeholder="名称" />
        <input v-model="newAssignment.subject" class="border rounded px-3 py-2 w-full" placeholder="学科" />
        <textarea v-model="newAssignment.description" class="border rounded px-3 py-2 w-full" placeholder="描述（可选）"></textarea>
        <button @click="createAssignment" class="px-4 py-2 bg-indigo-600 text-white rounded">创建</button>
      </div>

      <div class="bg-white border rounded-lg p-4 space-y-3">
        <h3 class="font-bold text-gray-800 flex items-center gap-2">
          <Icon icon="mdi:format-list-bulleted" /> 作业列表
        </h3>
        <div v-if="assignments.length === 0" class="text-sm text-gray-500">暂无作业</div>
        <div class="space-y-2">
          <label v-for="a in assignments" :key="a.id" class="flex items-center gap-2 text-sm">
            <input type="radio" v-model="selectedAssignment" :value="a.id" @change="loadSubmissions" />
            <span>{{ a.name }} · {{ a.subject }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white border rounded-lg p-4 space-y-3">
        <h3 class="font-bold text-gray-800 flex items-center gap-2">
          <Icon icon="mdi:key" /> 上传标准答案 (JSON)
        </h3>
        <textarea v-model="answerJson" class="border rounded px-3 py-2 w-full h-32"></textarea>
        <button @click="uploadAnswerKeys" class="px-4 py-2 bg-indigo-600 text-white rounded">上传答案</button>
      </div>
      <div class="bg-white border rounded-lg p-4 space-y-3">
        <h3 class="font-bold text-gray-800 flex items-center gap-2">
          <Icon icon="mdi:upload" /> 提交示例答卷 (JSON)
        </h3>
        <textarea v-model="sampleSubmission" class="border rounded px-3 py-2 w-full h-32"></textarea>
        <button @click="submitSample" class="px-4 py-2 bg-indigo-600 text-white rounded">提交并判分</button>
      </div>
    </div>

    <div class="bg-white border rounded-lg p-4">
      <div class="flex items-center gap-2 mb-3">
        <Icon icon="mdi:clipboard-list" />
        <h3 class="font-bold text-gray-800">提交列表</h3>
      </div>
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-gray-600 border-b">
              <th class="py-2">学生</th>
              <th class="py-2">状态</th>
              <th class="py-2">得分</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in submissions" :key="s.id" class="border-b last:border-0">
              <td class="py-2">{{ s.student?.name || s.studentId }}</td>
              <td class="py-2">{{ s.status }}</td>
              <td class="py-2">{{ s.totalScore }}</td>
            </tr>
            <tr v-if="submissions.length === 0">
              <td class="py-2 text-gray-400" colspan="3">暂无提交</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="message" class="text-sm text-red-600">{{ message }}</div>
  </div>
</template>
