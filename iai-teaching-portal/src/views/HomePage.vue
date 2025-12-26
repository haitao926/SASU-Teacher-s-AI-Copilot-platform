<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AnnouncementPanel from '@/components/announcement/AnnouncementPanel.vue'
import EntryCard from '@/components/cards/EntryCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useEntries } from '@/composables/useEntries'
import { useSearch } from '@/composables/useSearch'
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { EntryCard as EntryCardType } from '@/types'

// 使用组合式函数
const { groups, entries, loading: entriesLoading, loadConfig: loadEntriesConfig, recordClick } = useEntries()
const { announcements, unreadCount, collapsed: announcementCollapsed, loadConfig: loadAnnouncementsConfig, markAsRead, toggleCollapse } = useAnnouncements()

// 搜索和过滤
const searchQuery = ref('')
const { filteredEntries: displayEntries, hasResults, selectedGroup, setGroupFilter } = useSearch(entries)

// 侧边栏是否折叠
const sidebarCollapsed = ref(false)

// 加载配置
onMounted(async () => {
  await Promise.all([
    loadEntriesConfig(),
    loadAnnouncementsConfig()
  ])
})

// 处理卡片点击
function handleCardClick(entry: EntryCardType) {
  recordClick(entry.id)
}

// 处理分组选择
function handleGroupSelect(groupId: string | null) {
  setGroupFilter(groupId)
}

// 计算侧边栏宽度
const sidebarWidth = computed(() => sidebarCollapsed.value ? '64px' : '240px')
const announcementWidth = computed(() => announcementCollapsed.value ? '48px' : '320px')
</script>

<template>
  <div class="app">
    <!-- 顶部导航 -->
    <AppHeader v-model:search-query="searchQuery" />

    <!-- 侧边导航 -->
    <AppSidebar
      :groups="groups"
      :selected-group="selectedGroup"
      @select-group="handleGroupSelect"
    />

    <!-- 主内容区 -->
    <main
      class="main-content"
      :style="{
        marginLeft: sidebarWidth,
        marginRight: announcementWidth,
      }"
    >
      <div class="container">
        <!-- 加载状态 -->
        <LoadingSkeleton v-if="entriesLoading" :count="8" />

        <!-- 内容区 -->
        <template v-else>
          <!-- 卡片网格 -->
          <div v-if="hasResults" class="card-grid">
            <EntryCard
              v-for="entry in displayEntries"
              :key="entry.id"
              :entry="entry"
              class="stagger-item"
              @click="handleCardClick(entry)"
            />
          </div>

          <!-- 空状态 -->
          <EmptyState
            v-else
            icon="mdi:magnify-close"
            title="没有找到相关应用"
            description="试试搜索其他关键词，或选择不同的分类查看更多应用"
          />
        </template>
      </div>
    </main>

    <!-- 公告面板 -->
    <AnnouncementPanel
      :announcements="announcements"
      :collapsed="announcementCollapsed"
      :unread-count="unreadCount"
      @toggle-collapse="toggleCollapse"
      @mark-as-read="markAsRead"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background-color: var(--gray-50);
}

.main-content {
  margin-top: 64px; /* Header height */
  padding: var(--spacing-8) var(--spacing-6);
  transition: margin-left 0.3s ease, margin-right 0.3s ease;
  min-height: calc(100vh - 64px);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-6);
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    margin-right: 0;
    padding: var(--spacing-4);
  }

  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
