<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  icon?: string
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state flex flex-col items-center justify-center py-16 px-4">
    <Icon
      :icon="icon || 'mdi:inbox-outline'"
      class="w-20 h-20 text-gray-300 mb-4"
    />
    <h3 class="text-lg font-medium text-gray-900 mb-2">
      {{ title || '暂无内容' }}
    </h3>
    <p class="text-sm text-gray-500 text-center max-w-md">
      {{ description || '没有找到相关内容，试试其他搜索词或查看其他分类' }}
    </p>
  </div>
</template>
