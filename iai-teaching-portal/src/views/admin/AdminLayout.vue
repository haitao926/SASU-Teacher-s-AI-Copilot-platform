<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()

const { isAdmin, hasPermission } = useAuth()

const menuSections = [
  {
    key: 'content',
    label: '前台与入口',
    items: [
      {
        path: '/admin/portal',
        icon: 'mdi:monitor-dashboard',
        label: '前台配置',
        name: 'admin-portal',
        permission: 'portal.manage'
      },
      {
        path: '/admin/entries',
        icon: 'mdi:view-grid',
        label: '入口管理',
        name: 'admin-entries',
        permission: 'entries.manage'
      },
      {
        path: '/admin/announcements',
        icon: 'mdi:bell',
        label: '公告管理',
        name: 'admin-announcements',
        permission: 'announcements.manage'
      },
      {
        path: '/admin/groups',
        icon: 'mdi:folder',
        label: '分组管理',
        name: 'admin-groups',
        permission: 'entries.manage'
      }
    ]
  },
  {
    key: 'people',
    label: '人员与账号',
    items: [
      {
        path: '/admin/users',
        icon: 'mdi:account-group',
        label: '教职工账号',
        name: 'admin-users',
        permission: 'users.manage'
      },
      {
        path: '/admin/students',
        icon: 'mdi:account-multiple-plus',
        label: '学生档案',
        name: 'admin-students',
        permission: 'students.manage'
      }
    ]
  },
  {
    key: 'assets',
    label: '资源与题库',
    items: [
      {
        path: '/admin/resources',
        icon: 'mdi:folder-open',
        label: '资源库',
        name: 'admin-resources',
        permission: 'assets.manage_all'
      },
      {
        path: '/admin/questions',
        icon: 'mdi:format-list-bulleted',
        label: '题库管理',
        name: 'admin-questions',
        permission: 'questions.manage_all'
      }
    ]
  },
  {
    key: 'data',
    label: '数据与审计',
    items: [
      {
        path: '/admin/events',
        icon: 'mdi:chart-timeline-variant',
        label: '学习数据',
        name: 'admin-events',
        permission: 'events.view_all'
      },
      {
        path: '/admin/audit',
        icon: 'mdi:clipboard-check',
        label: '审计日志',
        name: 'admin-audit',
        permission: 'audit.view'
      }
    ]
  }
]

const openSections = ref<Record<string, boolean>>({
  content: true,
  people: true,
  assets: false,
  data: false
})

const sectionKeyByRouteName = new Map<string, string>([
  ['admin-portal', 'content'],
  ['admin-entries', 'content'],
  ['admin-announcements', 'content'],
  ['admin-groups', 'content'],
  ['admin-users', 'people'],
  ['admin-students', 'people'],
  ['admin-resources', 'assets'],
  ['admin-questions', 'assets'],
  ['admin-events', 'data'],
  ['admin-audit', 'data']
])

const visibleMenuSections = computed(() => {
  return menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isAdmin.value || hasPermission(item.permission))
    }))
    .filter((section) => section.items.length > 0)
})

const pageTitle = computed(() => {
  return route.meta.title || '后台管理'
})

function goHome() {
  router.push('/')
}

function isSectionOpen(key: string) {
  return openSections.value[key] !== false
}

function toggleSection(key: string) {
  openSections.value = {
    ...openSections.value,
    [key]: !isSectionOpen(key)
  }
}

watch(
  () => route.name,
  (name) => {
    if (!name) return
    const key = sectionKeyByRouteName.get(String(name))
    if (!key) return
    if (!isSectionOpen(key)) {
      openSections.value = {
        ...openSections.value,
        [key]: true
      }
    }
  },
  { immediate: true }
)
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
        <div v-for="section in visibleMenuSections" :key="section.key" class="nav-section">
          <button
            class="section-header"
            type="button"
            :aria-expanded="isSectionOpen(section.key)"
            @click="toggleSection(section.key)"
          >
            <span class="section-title">{{ section.label }}</span>
            <Icon
              :icon="isSectionOpen(section.key) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
              class="section-icon"
            />
          </button>
          <div class="section-items" v-show="isSectionOpen(section.key)">
            <RouterLink
              v-for="item in section.items"
              :key="item.path"
              :to="item.path"
              class="nav-item"
              :class="{ active: route.name === item.name }"
            >
              <Icon :icon="item.icon" class="w-5 h-5" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </div>
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

.nav-section {
  margin-bottom: var(--spacing-4);
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  color: var(--gray-500);
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  text-align: left;
}

.section-header:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.section-title {
  letter-spacing: 0.5px;
}

.section-icon {
  width: 16px;
  height: 16px;
  color: var(--gray-400);
}

.section-header:hover .section-icon {
  color: var(--gray-600);
}

.section-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-top: var(--spacing-2);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-lg);
  color: var(--gray-700);
  transition: all var(--transition-base);
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
