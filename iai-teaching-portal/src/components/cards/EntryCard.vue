<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import type { EntryCard } from '@/types'
import { useEntries } from '@/composables/useEntries'
import { useAuth } from '@/composables/useAuth'

defineProps<{
  entry: EntryCard
}>()

const emit = defineEmits<{
  click: [entry: EntryCard]
}>()

const router = useRouter()
const { isFavorite, toggleFavorite } = useEntries()
const { token } = useAuth()

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
    // 外部链接/子应用跳转：追加 Token 实现免登
    try {
      const urlObj = new URL(entry.url)
      // 只有当我们有 token 时才追加，且仅针对 localhost 或信任的域名 (这里简化为都追加)
      if (token.value) {
        urlObj.searchParams.append('auth_token', token.value)
      }
      window.open(urlObj.toString(), '_blank', 'noopener,noreferrer')
    } catch (e) {
      window.open(entry.url, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>

<template>
  <div
    class="entry-card group relative bg-white rounded-3xl p-6 cursor-pointer transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1"
    @click="handleClick(entry)"
  >
    <!-- 右上角操作区 -->
    <div class="absolute top-4 right-4 z-20 flex items-center gap-2">
       <!-- 状态点 -->
       <span v-if="entry.status !== 'available'" 
        class="w-2.5 h-2.5 rounded-full"
        :class="{
          'bg-blue-500': entry.status === 'new',
          'bg-orange-500': entry.status === 'maintenance'
        }"
        :title="entry.status === 'new' ? '新功能' : '维护中'"
      ></span>

      <!-- 收藏按钮 -->
      <button 
        class="p-1.5 rounded-full hover:bg-gray-50 transition-all duration-200"
        :class="isFavorite(entry.id) ? 'text-amber-400 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'"
        @click.stop="toggleFavorite(entry.id)"
        title="收藏到常用"
      >
        <Icon :icon="isFavorite(entry.id) ? 'mdi:star' : 'mdi:star-outline'" class="w-6 h-6" />
      </button>
    </div>

    <!-- 顶部：图标 -->
    <div class="mb-5">
      <!-- 1. 图片 Logo 模式 (URL) -->
      <div 
        v-if="entry.icon && (entry.icon.includes('/') || entry.icon.includes('http'))" 
        class="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-50 transition-transform duration-300 group-hover:scale-110 border border-gray-100/50"
      >
        <img :src="entry.icon" :alt="entry.name" class="w-8 h-8 object-contain" />
      </div>

      <!-- 2. MDI 图标模式 (有 iconName) -->
      <div
        v-else-if="entry.iconName"
        class="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-sm transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br"
        :class="gradientMap[entry.icon || ''] || 'from-slate-700 to-slate-900'"
      >
        <Icon :icon="entry.iconName" class="icon-svg" />
      </div>

      <!-- 3. 旧版兼容模式 -->
      <div
        v-else
        class="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-sm transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br"
        :class="gradientMap[entry.icon || ''] || 'from-slate-700 to-slate-900'"
      >
        <Icon icon="mdi:application" class="icon-svg" />
      </div>
    </div>

    <!-- 内容区 -->
    <div>
      <h3 class="text-[17px] font-bold text-slate-900 mb-2 tracking-tight group-hover:text-primary transition-colors">
        {{ entry.name }}
      </h3>
      <p class="text-[13px] text-slate-500 leading-relaxed mb-4 h-10 line-clamp-2">
        {{ entry.description }}
      </p>
    </div>

    <!-- 底部：极简标签 -->
    <div class="flex items-center gap-2 pt-2 border-t border-gray-50 mt-2">
      <span 
        v-for="tag in entry.tags.slice(0, 2)" 
        :key="tag"
        class="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md"
      >
        #{{ tag }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.entry-card {
  position: relative;
}
/* 强制 SVG 居中且尺寸正确 */
:deep(.icon-svg) {
  display: block !important;
  margin: auto !important;
  width: 28px !important; /* 稍微缩小一点，留出 buffer */
  height: 28px !important;
}
</style>
