// 入口卡片数据类型
export interface EntryCard {
  id: string
  name: string
  description: string
  icon: string // 渐变类型或图标路径
  tags: string[]
  url: string
  status: 'available' | 'maintenance' | 'new'
  featured: boolean
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

// 过滤和排序选项
export type SortOption = 'featured' | 'usage' | 'newest' | 'all'

export interface FilterOptions {
  searchQuery: string
  selectedGroup: string | null
  sortBy: SortOption
}
