<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Icon } from '@iconify/vue'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<Message[]>([
  { role: 'assistant', content: '你好！我是你的 AI 教学助手。我可以帮你查找资料、解答教学问题，或者协助备课。' }
])
const input = ref('')
const loading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const send = () => {
  if (!input.value.trim()) return
  
  messages.value.push({ role: 'user', content: input.value })
  const userMsg = input.value
  input.value = ''
  loading.value = true
  scrollToBottom()

  setTimeout(() => {
    messages.value.push({ role: 'assistant', content: `关于"${userMsg}"，这里有一些相关的教学资源和建议...\n\n(模拟 RAG 检索结果)` })
    loading.value = false
    scrollToBottom()
  }, 1000)
}
</script>

<template>
  <div class="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
    <div class="bg-white border-b px-6 py-4 flex justify-between items-center">
      <h1 class="text-lg font-bold flex items-center gap-2">
        <Icon icon="mdi:robot" class="text-primary text-2xl" />
        AI 教学助手 (RAG)
      </h1>
      <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Connected</span>
    </div>

    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-6">
      <div 
        v-for="(msg, idx) in messages" 
        :key="idx" 
        class="flex gap-4 max-w-4xl mx-auto"
        :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
      >
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'"
        >
          <Icon :icon="msg.role === 'user' ? 'mdi:account' : 'mdi:robot'" />
        </div>
        <div 
          class="max-w-[80%] p-4 rounded-2xl shadow-sm whitespace-pre-wrap"
          :class="msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'"
        >
          {{ msg.content }}
        </div>
      </div>
      <div v-if="loading" class="flex gap-4 max-w-4xl mx-auto">
        <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <Icon icon="mdi:robot" class="text-gray-600" />
        </div>
        <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm text-gray-400">
          <span class="animate-pulse">思考中...</span>
        </div>
      </div>
    </div>

    <div class="p-6 bg-white border-t">
      <div class="max-w-4xl mx-auto relative">
        <textarea 
          v-model="input" 
          @keydown.enter.prevent="send"
          placeholder="输入你的问题..."
          class="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-primary resize-none h-14"
        ></textarea>
        <button 
          @click="send"
          class="absolute right-2 top-2 p-2 text-primary hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Icon icon="mdi:send" class="w-6 h-6" />
        </button>
      </div>
    </div>
  </div>
</template>
