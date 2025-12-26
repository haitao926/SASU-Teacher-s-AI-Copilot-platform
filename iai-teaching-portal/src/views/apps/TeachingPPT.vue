<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const templates = [
  { id: 1, name: '学术简约', color: 'bg-blue-100' },
  { id: 2, name: '生动活泼', color: 'bg-yellow-100' },
  { id: 3, name: '科技未来', color: 'bg-indigo-900 text-white' },
]

const selectedTemplate = ref(templates[0])
const topic = ref('')
const generating = ref(false)
const outline = ref<string[]>([])

const generateOutline = () => {
  if (!topic.value) return
  generating.value = true
  outline.value = []
  setTimeout(() => {
    outline.value = [
      '1. 课程引入：什么是' + topic.value,
      '2. 核心概念解析',
      '3. 案例分析与讨论',
      '4. 课堂练习',
      '5. 总结与作业'
    ]
    generating.value = false
  }, 1500)
}
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <Icon icon="mdi:presentation-play" class="text-primary" />
      教学 PPT 智能设计
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Sidebar Controls -->
      <div class="space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <label class="block text-sm font-medium text-gray-700 mb-2">课程主题</label>
          <input 
            v-model="topic"
            type="text" 
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary mb-4"
            placeholder="例如：牛顿第一定律"
          />
          
          <label class="block text-sm font-medium text-gray-700 mb-2">选择风格</label>
          <div class="grid grid-cols-3 gap-2 mb-6">
            <div 
              v-for="t in templates" 
              :key="t.id"
              @click="selectedTemplate = t"
              class="h-12 rounded cursor-pointer border-2 transition-all flex items-center justify-center text-xs"
              :class="[t.color, selectedTemplate?.id === t.id ? 'border-primary ring-2 ring-primary ring-opacity-50' : 'border-transparent']"
            >
              {{ t.name }}
            </div>
          </div>

          <button 
            @click="generateOutline"
            :disabled="!topic || generating"
            class="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Icon v-if="generating" icon="mdi:loading" class="animate-spin" />
            生成大纲
          </button>
        </div>
      </div>

      <!-- Preview Area -->
      <div class="lg:col-span-2 bg-gray-100 rounded-xl p-8 min-h-[500px] flex items-center justify-center overflow-hidden relative">
        <div class="aspect-video w-full bg-white shadow-2xl rounded-lg overflow-hidden flex flex-col transition-all duration-500 transform hover:scale-[1.02]">
          <!-- PPT Content Simulation -->
          <div class="flex-1 p-12 flex flex-col justify-center items-center text-center" :class="selectedTemplate?.color">
            <h1 class="text-4xl font-bold mb-4">{{ topic || '课程标题' }}</h1>
            <p class="text-xl opacity-80">副标题 / 讲师姓名</p>
          </div>
        </div>

        <!-- Outline Overlay -->
        <div v-if="outline.length" class="absolute bottom-8 right-8 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg max-w-sm w-full animate-slide-up">
          <h3 class="font-bold mb-2 flex items-center gap-2 text-primary">
            <Icon icon="mdi:format-list-bulleted" /> 
            生成大纲
          </h3>
          <ul class="space-y-1 text-sm text-gray-700">
            <li v-for="item in outline" :key="item">{{ item }}</li>
          </ul>
           <button class="w-full mt-4 py-1.5 text-sm border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors">
            下载 PPTX
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
