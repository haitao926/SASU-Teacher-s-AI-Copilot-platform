<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import EntryCard from '@/components/cards/EntryCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import CategoryIcon from '@/components/common/CategoryIcon.vue'
import { useEntries } from '@/composables/useEntries'
import { useSearch } from '@/composables/useSearch'
import type { EntryCard as EntryCardType } from '@/types'

// 使用组合式函数
const { groups, entries, loading: entriesLoading, loadConfig: loadEntriesConfig, recordClick, favoriteEntries } = useEntries()

// 搜索和过滤
const searchQuery = ref('')
const { filteredEntries: displayEntries, selectedGroup, setGroupFilter } = useSearch(entries)

// 侧边栏是否折叠
const sidebarCollapsed = ref(false)

// 加载配置
onMounted(async () => {
  await loadEntriesConfig()
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
const sidebarWidth = computed(() => sidebarCollapsed.value ? '80px' : '256px') // w-20 is 80px, w-64 is 256px

function toggleCollapse() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
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
      @toggle-collapse="toggleCollapse"
      :collapsed="sidebarCollapsed"
    />

    <!-- 主内容区 -->
    <main
      class="main-content"
      :style="{
        marginLeft: sidebarWidth
      }"
    >
      <div class="container pb-20">
        <!-- 加载状态 -->
        <LoadingSkeleton v-if="entriesLoading" :count="8" />

        <!-- 内容区 -->
        <template v-else>
          <!-- 场景 1: 正在搜索 (显示平铺网格) -->
          <div v-if="searchQuery" class="space-y-6">
            <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Icon icon="mdi:magnify" class="w-6 h-6 text-primary" />
              搜索结果
              <span class="text-sm font-normal text-gray-500 ml-2">找到 {{ displayEntries.length }} 个应用</span>
            </h2>
            
            <div v-if="displayEntries.length > 0" class="card-grid">
              <EntryCard
                v-for="entry in displayEntries"
                :key="entry.id"
                :entry="entry"
                class="stagger-item"
                @click="handleCardClick(entry)"
              />
            </div>
            <EmptyState
              v-else
              icon="mdi:magnify-close"
              title="没有找到相关应用"
              description="试试搜索其他关键词"
            />
          </div>

          <!-- 场景 2: 特定分类视图 -->
          <div v-else-if="selectedGroup" class="space-y-6">
             <div class="flex items-center gap-4 mb-8">
                <div class="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center">
                  <Icon 
                    :icon="groups.find(g => g.id === selectedGroup)?.icon || ''" 
                    class="w-8 h-8 text-primary" 
                  />
                </div>
                <div>
                  <h2 class="text-3xl font-bold text-slate-900 tracking-tight">
                    {{ groups.find(g => g.id === selectedGroup)?.name }}
                  </h2>
                  <p class="text-slate-500 mt-1">
                    {{ displayEntries.length }} 个相关应用
                  </p>
                </div>
             </div>

             <div class="card-grid">
                <EntryCard
                  v-for="entry in displayEntries"
                  :key="entry.id"
                  :entry="entry"
                  class="stagger-item"
                  @click="handleCardClick(entry)"
                />
             </div>
          </div>

          <!-- 场景 3: 默认常用应用视图 -->
          <div v-else class="space-y-6">
            <!-- 标题区域：包含标题和小技巧 -->
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-2">
               <div>
                  <h2 class="text-2xl font-bold text-slate-900 tracking-tight">常用应用</h2>
                  <p class="text-slate-500 mt-1">您收藏的教学工具，触手可及</p>
               </div>
               
               <!-- AI 小技巧卡片 (Tips) -->
               <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 max-w-lg">
                  <div class="bg-white p-1.5 rounded-lg shadow-sm text-blue-500 mt-0.5">
                    <Icon icon="mdi:lightbulb-on-outline" class="w-4 h-4" />
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-slate-800 mb-0.5">💡 AI 提问小技巧</h4>
                    <p class="text-xs text-slate-600 leading-relaxed">
                      试着给 AI 一个具体的“身份”，比如“你是一位有20年经验的中学数学老师”，它的回答会更专业哦。
                    </p>
                  </div>
               </div>
            </div>

            <!-- 有收藏时 -->
            <div v-if="favoriteEntries.length > 0" class="card-grid">
              <EntryCard
                v-for="entry in favoriteEntries"
                :key="entry.id"
                :entry="entry"
                @click="handleCardClick(entry)"
              />
            </div>

            <!-- 无收藏时 -->
            <div v-else class="py-16 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
                <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5">
                    <Icon icon="mdi:star-plus-outline" class="w-10 h-10 text-slate-400" />
                </div>
                <h3 class="text-lg font-bold text-slate-800 mb-2">暂无常用应用</h3>
                <p class="text-slate-600 max-w-sm mb-6 leading-relaxed">
                  点击左侧分类浏览应用，点击卡片右上角的<br>
                  <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm font-bold mx-1"><Icon icon="mdi:star" class="w-3.5 h-3.5" /> 星星</span> 
                  即可添加到这里。
                </p>
            </div>
          </div>

        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  /* background-color handled globally */
}

.main-content {
  padding-top: 100px; /* Header 64px + 36px space to avoid overlap */
  padding-left: 24px;
  padding-right: 24px;
  padding-bottom: 32px;
  transition: margin-left 0.3s ease;
  min-height: 100vh;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0 !important;
    padding-left: 16px;
    padding-right: 16px;
    padding-top: 80px;
  }

  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
