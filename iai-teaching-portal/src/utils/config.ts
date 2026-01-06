import type { EntriesConfig, AnnouncementsConfig } from '@/types'
import { portalConfig } from '@/data/portalConfig'

/**
 * 加载入口卡片配置
 */
export async function loadEntriesConfig(): Promise<EntriesConfig> {
  try {
    const res = await fetch('/api/entries/config')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      groups: data.groups || [],
      entries: (data.entries || []).map((e: any) => ({
        ...e,
        group: e.group ?? e.groupId ?? '',
        tags: e.tags ?? [],
        usage: e.usage ?? 0
      }))
    }
  } catch (error) {
    console.warn('[config] entries api failed, fallback to local config', error)
    // 直接返回本地配置，保持 async 签名以兼容现有调用
    return {
      groups: portalConfig.groups,
      entries: portalConfig.entries as any
    }
  }
}

/**
 * 加载公告配置
 */
export async function loadAnnouncementsConfig(): Promise<AnnouncementsConfig> {
  return Promise.resolve({
    announcements: portalConfig.announcements as any
  })
}
