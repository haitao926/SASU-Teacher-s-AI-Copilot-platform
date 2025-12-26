<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { Announcement } from '@/types'

defineProps<{
  announcements: Announcement[]
  collapsed: boolean
  unreadCount: number
}>()

const emit = defineEmits<{
  'toggle-collapse': []
  'mark-as-read': [id: string]
}>()

const tagTypeMap = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-orange-100 text-orange-700',
  info: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
}
</script>

<template>
  <aside
    class="announcement-panel fixed right-0 top-16 bottom-0 bg-white border-l border-gray-200 transition-all duration-300 z-40"
    :class="collapsed ? 'w-12' : 'w-80'"
  >
    <div class="h-full flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between h-12 px-4 border-b border-gray-100">
        <div v-if="!collapsed" class="flex items-center gap-2">
          <Icon icon="mdi:bell" class="w-5 h-5 text-primary" />
          <span class="text-sm font-semibold text-gray-900">公告通知</span>
          <span
            v-if="unreadCount > 0"
            class="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-medium"
          >
            {{ unreadCount }}
          </span>
        </div>
        <button
          class="p-1 hover:bg-gray-100 rounded transition-colors"
          @click="$emit('toggle-collapse')"
        >
          <Icon
            :icon="collapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'"
            class="w-5 h-5 text-gray-600"
          />
        </button>
      </div>

      <!-- 公告列表 -->
      <div v-if="!collapsed" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div
          v-for="announcement in announcements"
          :key="announcement.id"
          class="announcement-item p-3 rounded-lg border border-gray-200 hover:border-primary/50 transition-all cursor-pointer"
          :class="{ 'bg-blue-50/30': !announcement.read }"
          @click="$emit('mark-as-read', announcement.id)"
        >
          <!-- 标题行 -->
          <div class="flex items-start justify-between gap-2 mb-2">
            <h4 class="text-sm font-medium text-gray-900 flex-1">
              {{ announcement.title }}
              <Icon
                v-if="announcement.pinned"
                icon="mdi:pin"
                class="inline-block w-3 h-3 ml-1 text-red-500"
              />
            </h4>
            <div
              v-if="!announcement.read"
              class="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0"
            />
          </div>

          <!-- 内容 -->
          <p class="text-xs text-gray-600 mb-2 line-clamp-2">
            {{ announcement.content }}
          </p>

          <!-- 底部信息 -->
          <div class="flex items-center justify-between">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              :class="tagTypeMap[announcement.tagType]"
            >
              {{ announcement.tag }}
            </span>
            <span class="text-xs text-gray-400">
              {{ announcement.time }}
            </span>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="announcements.length === 0"
          class="flex flex-col items-center justify-center py-12 text-gray-400"
        >
          <Icon icon="mdi:bell-off-outline" class="w-12 h-12 mb-2" />
          <p class="text-sm">暂无公告</p>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.announcement-panel {
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.04);
}

/* 自定义滚动条 */
.announcement-panel::-webkit-scrollbar {
  width: 4px;
}
</style>
