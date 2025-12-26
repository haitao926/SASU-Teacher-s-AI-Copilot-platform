<script setup lang="ts">
import type { EntryCard } from '@/types'

defineProps<{
  status: EntryCard['status']
}>()

const statusConfig = {
  available: {
    text: '可用',
    class: 'bg-green-100 text-green-700 border-green-200',
  },
  maintenance: {
    text: '维护中',
    class: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  new: {
    text: '新功能',
    class: 'bg-blue-100 text-blue-700 border-blue-200',
  },
}
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border transition-colors"
    :class="statusConfig[status].class"
  >
    {{ statusConfig[status].text }}
  </span>
</template>
