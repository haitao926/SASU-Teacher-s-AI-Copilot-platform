<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'

const router = useRouter()
const route = useRoute()

const menuItems = [
  {
    path: '/admin/entries',
    icon: 'mdi:view-grid',
    label: '入口管理',
    name: 'admin-entries'
  },
  {
    path: '/admin/announcements',
    icon: 'mdi:bell',
    label: '公告管理',
    name: 'admin-announcements'
  },
  {
    path: '/admin/groups',
    icon: 'mdi:folder',
    label: '分组管理',
    name: 'admin-groups'
  }
]

const pageTitle = computed(() => {
  return route.meta.title || '后台管理'
})

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar">
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Icon icon="mdi:cog" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-base font-bold text-gray-900">后台管理</h2>
            <p class="text-xs text-gray-500">IAI 平台配置</p>
          </div>
        </div>
      </div>

      <!-- 菜单 -->
      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.name === item.name }"
        >
          <Icon :icon="item.icon" class="w-5 h-5" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- 返回前台 -->
      <div class="sidebar-footer">
        <button class="back-btn" @click="goHome">
          <Icon icon="mdi:arrow-left" class="w-5 h-5" />
          <span>返回前台</span>
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="admin-main">
      <!-- 顶部栏 -->
      <header class="admin-header">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ pageTitle }}</h1>
            <p class="text-sm text-gray-500 mt-1">管理和配置系统内容</p>
          </div>
          <div class="flex items-center gap-3">
            <button class="icon-btn" title="刷新">
              <Icon icon="mdi:refresh" class="w-5 h-5" />
            </button>
            <button class="icon-btn" title="帮助">
              <Icon icon="mdi:help-circle-outline" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <!-- 内容区域 -->
      <div class="admin-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--gray-50);
}

.admin-sidebar {
  width: 260px;
  background: white;
  border-right: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
}

.sidebar-header {
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--gray-100);
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-4);
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-lg);
  color: var(--gray-700);
  transition: all var(--transition-base);
  margin-bottom: var(--spacing-2);
  font-size: 14px;
  font-weight: 500;
}

.nav-item:hover {
  background: var(--gray-100);
  color: var(--primary);
}

.nav-item.active {
  background: var(--primary);
  color: white;
}

.sidebar-footer {
  padding: var(--spacing-4);
  border-top: 1px solid var(--gray-100);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-lg);
  background: var(--gray-100);
  color: var(--gray-700);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--transition-base);
}

.back-btn:hover {
  background: var(--gray-200);
  color: var(--primary);
}

.admin-main {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
}

.admin-header {
  background: white;
  padding: var(--spacing-6) var(--spacing-8);
  border-bottom: 1px solid var(--gray-200);
  position: sticky;
  top: 0;
  z-index: 10;
}

.admin-content {
  flex: 1;
  padding: var(--spacing-8);
}

.icon-btn {
  padding: var(--spacing-2);
  border-radius: var(--radius-md);
  color: var(--gray-600);
  transition: all var(--transition-base);
}

.icon-btn:hover {
  background: var(--gray-100);
  color: var(--primary);
}
</style>
