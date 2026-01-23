// 入口卡片数据类型
export interface EntryCard {
  id: string
  name: string
  description: string
  icon: string // 渐变类型或图标路径
  iconName?: string
  tags: string[]
  url: string
  status: 'available' | 'maintenance' | 'new'
  group: string
  usage: number
  order: number
}

// 分组数据类型
export interface Group {
  id: string
  name: string
  icon: string
  order: number
}

// 公告数据类型
export interface Announcement {
  id: string
  title: string
  content: string
  time: string
  tag: string
  tagType: 'success' | 'warning' | 'info' | 'error'
  pinned: boolean
  read: boolean
}

// 配置数据结构
export interface EntriesConfig {
  groups: Group[]
  entries: EntryCard[]
}

export interface AnnouncementsConfig {
  announcements: Announcement[]
}

// 前台页面 UI 配置（文案、Tips 等）
export interface PortalUiConfig {
  homeTitle: string
  homeSubtitle: string
  tipsEnabled: boolean
  tipsTitle: string
  tipsContent: string
}

// 过滤和排序选项
export type SortOption = 'usage' | 'newest' | 'all'

export interface FilterOptions {
  searchQuery: string
  selectedGroup: string | null
  sortBy: SortOption
}
