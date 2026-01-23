import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import type { EntryCard, Group, SortOption } from '@/types'
import { loadEntriesConfig } from '@/utils/config'

const groups = ref<Group[]>([])
const entries = ref<EntryCard[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// 持久化存储收藏的应用 ID
const favoriteIds = useStorage<string[]>('iai-favorites', [])

export function useEntries() {
  // 加载配置
  async function loadConfig() {
    loading.value = true
    error.value = null
    try {
      const config = await loadEntriesConfig()
      groups.value = config.groups.sort((a, b) => a.order - b.order)
      entries.value = config.entries.sort((a, b) => a.order - b.order)
    } catch (err) {
      error.value = '加载配置失败，请刷新重试'
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  // 收藏相关逻辑
  function toggleFavorite(id: string) {
    const index = favoriteIds.value.indexOf(id)
    if (index === -1) {
      favoriteIds.value.push(id)
    } else {
      favoriteIds.value.splice(index, 1)
    }
  }

  function isFavorite(id: string): boolean {
    return favoriteIds.value.includes(id)
  }

  // 获取已收藏的应用列表
  const favoriteEntries = computed(() => {
    return entries.value.filter(entry => favoriteIds.value.includes(entry.id))
  })

  // 根据分组获取入口
  function getEntriesByGroup(groupId: string): EntryCard[] {
    return entries.value.filter(entry => entry.group === groupId)
  }

  // 根据状态过滤
  function getEntriesByStatus(status: EntryCard['status']): EntryCard[] {
    return entries.value.filter(entry => entry.status === status)
  }

  // 获取推荐入口
  // 根据使用量排序
  function sortByUsage(descending = true): EntryCard[] {
    return [...entries.value].sort((a, b) =>
      descending ? b.usage - a.usage : a.usage - b.usage
    )
  }

  // 根据排序选项获取入口
  function getSortedEntries(sortBy: SortOption): EntryCard[] {
    switch (sortBy) {
      case 'usage':
        return sortByUsage()
      case 'newest':
        return getEntriesByStatus('new')
      case 'all':
      default:
        return entries.value
    }
  }

  // 记录点击（增加使用次数）
  function recordClick(entryId: string) {
    const entry = entries.value.find(e => e.id === entryId)
    if (entry) {
      entry.usage++
      fetch(`/api/entries/${entryId}/click`, { method: 'POST' }).catch(() => {
        // 忽略埋点失败，保持前端体验
      })
    }
  }

  return {
    groups,
    entries,
    loading,
    error,
    favoriteEntries, // 导出
    isFavorite,      // 导出
    toggleFavorite,  // 导出
    loadConfig,
    getEntriesByGroup,
    getEntriesByStatus,
    sortByUsage,
    getSortedEntries,
    recordClick,
  }
}
