import { ref, computed, type Ref } from 'vue'
import type { EntryCard, SortOption } from '@/types'

export function useSearch(entries: Ref<EntryCard[]>) {
  const searchQuery = ref('')
  const selectedGroup = ref<string | null>(null)
  const sortBy = ref<SortOption>('all')

  // 搜索过滤
  const filteredEntries = computed(() => {
    let result = [...entries.value]

    // 按搜索关键词过滤
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase().trim()
      result = result.filter(entry => {
        return (
          entry.name.toLowerCase().includes(query) ||
          entry.description.toLowerCase().includes(query) ||
          entry.tags.some(tag => tag.toLowerCase().includes(query))
        )
      })
    }

    // 按分组过滤
    if (selectedGroup.value) {
      result = result.filter(entry => entry.group === selectedGroup.value)
    }

    // 排序
    switch (sortBy.value) {
      case 'featured':
        result = result.filter(entry => entry.featured)
        break
      case 'usage':
        result.sort((a, b) => b.usage - a.usage)
        break
      case 'newest':
        result = result.filter(entry => entry.status === 'new')
        break
      case 'all':
      default:
        result.sort((a, b) => a.order - b.order)
        break
    }

    return result
  })

  // 是否有搜索结果
  const hasResults = computed(() => filteredEntries.value.length > 0)

  // 是否正在过滤
  const isFiltering = computed(() => {
    return !!searchQuery.value || !!selectedGroup.value || sortBy.value !== 'all'
  })

  // 重置所有过滤
  function resetFilters() {
    searchQuery.value = ''
    selectedGroup.value = null
    sortBy.value = 'all'
  }

  // 清空搜索
  function clearSearch() {
    searchQuery.value = ''
  }

  // 设置分组过滤
  function setGroupFilter(groupId: string | null) {
    selectedGroup.value = groupId
  }

  // 设置排序方式
  function setSortBy(option: SortOption) {
    sortBy.value = option
  }

  return {
    searchQuery,
    selectedGroup,
    sortBy,
    filteredEntries,
    hasResults,
    isFiltering,
    resetFilters,
    clearSearch,
    setGroupFilter,
    setSortBy,
  }
}
