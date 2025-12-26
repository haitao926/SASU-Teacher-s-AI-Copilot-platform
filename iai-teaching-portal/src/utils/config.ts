import type { EntriesConfig, AnnouncementsConfig } from '@/types'

/**
 * 加载入口卡片配置
 */
export async function loadEntriesConfig(): Promise<EntriesConfig> {
  try {
    const response = await fetch('/config/entries.json')
    if (!response.ok) {
      throw new Error('Failed to load entries config')
    }
    return await response.json()
  } catch (error) {
    console.error('Error loading entries config:', error)
    // 返回默认空配置
    return { groups: [], entries: [] }
  }
}

/**
 * 加载公告配置
 */
export async function loadAnnouncementsConfig(): Promise<AnnouncementsConfig> {
  try {
    const response = await fetch('/config/announcements.json')
    if (!response.ok) {
      throw new Error('Failed to load announcements config')
    }
    return await response.json()
  } catch (error) {
    console.error('Error loading announcements config:', error)
    // 返回默认空配置
    return { announcements: [] }
  }
}
