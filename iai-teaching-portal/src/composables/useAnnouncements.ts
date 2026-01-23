import { ref, computed } from 'vue'
import type { Announcement } from '@/types'
import { loadAnnouncementsConfig } from '@/utils/config'

const announcements = ref<Announcement[]>([])
const loading = ref(true)
const collapsed = ref(false)

export function useAnnouncements() {
  // 加载公告
  async function loadConfig() {
    loading.value = true
    try {
      const res = await fetch('/api/announcements')
      if (res.ok) {
        const data = await res.json()
        // Merge with local read status if needed, or just default to false
        // For simple MVP, reset read status on reload is fine, or use localStorage to persist 'read' IDs
        announcements.value = data.map((item: any) => ({
          ...item,
          read: false
        }))
      } else {
        if (import.meta.env.DEV) {
          console.warn('[announcements] api unavailable (dev), fallback to static config')
          const config = await loadAnnouncementsConfig()
          announcements.value = config.announcements
        } else {
          console.error('[announcements] api unavailable (prod)')
          announcements.value = []
        }
      }
    } catch (error) {
      console.error('Error loading announcements:', error)
      if (import.meta.env.DEV) {
        // Fallback (dev only)
        try {
          const config = await loadAnnouncementsConfig()
          announcements.value = config.announcements
        } catch (e) {}
      } else {
        announcements.value = []
      }
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
