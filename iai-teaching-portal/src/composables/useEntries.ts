import { ref, computed } from 'vue'
import type { EntryCard, Group, SortOption } from '@/types'
import { loadEntriesConfig } from '@/utils/config'

const groups = ref<Group[]>([])
const entries = ref<EntryCard[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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

  // 根据分组获取入口
  function getEntriesByGroup(groupId: string): EntryCard[] {
    return entries.value.filter(entry => entry.group === groupId)
  }

  // 根据状态过滤
  function getEntriesByStatus(status: EntryCard['status']): EntryCard[] {
    return entries.value.filter(entry => entry.status === status)
  }

  // 获取推荐入口
  const featuredEntries = computed(() => {
    return entries.value.filter(entry => entry.featured)
  })

  // 根据使用量排序
  function sortByUsage(descending = true): EntryCard[] {
    return [...entries.value].sort((a, b) =>
      descending ? b.usage - a.usage : a.usage - b.usage
    )
  }

  // 根据排序选项获取入口
  function getSortedEntries(sortBy: SortOption): EntryCard[] {
    switch (sortBy) {
      case 'featured':
        return featuredEntries.value
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
      // 可以在这里添加埋点统计逻辑
      console.log(`Entry clicked: ${entry.name}, usage: ${entry.usage}`)
    }
  }

  return {
    groups,
    entries,
    loading,
    error,
    featuredEntries,
    loadConfig,
    getEntriesByGroup,
    getEntriesByStatus,
    sortByUsage,
    getSortedEntries,
    recordClick,
  }
}
