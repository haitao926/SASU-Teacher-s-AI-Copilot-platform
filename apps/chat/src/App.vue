<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'
import { useAuth } from '@/composables/useAuth'
import AssetPickerDialog from '@/components/assets/AssetPickerDialog.vue'

interface AssetView {
  id: string
  title: string
  summary?: string | null
  content?: string | null
  contentUrl?: string | null
  type: string
  tags?: string[]
  visibility: string
  updatedAt?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
}

const sessions = useStorage<ChatSession[]>('iai-chat-sessions', [])
const currentSessionId = ref<string | null>(null)
const input = ref('')
const streaming = ref(false)
const typingHint = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
let controller: AbortController | null = null
const saving = ref(false)

const { token } = useAuth()
const scenario = ref<string | undefined>(undefined)

const assetPickerOpen = ref(false)
const referencedAsset = ref<AssetView | null>(null)
const referencedAssetText = ref<string>('')

const presets = [
  {
    key: 'optimize',
    label: '一键润色',
    icon: 'mdi:sparkles'
  },
  {
    key: 'lesson-plan',
    label: '教案生成',
    icon: 'mdi:book-open-page-variant'
  }
]

const currentSession = computed(() =>
  sessions.value.find((s) => s.id === currentSessionId.value) ?? null
)

const currentMessages = computed(() => currentSession.value?.messages ?? [])

function ensureSession() {
  if (!currentSessionId.value) {
    const id = crypto.randomUUID()
    const session: ChatSession = {
      id,
      title: '新对话',
      createdAt: Date.now(),
      messages: [{ role: 'assistant', content: '你好，我是你的 AI 教学助手。有什么需要帮忙的吗？' }]
    }
    sessions.value.push(session)
    currentSessionId.value = id
  }
}

function newSession() {
  currentSessionId.value = null
  ensureSession()
}

function selectSession(id: string) {
  currentSessionId.value = id
  scrollToBottom()
}

const scrollToBottom = async () => {
  await nextTick()
  messagesContainer.value?.scrollTo({ top: messagesContainer.value.scrollHeight, behavior: 'smooth' })
}

async function optimizePrompt() {
  if (!input.value.trim()) return
  const res = await fetch('/api/tools/optimize_prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: input.value })
  })
  if (res.ok) {
    const data = await res.json()
    input.value = data.optimizedPrompt
  }
}

function applyPreset(key: string) {
  if (key === 'lesson-plan') {
    scenario.value = 'lesson-plan'
    input.value = `请为“二次函数图像与性质”生成一份教案，包含：
- 教学目标（知识/能力/情感）
- 教学重难点
- 教学流程（导入-新授-练习-小结-作业）
- 板书设计与时间分配
- 可能的易错点与应对`
  } else if (key === 'optimize') {
    optimizePrompt()
  }
}

async function handlePickAsset(picked: AssetView[]) {
  const asset = picked[0] ?? null
  referencedAsset.value = asset
  referencedAssetText.value = ''
  if (!asset) return

  try {
    const res = await fetch(`/api/assets/${asset.id}`, {
      headers: token.value ? { Authorization: `Bearer ${token.value}` } : undefined
    })
    if (!res.ok) return
    const detail = await res.json()
    referencedAssetText.value = (detail?.content ?? '').toString().slice(0, 4000)
    if (!referencedAssetText.value && detail?.contentUrl) {
      referencedAssetText.value = `资源链接：${detail.contentUrl}`
    }
  } catch {
    // ignore
  }
}

function clearReferencedAsset() {
  referencedAsset.value = null
  referencedAssetText.value = ''
}

async function send() {
  if ((!input.value.trim() && !referencedAsset.value) || streaming.value) return
  if (!token.value) {
    alert('请先在工作台登录后使用')
    return
  }
  ensureSession()
  const session = currentSession.value!
  const userContent = input.value.trim() || (referencedAsset.value ? `请总结并提炼要点：${referencedAsset.value.title}` : '')
  session.messages.push({ role: 'user', content: userContent })
  input.value = ''
  typingHint.value = ''
  streaming.value = true
  const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
  session.messages.push(assistantMsg)
  scrollToBottom()

  controller?.abort()
  controller = new AbortController()

  try {
    const promptParts: string[] = []
    if (referencedAsset.value) {
      promptParts.push(`【参考资料】${referencedAsset.value.title}（${referencedAsset.value.type} / ${referencedAsset.value.visibility}）`)
      if (referencedAssetText.value) promptParts.push(referencedAssetText.value)
    }
    promptParts.push(`【问题】${userContent}`)
    const prompt = promptParts.join('\n\n')

    const params = new URLSearchParams()
    params.set('prompt', prompt)
    if (scenario.value) params.set('scenario', scenario.value)

    const res = await fetch(`/api/stream/chat?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token.value}`
      },
      signal: controller.signal
    })

    const reader = res.body?.getReader()
    if (!reader) throw new Error('无法建立流式连接')
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const lines = part.split('\n')
        const dataLine = lines.find((l) => l.startsWith('data: '))
        if (!dataLine) continue
        const payload = JSON.parse(dataLine.replace('data: ', ''))
        if (payload.delta) {
          assistantMsg.content += payload.delta + '\n'
          typingHint.value = '正在生成...'
          scrollToBottom()
        }
        if (payload.status === 'done') {
          typingHint.value = ''
        }
      }
    }
  } catch (error: any) {
    assistantMsg.content += `\n[流式请求失败] ${error?.message ?? ''}`
  } finally {
    streaming.value = false
    controller = null
    scrollToBottom()
  }
}

async function saveAssistantMessage(content: string) {
  if (!token.value) {
    alert('请先登录')
    return
  }
  const title = window.prompt('保存为资源：标题', `AI 笔记 ${new Date().toLocaleString()}`)?.trim()
  if (!title) return
  const tagsInput = window.prompt('标签（逗号分隔，可选）', '') ?? ''
  const tags = tagsInput.split(/[,， ]+/).map((t) => t.trim()).filter(Boolean)

  saving.value = true
  try {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        title,
        type: 'note',
        content,
        tags,
        visibility: 'PRIVATE'
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '保存失败')
    }

    const asset = await res.json()
    await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        action: 'asset.created',
        appCode: 'chat',
        targetType: 'Asset',
        targetId: asset.id
      })
    }).catch(() => {})

    alert('已保存到资源库')
  } catch (e: any) {
    alert(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  controller?.abort()
})
</script>

<template>
  <div class="h-[calc(100vh-64px)] flex bg-gray-50">
    <!-- 左侧会话列表 -->
    <aside class="w-72 border-r bg-white flex flex-col">
      <div class="p-4 flex items-center justify-between border-b">
        <div class="flex items-center gap-2 font-bold text-slate-800">
          <Icon icon="mdi:robot" class="text-primary" />
          AI 教学助手
        </div>
        <button class="btn-icon" title="新建对话" @click="newSession">
          <Icon icon="mdi:plus" class="text-primary" />
        </button>
      </div>
      <div class="p-3 space-y-2 overflow-y-auto flex-1">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === currentSessionId }"
          @click="selectSession(session.id)"
        >
          <div class="flex items-center gap-2">
            <Icon icon="mdi:chat-outline" class="text-slate-500" />
            <span class="truncate">{{ session.title || '新对话' }}</span>
          </div>
          <p class="text-xs text-slate-400 truncate">
            {{ new Date(session.createdAt).toLocaleString() }}
          </p>
        </div>
      </div>
      <div class="p-3 border-t space-y-2">
        <p class="text-xs text-slate-500">教学场景预设</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="item in presets"
            :key="item.key"
            class="preset-btn"
            @click="applyPreset(item.key)"
          >
            <Icon :icon="item.icon" class="w-4 h-4" /> {{ item.label }}
          </button>
        </div>
      </div>
    </aside>

    <!-- 右侧聊天区 -->
    <section class="flex-1 flex flex-col">
      <div class="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold text-slate-900">课堂备课对话</h1>
          <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">SSE 模拟</span>
        </div>
        <p class="text-xs text-slate-500">{{ typingHint }}</p>
      </div>

      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-6">
        <div
          v-for="(msg, idx) in currentMessages"
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
            <div>{{ msg.content }}</div>
            <div v-if="msg.role === 'assistant'" class="mt-3 flex justify-end">
              <button
                class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60"
                :disabled="saving"
                @click="saveAssistantMessage(msg.content)"
                title="存入资源库"
              >
                <Icon icon="mdi:content-save" class="inline-block w-4 h-4 mr-1" />
                {{ saving ? '保存中...' : '存为笔记' }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="streaming" class="flex gap-4 max-w-4xl mx-auto">
          <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <Icon icon="mdi:robot" class="text-gray-600" />
          </div>
          <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm text-gray-400">
            <span class="animate-pulse">思考中...</span>
          </div>
        </div>
      </div>

      <div class="p-6 bg-white border-t">
        <div class="max-w-4xl mx-auto">
          <div class="flex gap-3 mb-2 flex-wrap">
            <button
              v-for="item in presets"
              :key="item.key"
              class="chip-btn"
              @click="applyPreset(item.key)"
            >
              <Icon :icon="item.icon" class="w-4 h-4" /> {{ item.label }}
            </button>
            <button class="chip-btn" @click="assetPickerOpen = true">
              <Icon icon="mdi:paperclip" class="w-4 h-4" /> 引用资源
            </button>
          </div>
          <div v-if="referencedAsset" class="mb-2 flex items-center gap-2">
            <span class="text-xs text-slate-500">已引用</span>
            <span class="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-2 max-w-full">
              <Icon icon="mdi:file-document-outline" class="w-4 h-4 shrink-0" />
              <span class="truncate max-w-[520px]">{{ referencedAsset.title }}</span>
              <button class="text-indigo-500 hover:text-indigo-800" title="移除" @click="clearReferencedAsset">
                <Icon icon="mdi:close-circle" class="w-4 h-4" />
              </button>
            </span>
          </div>
          <div class="relative">
            <textarea
              v-model="input"
              @keydown.enter.prevent="send"
              placeholder="输入你的问题或教学场景描述..."
              class="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-primary resize-none h-20"
            ></textarea>
            <button
              @click="send"
              class="absolute right-2 bottom-2 p-2 text-primary hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60"
              :disabled="streaming"
            >
              <Icon icon="mdi:send" class="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>

  <AssetPickerDialog
    v-model:open="assetPickerOpen"
    title="为对话选择参考资料"
    hint="选择一份资源用于提问/总结（会读取资源 content 字段；超长会截断）"
    @confirm="handlePickAsset"
  />
</template>

<style scoped>
.session-item {
  @apply p-3 rounded-xl border border-slate-100 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition;
}
.session-item.active {
  @apply border-primary/70 bg-primary/10;
}
.preset-btn {
  @apply text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-700 bg-slate-50 hover:border-primary hover:text-primary flex items-center gap-1;
}
.chip-btn {
  @apply text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-primary/10 hover:text-primary flex items-center gap-1;
}
.btn-icon {
  @apply p-2 rounded-lg hover:bg-slate-100;
}
</style>
