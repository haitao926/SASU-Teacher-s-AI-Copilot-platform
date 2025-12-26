import { ref, computed } from 'vue'
import type { Announcement } from '@/types'
import { loadAnnouncementsConfig } from '@/utils/config'

const announcements = ref<Announcement[]>([])
const loading = ref(true)
const collapsed = ref(false)

export function useAnnouncements() {
  // 加载公告配置
  async function loadConfig() {
    loading.value = true
    try {
      const config = await loadAnnouncementsConfig()
      announcements.value = config.announcements
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      loading.value = false
    }
  }

  // 置顶公告
  const pinnedAnnouncements = computed(() => {
    return announcements.value.filter(a => a.pinned)
  })

  // 未读公告
  const unreadAnnouncements = computed(() => {
    return announcements.value.filter(a => !a.read)
  })

  // 未读数量
  const unreadCount = computed(() => unreadAnnouncements.value.length)

  // 标记为已读
  function markAsRead(announcementId: string) {
    const announcement = announcements.value.find(a => a.id === announcementId)
    if (announcement) {
      announcement.read = true
    }
  }

  // 标记全部已读
  function markAllAsRead() {
    announcements.value.forEach(a => {
      a.read = true
    })
  }

  // 切换折叠状态
  function toggleCollapse() {
    collapsed.value = !collapsed.value
  }

  return {
    announcements,
    loading,
    collapsed,
    pinnedAnnouncements,
    unreadAnnouncements,
    unreadCount,
    loadConfig,
    markAsRead,
    markAllAsRead,
    toggleCollapse,
  }
}
