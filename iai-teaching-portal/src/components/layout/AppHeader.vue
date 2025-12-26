<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import GlobalSearch from '../search/GlobalSearch.vue'

const searchQuery = defineModel<string>('searchQuery', { required: true })
const router = useRouter()

function goToAdmin() {
  router.push('/admin')
}
</script>

<template>
  <header class="app-header fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
    <div class="h-16 px-6 flex items-center justify-between gap-6">
      <!-- 左侧：Logo + 标题 -->
      <div class="flex items-center gap-3 min-w-fit">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <Icon icon="mdi:school" class="w-6 h-6 text-white" />
        </div>
        <div class="hidden md:block">
          <h1 class="text-lg font-semibold text-gray-900">上科大附校</h1>
          <p class="text-xs text-gray-500">IAI 教学辅助平台</p>
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

        <!-- 后台管理 -->
        <button
          class="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
          title="后台管理"
          @click="goToAdmin"
        >
          <Icon icon="mdi:cog-outline" class="w-5 h-5 text-gray-600 group-hover:text-primary" />
        </button>

        <!-- 用户头像占位 -->
        <div
          class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all"
          title="用户中心（预留）"
        >
          <Icon icon="mdi:account" class="w-5 h-5 text-white" />
        </div>
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
