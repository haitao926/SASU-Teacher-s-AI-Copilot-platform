<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const topic = ref('')
const duration = ref('45')
const grade = ref('')
const generating = ref(false)
const plan = ref('')

const generatePlan = () => {
  if (!topic.value) return
  generating.value = true
  setTimeout(() => {
    plan.value = `## ${topic.value} 教案设计

### 一、教学目标
1. 知识与技能：学生能够理解...
2. 过程与方法：通过...活动，培养...
3. 情感态度与价值观：激发学生对...的兴趣...

### 二、教学重难点
- 重点：...
- 难点：...

### 三、教学过程
1. **导入 (5分钟)**
   - 教师活动：展示...
   - 学生活动：观察...

2. **新课讲授 (20分钟)**
   - ...

3. **课堂练习 (15分钟)**
   - ...

4. **总结 (5分钟)**
   - ...`
    generating.value = false
  }, 2000)
}
</script>

<template>
  <div class="p-8 max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <Icon icon="mdi:notebook-edit" class="text-primary" />
      智能教案设计
    </h1>

    <div class="flex flex-col lg:flex-row gap-8">
      <div class="w-full lg:w-1/3 space-y-4">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">课题名称</label>
              <input v-model="topic" type="text" class="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-primary" placeholder="如：二次函数" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">年级</label>
              <select v-model="grade" class="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-primary">
                <option value="">请选择年级</option>
                <option>初一</option>
                <option>初二</option>
                <option>初三</option>
                <option>高一</option>
                <option>高二</option>
                <option>高三</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">课时时长 (分钟)</label>
              <input v-model="duration" type="number" class="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-primary" />
            </div>
            <button 
              @click="generatePlan"
              :disabled="!topic || generating"
              class="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark mt-2 flex items-center justify-center gap-2"
            >
              <Icon v-if="generating" icon="mdi:loading" class="animate-spin" />
              生成教案
            </button>
          </div>
        </div>
      </div>

      <div class="w-full lg:w-2/3">
        <div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100 min-h-[600px]">
          <div v-if="!plan && !generating" class="h-full flex flex-col items-center justify-center text-gray-400">
            <Icon icon="mdi:text-box-outline" class="w-16 h-16 mb-4 opacity-50" />
            <p>在左侧输入信息开始生成</p>
          </div>
          <div v-else-if="generating" class="space-y-4 animate-pulse">
             <div class="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
             <div class="h-4 bg-gray-200 rounded w-full"></div>
             <div class="h-4 bg-gray-200 rounded w-5/6"></div>
             <div class="h-4 bg-gray-200 rounded w-4/6"></div>
             <div class="h-32 bg-gray-200 rounded w-full mt-6"></div>
          </div>
          <div v-else class="prose max-w-none whitespace-pre-line">
            <h2 class="text-xl font-bold mb-4 text-gray-800 border-b pb-2">生成结果</h2>
            <div class="text-gray-700 leading-relaxed">{{ plan }}</div>
            <div class="mt-8 flex gap-4 border-t pt-4">
               <button class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
                 <Icon icon="mdi:content-copy" /> 复制
               </button>
               <button class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
                 <Icon icon="mdi:file-word" /> 导出 Word
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
