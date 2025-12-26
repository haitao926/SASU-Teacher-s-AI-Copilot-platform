<script setup lang="ts">
defineProps<{
  count?: number
}>()
</script>

<template>
  <div class="loading-skeleton grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    <div
      v-for="i in (count || 8)"
      :key="i"
      class="skeleton-card bg-white rounded-lg p-6 border border-gray-200 animate-pulse"
    >
      <!-- 状态徽标骨架 -->
      <div class="h-5 w-16 bg-gray-200 rounded mb-4" />

      <!-- 图标骨架 -->
      <div class="w-16 h-16 bg-gray-200 rounded-xl mb-4" />

      <!-- 标题骨架 -->
      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2" />

      <!-- 描述骨架 -->
      <div class="space-y-2 mb-4">
        <div class="h-4 bg-gray-200 rounded w-full" />
        <div class="h-4 bg-gray-200 rounded w-2/3" />
      </div>

      <!-- 标签骨架 -->
      <div class="flex gap-2">
        <div class="h-6 w-16 bg-gray-200 rounded-md" />
        <div class="h-6 w-20 bg-gray-200 rounded-md" />
        <div class="h-6 w-14 bg-gray-200 rounded-md" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
