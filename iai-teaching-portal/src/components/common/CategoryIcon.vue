<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  size?: string | number
  active?: boolean
}>()

const iconSize = computed(() => props.size || 20)

// 颜色映射：根据激活状态改变
// active: 主色调线条 + 浅色填充
// inactive: 灰色线条 + 极淡灰色填充
const strokeColor = computed(() => props.active ? '#3B82F6' : '#64748B')
const fillColor = computed(() => props.active ? '#DBEAFE' : '#F1F5F9')

</script>

<template>
  <svg
    :width="iconSize"
    :height="iconSize"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="transition-colors duration-300"
  >
    <!-- 全部/Dashboard: 四个圆润方块，代表聚合 -->
    <g v-if="name === 'dashboard' || name === 'all'">
      <rect x="4" y="4" width="7" height="7" rx="2" :stroke="strokeColor" stroke-width="2" :fill="fillColor" />
      <rect x="13" y="4" width="7" height="7" rx="2" :stroke="strokeColor" stroke-width="2" :fill="fillColor" />
      <rect x="4" y="13" width="7" height="7" rx="2" :stroke="strokeColor" stroke-width="2" :fill="fillColor" />
      <rect x="13" y="13" width="7" height="7" rx="2" :stroke="strokeColor" stroke-width="2" :fill="fillColor" />
    </g>

    <!-- 教学流程: 书本与光芒，代表知识传递 -->
    <g v-else-if="name === 'teaching'">
      <path d="M4 19.5C4 18.8 4 6 4 6C4 4.89543 4.89543 4 6 4H19C20.1046 4 21 4.89543 21 6V18.5C21 19.6046 20.1046 20.5 19 20.5H6C4.89543 20.5 4 19.6046 4 18.5Z" :stroke="strokeColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M4 8L21 8" :stroke="strokeColor" stroke-width="2" stroke-opacity="0.5" />
      <path d="M9 14H16" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" />
      <path d="M9 10H14" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" :fill="fillColor"/>
    </g>

    <!-- 课堂工具: 魔术棒/工具箱，代表效率 -->
    <g v-else-if="name === 'tools'">
      <path d="M14.5 9.5L19.5 4.5" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" />
      <path d="M9.5 14.5C6.5 17.5 4 19.5 4 19.5C4 19.5 6 17 9 14L16.5 6.5C17.3284 5.67157 18.6716 5.67157 19.5 6.5C20.3284 7.32843 20.3284 8.67157 19.5 9.5L12 17L9.5 14.5Z" :fill="fillColor" :stroke="strokeColor" stroke-width="2" stroke-linejoin="round" />
      <circle cx="10" cy="10" r="1" :fill="strokeColor" fill-opacity="0.5" />
    </g>

    <!-- 备课/资源: 文件夹与层叠，代表积累 -->
    <g v-else-if="name === 'resources'">
      <path d="M5 8V18C5 19.1046 5.89543 20 7 20H19" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.5" />
      <rect x="5" y="4" width="14" height="12" rx="2" :fill="fillColor" :stroke="strokeColor" stroke-width="2" />
      <path d="M9 4V2H15V4" :stroke="strokeColor" stroke-width="2" />
    </g>

    <!-- 测评/批改: 勾选与清单，代表反馈 -->
    <g v-else-if="name === 'assessment'">
      <path d="M9 11L11 13L15 9" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="12" cy="12" r="9" :fill="fillColor" :stroke="strokeColor" stroke-width="2" />
    </g>

    <!-- 数据分析: 柱状图，代表洞察 -->
    <g v-else-if="name === 'analysis'">
      <path d="M18 20V10" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12 20V4" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :fill="fillColor"/>
      <path d="M6 20V14" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M4 20H20" :stroke="strokeColor" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- 通知/沟通: 气泡，代表交流 -->
    <g v-else-if="name === 'communication'">
      <path d="M20.6491 16.8906C21.4939 15.4851 22 13.8123 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C13.2536 22 14.4534 21.7852 15.5683 21.3897L21 22L20.6491 16.8906Z" :fill="fillColor" :stroke="strokeColor" stroke-width="2" stroke-linejoin="round"/>
    </g>
    
    <!-- 默认/其他 -->
    <g v-else>
      <circle cx="12" cy="12" r="8" :stroke="strokeColor" stroke-width="2" :fill="fillColor"/>
    </g>
  </svg>
</template>