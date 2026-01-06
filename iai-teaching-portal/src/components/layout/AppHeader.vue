<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import GlobalSearch from '../search/GlobalSearch.vue'
import { useAuth } from '@/composables/useAuth'

const searchQuery = defineModel<string>('searchQuery', { required: true })
const router = useRouter()
const { user, isLoggedIn, logout } = useAuth()

const displayName = computed(() => user.value?.name || '未登录')
const displayRole = computed(() => user.value?.role || '访客')

function handleAuthClick() {
  if (isLoggedIn.value) {
    logout()
  } else {
    router.push('/login')
  }
}
</script>

<template>
  <header class="app-header fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50">
    <div class="h-16 px-6 flex items-center justify-between gap-6">
      <!-- 左侧：Logo + 标题 -->
      <div class="flex items-center gap-3 min-w-fit">
        <img src="/logo.png" alt="Logo" class="h-9 w-auto object-contain invert" />
        <div class="hidden md:flex flex-col justify-center select-none">
          <div class="flex items-center gap-2 leading-none">
            <span class="text-base font-bold text-slate-600 tracking-tight" style="font-family: 'Outfit', sans-serif;">ReOpenInnoLab</span>
            <span class="h-3 w-[1px] bg-slate-300"></span>
            <span class="text-base font-bold text-slate-800 tracking-wide">智教空间</span>
          </div>
          <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-1 font-sans">AI Teaching Assistant</span>
        </div>
      </div>

      <!-- 中间：全局搜索 -->
      <div class="flex-1 max-w-2xl">
        <GlobalSearch v-model="searchQuery" />
      </div>

      <!-- 右侧：操作按钮 -->
      <div class="flex items-center gap-3">
        <!-- 帮助文档 -->
        <button
          class="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
          title="帮助文档"
        >
          <Icon icon="mdi:help-circle-outline" class="w-5 h-5 text-gray-600 group-hover:text-primary" />
        </button>

        <!-- 反馈入口 -->
        <button
          class="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
          title="意见反馈"
        >
          <Icon icon="mdi:message-outline" class="w-5 h-5 text-gray-600 group-hover:text-primary" />
        </button>

        <!-- 用户信息 -->
        <div class="hidden md:flex flex-col text-right leading-tight">
          <span class="text-sm font-semibold text-slate-800">{{ displayName }}</span>
          <span class="text-xs text-slate-500">{{ displayRole }}</span>
        </div>
        <button
          class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all"
          title="用户中心 / 登录"
          @click="handleAuthClick"
        >
          <Icon icon="mdi:account" class="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  backdrop-filter: blur(8px);
  background-color: rgba(255, 255, 255, 0.95);
}
</style>
