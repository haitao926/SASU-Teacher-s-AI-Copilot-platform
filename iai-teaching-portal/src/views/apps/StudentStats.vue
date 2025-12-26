<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const stats = ref([
  { label: '平均分', value: '85.4', trend: '+2.1', positive: true },
  { label: '作业提交率', value: '98%', trend: '-0.5%', positive: false },
  { label: '优秀率', value: '32%', trend: '+5%', positive: true },
  { label: '待批改', value: '12', trend: '', positive: true, alert: true },
])

const students = ref([
  { id: 1, name: '张三', score: 92, status: '已提交', time: '10:00' },
  { id: 2, name: '李四', score: 88, status: '已提交', time: '10:05' },
  { id: 3, name: '王五', score: 76, status: '已提交', time: '10:12' },
  { id: 4, name: '赵六', score: -1, status: '未提交', time: '-' },
  { id: 5, name: '钱七', score: 95, status: '已提交', time: '09:55' },
])
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <Icon icon="mdi:chart-box" class="text-primary" />
      学生情况与成绩统计
    </h1>

    <!-- Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div v-for="stat in stats" :key="stat.label" class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <span class="text-gray-500 text-sm mb-2">{{ stat.label }}</span>
        <div class="flex items-end justify-between">
          <span class="text-3xl font-bold text-gray-800" :class="stat.alert ? 'text-orange-500' : ''">{{ stat.value }}</span>
          <span v-if="stat.trend" class="text-xs font-medium px-2 py-1 rounded-full flex items-center" :class="stat.positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
            <Icon :icon="stat.positive ? 'mdi:arrow-up' : 'mdi:arrow-down'" class="w-3 h-3 mr-1" />
            {{ stat.trend }}
          </span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Chart Area (Placeholder) -->
      <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        <h3 class="font-bold text-gray-700 mb-4">成绩分布趋势</h3>
        <div class="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
           <div class="text-center text-gray-400">
             <Icon icon="mdi:chart-bar" class="w-16 h-16 mx-auto mb-2 opacity-50" />
             <p>图表区域 (ECharts/Chart.js)</p>
           </div>
        </div>
      </div>

      <!-- Student List -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 class="font-bold text-gray-700 mb-4 flex justify-between items-center">
          <span>最近作业提交</span>
          <button class="text-xs text-primary hover:underline">查看全部</button>
        </h3>
        <div class="space-y-3">
          <div v-for="student in students" :key="student.id" class="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                {{ student.name[0] }}
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ student.name }}</p>
                <p class="text-xs text-gray-500">{{ student.time }}</p>
              </div>
            </div>
            <div class="text-right">
              <span 
                v-if="student.status === '已提交'" 
                class="block font-bold"
                :class="student.score >= 90 ? 'text-green-600' : (student.score >= 60 ? 'text-blue-600' : 'text-orange-600')"
              >
                {{ student.score }}分
              </span>
              <span v-else class="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">未提交</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
