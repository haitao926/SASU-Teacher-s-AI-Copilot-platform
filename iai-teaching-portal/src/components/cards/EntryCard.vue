<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import StatusBadge from './StatusBadge.vue'
import type { EntryCard } from '@/types'

defineProps<{
  entry: EntryCard
}>()

const emit = defineEmits<{
  click: [entry: EntryCard]
}>()

const router = useRouter()

// 渐变背景映射
const gradientMap: Record<string, string> = {
  'gradient-purple': 'from-purple-400 to-purple-600',
  'gradient-blue': 'from-blue-400 to-blue-600',
  'gradient-green': 'from-green-400 to-green-600',
  'gradient-orange': 'from-orange-400 to-orange-600',
  'gradient-red': 'from-red-400 to-red-600',
  'gradient-teal': 'from-teal-400 to-teal-600',
  'gradient-pink': 'from-pink-400 to-pink-600',
  'gradient-indigo': 'from-indigo-400 to-indigo-600',
}

function handleClick(entry: EntryCard) {
  emit('click', entry)
  if (entry.url.startsWith('/')) {
    router.push(entry.url)
  } else {
    window.open(entry.url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div
    class="entry-card bg-white rounded-lg p-6 cursor-pointer transition-all duration-300 border border-gray-200 hover:border-primary hover:shadow-lg hover:-translate-y-1 animate-slide-up group"
    @click="handleClick(entry)"
  >
    <!-- 状态徽标 -->
    <div class="flex justify-between items-start mb-4">
      <StatusBadge :status="entry.status" />
      <div
        v-if="entry.usage"
        class="text-xs text-gray-400 flex items-center gap-1"
      >
        <Icon icon="mdi:fire" class="w-3 h-3" />
        {{ entry.usage }}
      </div>
    </div>

    <!-- 图标 -->
    <div
      class="w-16 h-16 rounded-xl bg-gradient-to-br mb-4 flex items-center justify-center text-white shadow-md"
      :class="gradientMap[entry.icon] || 'from-gray-400 to-gray-600'"
    >
      <Icon icon="mdi:application" class="w-8 h-8" />
    </div>

    <!-- 标题和描述 -->
    <h3 class="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
      {{ entry.name }}
    </h3>
    <p class="text-sm text-gray-600 mb-4 line-clamp-2">
      {{ entry.description }}
    </p>

    <!-- 标签 -->
    <div class="flex flex-wrap gap-2">
      <span
        v-for="tag in entry.tags"
        :key="tag"
        class="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
      >
        {{ tag }}
      </span>
    </div>

    <!-- 悬停时显示的"立即使用"按钮 -->
    <div class="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        class="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
      >
        <span>立即使用</span>
        <Icon icon="mdi:arrow-right" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.entry-card {
  position: relative;
}
</style>
