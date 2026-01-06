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
    class="app-sidebar fixed left-0 top-16 bottom-0 bg-white/50 backdrop-blur-md transition-all duration-300 z-40 flex flex-col pt-4"
    :class="collapsed ? 'w-20' : 'w-64'"
  >
    <!-- 导航列表 -->
    <nav class="flex-1 overflow-y-auto px-4 space-y-1">
      <!-- 常用应用 (原全部应用) -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative"
        :class="
          selectedGroup === null
            ? 'bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-100'
            : 'text-slate-500 hover:bg-slate-50'
        "
        @click="selectAll"
      >
        <Icon 
          :icon="selectedGroup === null ? 'mdi:star' : 'mdi:star-outline'" 
          class="w-5 h-5 flex-shrink-0 transition-colors"
          :class="selectedGroup === null ? 'text-amber-500' : 'text-slate-400 group-hover:text-amber-400'"
        />
        <span v-if="!collapsed" class="text-sm font-bold truncate">常用应用</span>
      </button>

      <!-- 分组列表 -->
      <button
        v-for="group in groups"
        :key="group.id"
        class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group"
        :class="
          selectedGroup === group.id
            ? 'bg-white text-primary shadow-md ring-1 ring-black/5'
            : 'text-slate-500 hover:bg-slate-100'
        "
        :title="collapsed ? group.name : undefined"
        @click="selectGroup(group.id)"
      >
        <Icon 
          :icon="group.icon" 
          class="w-6 h-6 flex-shrink-0 transition-colors"
          :class="selectedGroup === group.id ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'"
        />
        <span v-if="!collapsed" class="text-sm font-medium truncate">
          {{ group.name }}
        </span>
      </button>
    </nav>

    <!-- 底部折叠按钮 -->
    <div class="p-4 border-t border-slate-100/50">
      <button
        class="w-full flex items-center justify-center h-10 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
        @click="toggleCollapse"
      >
        <Icon
          :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'"
          class="w-5 h-5"
        />
      </button>
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
