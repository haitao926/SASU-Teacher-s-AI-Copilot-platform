<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const API_BASE = '/api/quizzes'

const topic = ref('')
const knowledgePoints = ref('')
const difficulty = ref('medium')
const statusMsg = ref('')
const generated = ref<{ id: string; markdown: string } | null>(null)
const loading = ref(false)

async function generateQuiz() {
  loading.value = true
  statusMsg.value = ''
  generated.value = null
  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic.value || '示例试卷',
        knowledgePoints: knowledgePoints.value,
        difficulty: difficulty.value
      })
    })
    if (!res.ok) throw new Error('生成失败')
    const data = await res.json()
    generated.value = data
  } catch (e: any) {
    statusMsg.value = e.message || '生成失败'
  } finally {
    loading.value = false
  }
}

async function downloadMarkdown() {
  if (!generated.value) return
  const blob = new Blob([generated.value.markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${generated.value.id || 'quiz'}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-6">
    <header class="flex items-center gap-2">
      <Icon icon="mdi:file-document-edit" class="text-primary w-6 h-6" />
      <div>
        <h1 class="text-2xl font-bold">智能组卷</h1>
        <p class="text-sm text-gray-500">按知识点/难度生成试卷 Markdown，可下载编辑</p>
      </div>
    </header>

    <div class="bg-white border rounded-lg p-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="text-sm text-gray-600">试卷主题</label>
          <input v-model="topic" class="border rounded px-3 py-2 w-full" placeholder="如：七年级数学期中测验" />
        </div>
        <div>
          <label class="text-sm text-gray-600">知识点</label>
          <input v-model="knowledgePoints" class="border rounded px-3 py-2 w-full" placeholder="一元一次方程, 应用题" />
        </div>
        <div>
          <label class="text-sm text-gray-600">难度</label>
          <select v-model="difficulty" class="border rounded px-3 py-2 w-full">
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </div>
      </div>
      <button @click="generateQuiz" :disabled="loading" class="px-4 py-2 bg-indigo-600 text-white rounded">
        {{ loading ? '生成中...' : '生成试卷' }}
      </button>
      <div v-if="statusMsg" class="text-sm text-red-600">{{ statusMsg }}</div>
    </div>

    <div v-if="generated" class="bg-white border rounded-lg p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-gray-800">生成结果 (Markdown)</h3>
        <button @click="downloadMarkdown" class="px-3 py-1 bg-white border rounded hover:bg-gray-50">下载 Markdown</button>
      </div>
      <pre class="bg-gray-50 border rounded p-3 text-sm overflow-auto whitespace-pre-wrap">{{ generated.markdown }}</pre>
    </div>
  </div>
</template>
