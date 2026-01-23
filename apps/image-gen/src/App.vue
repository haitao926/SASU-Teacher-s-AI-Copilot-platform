<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'

const prompt = ref('')
const generating = ref(false)
const generatedImage = ref('')
const token = useStorage('iai-token', '')
const saving = ref(false)
const savedAssetId = ref<string | null>(null)
const saveMessage = ref('')

const API_ASSETS = '/api/assets'
const API_EVENTS = '/api/events'

function authHeaders() {
  return (token.value ? { Authorization: `Bearer ${token.value}` } : {}) as Record<string, string>
}

const generate = () => {
  if (!prompt.value) return
  generating.value = true
  savedAssetId.value = null
  saveMessage.value = ''
  setTimeout(() => {
    generatedImage.value = 'https://picsum.photos/800/600?random=' + Math.random()
    generating.value = false
  }, 2000)
}

async function saveToAssets() {
  if (!generatedImage.value) return
  if (!token.value) {
    alert('请先在工作台登录后使用')
    return
  }

  saving.value = true
  savedAssetId.value = null
  saveMessage.value = ''
  try {
    const title = `图片素材_${prompt.value.trim() || '未命名'}_${new Date().toLocaleDateString()}`
    const res = await fetch(API_ASSETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title,
        summary: `AI 图片素材（prompt: ${prompt.value.trim().slice(0, 60)}）`,
        type: 'image',
        contentUrl: generatedImage.value,
        tags: ['image', 'prompt'],
        visibility: 'PRIVATE',
        metadata: {
          prompt: prompt.value,
          sourceUrl: generatedImage.value
        }
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '保存失败')
    }
    const asset = await res.json()
    savedAssetId.value = asset.id
    saveMessage.value = '已存入资源库'

    await fetch(API_EVENTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        action: 'asset.created',
        appCode: 'image-gen',
        targetType: 'Asset',
        targetId: asset.id,
        payload: { type: 'image' }
      })
    }).catch(() => {})
  } catch (e: any) {
    saveMessage.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <Icon icon="mdi:image-edit" class="text-primary" />
      AI 图片生成与编辑
    </h1>

    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div class="flex gap-4">
        <input 
          v-model="prompt" 
          type="text" 
          placeholder="描述你想生成的教学素材，例如：一个展示光合作用的卡通图解"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          @keyup.enter="generate"
        />
        <button 
          @click="generate" 
          :disabled="!prompt || generating"
          class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          <Icon v-if="generating" icon="mdi:loading" class="animate-spin" />
          生成素材
        </button>
      </div>
    </div>

    <div v-if="generatedImage || generating" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex items-center justify-center">
      <div v-if="generating" class="text-center text-gray-500">
        <Icon icon="mdi:creation" class="w-12 h-12 mx-auto mb-2 animate-pulse text-primary" />
        <p>正在绘制中...</p>
      </div>
      <div v-else class="w-full">
        <img :src="generatedImage" class="max-w-full max-h-[600px] rounded-lg shadow-md mx-auto" alt="Generated" />
        <div class="mt-4 flex items-center justify-center gap-2">
          <button
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-60"
            :disabled="saving"
            @click="saveToAssets"
          >
            <Icon icon="mdi:content-save" />
            {{ saving ? '保存中...' : '存入资源库' }}
          </button>
          <a
            class="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-1"
            :href="generatedImage"
            target="_blank"
            rel="noreferrer"
          >
            <Icon icon="mdi:open-in-new" />
            新窗口打开
          </a>
        </div>
        <div v-if="saveMessage" class="mt-2 text-center text-sm" :class="savedAssetId ? 'text-emerald-700' : 'text-rose-700'">
          {{ saveMessage }}
        </div>
      </div>
    </div>
  </div>
</template>
