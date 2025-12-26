<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const file = ref<File | null>(null)
const result = ref('')
const loading = ref(false)

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    file.value = target.files[0]
  }
}

const processOCR = () => {
  if (!file.value) return
  loading.value = true
  setTimeout(() => {
    result.value = '识别结果示例：\n1. H₂O + CO₂ → H₂CO₃\n2. 这是一个化学方程式的识别结果。\n3. Confidence: 99%'
    loading.value = false
  }, 1500)
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <Icon icon="mdi:text-recognition" class="text-primary" />
      智能 OCR 识别 (公式/化学符号)
    </h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div class="border-2 border-dashed border-gray-300 rounded-lg h-64 flex flex-col items-center justify-center p-4 hover:border-primary transition-colors relative">
          <input type="file" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" @change="handleFileChange" accept="image/*" />
          <Icon icon="mdi:cloud-upload" class="w-12 h-12 text-gray-400 mb-2" />
          <p class="text-gray-500">点击或拖拽上传图片</p>
          <p v-if="file" class="mt-2 text-primary font-medium">{{ file.name }}</p>
        </div>
        <button 
          @click="processOCR" 
          :disabled="!file || loading"
          class="w-full mt-4 py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Icon v-if="loading" icon="mdi:loading" class="animate-spin" />
          <span>开始识别</span>
        </button>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <h3 class="font-semibold mb-2 text-gray-700">识别结果</h3>
        <textarea 
          v-model="result" 
          readonly 
          class="w-full flex-1 p-4 bg-gray-50 rounded-lg border-0 resize-none focus:ring-2 focus:ring-primary"
          placeholder="等待识别..."
        ></textarea>
      </div>
    </div>
  </div>
</template>
