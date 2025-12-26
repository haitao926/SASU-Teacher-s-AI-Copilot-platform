<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { Group } from '@/types'

defineProps<{
  groups: Group[]
  selectedGroup: string | null
}>()

const emit = defineEmits<{
  'select-group': [groupId: string | null]
}>()

const collapsed = ref(false)

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

function selectGroup(groupId: string) {
  emit('select-group', groupId)
}

function selectAll() {
  emit('select-group', null)
}
</script>

<template>
  <aside
    class="app-sidebar fixed left-0 top-16 bottom-0 bg-white border-r border-gray-200 transition-all duration-300 z-40"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <div class="h-full flex flex-col">
      <!-- 折叠按钮 -->
      <button
        class="flex items-center justify-center h-12 border-b border-gray-100 hover:bg-gray-50 transition-colors"
        @click="toggleCollapse"
      >
        <Icon
          :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'"
          class="w-5 h-5 text-gray-600"
        />
      </button>

      <!-- 导航列表 -->
      <nav class="flex-1 overflow-y-auto p-2">
        <!-- 全部分类 -->
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 group"
          :class="
            selectedGroup === null
              ? 'bg-primary text-white'
              : 'hover:bg-gray-100 text-gray-700'
          "
          @click="selectAll"
        >
          <Icon icon="mdi:view-grid" class="w-5 h-5 flex-shrink-0" />
          <span v-if="!collapsed" class="text-sm font-medium truncate">全部应用</span>
        </button>

        <!-- 分组列表 -->
        <button
          v-for="group in groups"
          :key="group.id"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 group"
          :class="
            selectedGroup === group.id
              ? 'bg-primary text-white'
              : 'hover:bg-gray-100 text-gray-700'
          "
          :title="collapsed ? group.name : undefined"
          @click="selectGroup(group.id)"
        >
          <Icon :icon="group.icon" class="w-5 h-5 flex-shrink-0" />
          <span v-if="!collapsed" class="text-sm font-medium truncate">
            {{ group.name }}
          </span>
        </button>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
}

/* 自定义滚动条 */
.app-sidebar nav::-webkit-scrollbar {
  width: 4px;
}

.app-sidebar nav::-webkit-scrollbar-track {
  background: transparent;
}

.app-sidebar nav::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 2px;
}

.app-sidebar nav::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}
</style>
