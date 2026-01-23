import type { EntriesConfig, AnnouncementsConfig, PortalUiConfig } from '@/types'
import { portalConfig } from '@/data/portalConfig'

const defaultPortalUiConfig: PortalUiConfig = {
  homeTitle: '常用应用',
  homeSubtitle: '您收藏的教学工具，触手可及',
  tipsEnabled: true,
  tipsTitle: 'AI 提问小技巧',
  tipsContent: '试着给 AI 一个具体的“身份”，比如“你是一位有20年经验的中学数学老师”，它的回答会更专业哦。'
}

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
    if (import.meta.env.DEV) {
      console.warn('[config] entries api failed (dev), fallback to local config', error)
      // 仅开发环境回退本地配置，避免生产环境静默掩盖后端问题
      return {
        groups: portalConfig.groups,
        entries: portalConfig.entries as any
      }
    }
    console.error('[config] entries api failed (prod)', error)
    throw error
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

/**
 * 加载前台页面文案/小技巧等 UI 配置
 */
export async function loadPortalUiConfig(): Promise<PortalUiConfig> {
  try {
    const res = await fetch('/api/portal/settings')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      homeTitle: data.homeTitle ?? defaultPortalUiConfig.homeTitle,
      homeSubtitle: data.homeSubtitle ?? defaultPortalUiConfig.homeSubtitle,
      tipsEnabled: typeof data.tipsEnabled === 'boolean' ? data.tipsEnabled : defaultPortalUiConfig.tipsEnabled,
      tipsTitle: data.tipsTitle ?? defaultPortalUiConfig.tipsTitle,
      tipsContent: data.tipsContent ?? defaultPortalUiConfig.tipsContent
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[config] portal ui api failed (dev), fallback to defaults', error)
      return defaultPortalUiConfig
    }
    console.error('[config] portal ui api failed (prod)', error)
    throw error
  }
}
