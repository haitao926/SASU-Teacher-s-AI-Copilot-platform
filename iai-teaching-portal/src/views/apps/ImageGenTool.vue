<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const prompt = ref('')
const generating = ref(false)
const generatedImage = ref('')

const generate = () => {
  if (!prompt.value) return
  generating.value = true
  setTimeout(() => {
    generatedImage.value = 'https://picsum.photos/800/600?random=' + Math.random()
    generating.value = false
  }, 2000)
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
      <img v-else :src="generatedImage" class="max-w-full max-h-[600px] rounded-lg shadow-md" alt="Generated" />
    </div>
  </div>
</template>
