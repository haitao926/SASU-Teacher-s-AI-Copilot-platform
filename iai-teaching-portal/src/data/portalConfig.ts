export type EntryStatus = 'available' | 'maintenance' | 'new'

export interface PortalGroup {
  id: string
  name: string
  icon: string
  order: number
}

export interface PortalEntry {
  id: string
  name: string
  description: string
  icon?: string // Color theme (e.g., 'gradient-blue')
  iconName?: string // MDI Icon name (e.g., 'mdi:camera')
  tags: string[]
  url: string
  status: EntryStatus
  featured?: boolean
  group: string // References PortalGroup.id
  usage?: number
  order?: number
}

export interface Announcement {
  id: string
  title: string
  time: string
  tag: string
  pinned?: boolean
  content: string
}

export interface PortalConfig {
  title: string
  subtitle: string
  groups: PortalGroup[]
  entries: PortalEntry[]
  announcements: Announcement[]
  contact: {
    label: string
    link: string
  }
}

export const portalConfig: PortalConfig = {
  title: 'ReOpenInnoLab-智教空间（教师端 · PC）',
  subtitle: '集中入口、可配置卡片、可用性提示，帮助教师快速抵达课堂与备课工具',
  contact: {
    label: '如需新增入口或维护提示，请联系教务信息化负责人',
    link: 'mailto:it-admin@example.com',
  },
  groups: [
    { id: 'creation', name: '智能创作', icon: 'mdi:creation', order: 1 },
    { id: 'resources', name: '备课资源', icon: 'mdi:bookshelf', order: 2 },
    { id: 'exam', name: '智能命题', icon: 'mdi:file-document-edit', order: 3 },
    { id: 'grading', name: '智能批改', icon: 'mdi:marker-check', order: 4 },
    { id: 'insights', name: '学情洞察', icon: 'mdi:chart-box', order: 5 }
  ],
  entries: [
    // --- 1. 智能创作 (creation) ---
    {
      id: 'smart-lens',
      name: '智能识图 (Smart Lens)',
      description: '截图极速识别公式、化学分子式，一键复制 LaTeX',
      icon: 'gradient-blue',
      iconName: 'mdi:line-scan',
      tags: ['OCR', '公式', '工具'],
      url: '/apps/smart-lens',
      status: 'new',
      featured: true,
      group: 'creation',
      usage: 0,
      order: 0
    },
    {
      id: 'lesson-plan',
      name: '智能教案设计',
      description: 'AI 辅助生成结构化教案内容',
      icon: 'gradient-teal',
      iconName: 'mdi:notebook-edit-outline',
      tags: ['教案', '备课', 'AI'],
      url: '/apps/lesson-plan',
      status: 'new',
      featured: true,
      group: 'creation',
      usage: 0,
      order: 1
    },
    {
      id: 'ppt-design',
      name: 'PPT 智能设计',
      description: '快速生成教学 PPT 大纲与风格预览',
      icon: 'gradient-red',
      iconName: 'mdi:presentation',
      tags: ['PPT', '备课', '设计'],
      url: '/apps/ppt',
      status: 'new',
      group: 'creation',
      usage: 0,
      order: 2
    },
    {
      id: 'image-gen',
      name: '图片生成与编辑',
      description: 'AI 辅助生成教学素材与图片编辑',
      icon: 'gradient-purple',
      iconName: 'mdi:palette-swatch-outline',
      tags: ['AI绘图', '备课', '素材'],
      url: '/apps/image-gen',
      status: 'new',
      group: 'creation',
      usage: 0,
      order: 3
    },
    {
      id: 'interaction-design',
      name: '教学交互体验设计',
      description: '设计并预览交互式教学网页内容',
      icon: 'gradient-orange',
      iconName: 'mdi:cursor-default-click-outline',
      tags: ['交互', 'HTML', '设计'],
      url: '/apps/interaction',
      status: 'new',
      group: 'creation',
      usage: 0,
      order: 4
    },
    {
      id: 'class-activity',
      name: '课堂活动 AI 设计',
      description: '基于课堂主题生成互动环节与分组任务',
      icon: 'gradient-green',
      iconName: 'mdi:puzzle-outline',
      tags: ['课堂', '互动'],
      url: 'https://example.com/class-activity',
      status: 'available',
      group: 'creation',
      usage: 756,
      order: 5
    },

    // --- 2. 备课资源 (resources) ---
    {
      id: 'doc-parser',
      name: '文档解析 (Doc Parser)',
      description: '上传教材/试卷 PDF，深度解析并还原为 Word/Markdown',
      icon: 'gradient-indigo',
      iconName: 'mdi:file-document-outline',
      tags: ['PDF解析', '文档', '资源'],
      url: '/apps/doc-parser',
      status: 'new',
      featured: true,
      group: 'resources',
      usage: 0,
      order: 0
    },
    {
      id: 'resource-hub',
      name: '备课素材库',
      description: '课件模版、例题与拓展资源集中管理',
      icon: 'gradient-teal',
      iconName: 'mdi:library-shelves',
      tags: ['资源', '备课'],
      url: 'https://example.com/resource-hub',
      status: 'available',
      group: 'resources',
      usage: 1120,
      order: 1
    },
    {
      id: 'ai-assistant',
      name: 'AI 教学助手',
      description: '基于大模型的教学问答与资料检索 (RAG)',
      icon: 'gradient-green',
      iconName: 'mdi:robot-happy-outline',
      tags: ['AI聊天', '备课', '助手'],
      url: '/apps/chat',
      status: 'new',
      featured: true,
      group: 'resources',
      usage: 0,
      order: 2
    },
    {
      id: 'smart-ocr',
      name: '智能 OCR (小工具)',
      description: '截图识别文字、公式与化学符号',
      icon: 'gradient-blue',
      iconName: 'mdi:text-recognition',
      tags: ['OCR', '工具', '识别'],
      url: '/apps/ocr',
      status: 'new',
      group: 'resources',
      usage: 0,
      order: 3
    },
    {
      id: 'prep',
      name: '智能备课助手',
      description: '教学目标、重难点拆解，自动生成教案与课件提纲',
      icon: 'gradient-indigo',
      iconName: 'mdi:lightbulb-on-outline',
      tags: ['AI备课', '资源'],
      url: 'https://example.com/lesson-prep',
      status: 'available',
      group: 'resources',
      usage: 980,
      order: 4
    },
    {
      id: 'co-teaching',
      name: '协作备课',
      description: '多人协作编辑教案与资源，版本与评审记录',
      icon: 'gradient-indigo',
      iconName: 'mdi:account-group-outline',
      tags: ['协作', '备课'],
      url: 'https://example.com/co-teaching',
      status: 'available',
      group: 'resources',
      usage: 0,
      order: 5
    },

    // --- 3. 智能命题 (exam) ---
    {
      id: 'quiz-builder',
      name: '试卷生成',
      description: '按章节与题型自动组卷，支持难度分层与题库过滤',
      icon: 'gradient-red',
      iconName: 'mdi:file-edit-outline',
      tags: ['测评', '自动组卷'],
      url: 'http://localhost:5176',
      status: 'new',
      featured: true,
      group: 'exam',
      usage: 89,
      order: 1
    },

    // --- 4. 智能批改 (grading) ---
    {
      id: 'grading',
      name: '智能阅卷',
      description: '上传答案/试卷，自动判分并导出成绩单',
      icon: 'gradient-blue',
      iconName: 'mdi:file-check-outline',
      tags: ['AI批改', '测评'],
      url: 'http://localhost:5175',
      status: 'new',
      featured: true,
      group: 'grading',
      usage: 1280,
      order: 1
    },

    // --- 5. 学情洞察 (insights) ---
    {
      id: 'analysis',
      name: '成绩与作业分析',
      description: '按班级/知识点分析表现，提供教学建议',
      icon: 'gradient-orange',
      iconName: 'mdi:chart-line-variant',
      tags: ['数据分析', '反馈'],
      url: 'https://example.com/analysis',
      status: 'new',
      featured: true,
      group: 'insights',
      usage: 523,
      order: 1
    },
    {
      id: 'student-portfolio',
      name: '学生成长档案',
      description: '学习轨迹与亮点整理，便于面谈与反馈',
      icon: 'gradient-pink',
      iconName: 'mdi:card-account-details-outline',
      tags: ['数据', '反馈'],
      url: 'https://example.com/portfolio',
      status: 'available',
      group: 'insights',
      usage: 0,
      order: 2
    },
    {
      id: 'student-stats',
      name: '学生成绩统计',
      description: '作业提交情况与成绩数据可视化',
      icon: 'gradient-indigo',
      iconName: 'mdi:poll',
      tags: ['统计', '数据', '成绩'],
      url: 'http://localhost:5174',
      status: 'new',
      group: 'insights',
      usage: 0,
      order: 3
    },
    {
      id: 'transcript-generator',
      name: '成绩证明生成器',
      description: '生成与打印学生单次考试或学期的正式成绩证明',
      icon: 'gradient-blue',
      iconName: 'mdi:printer',
      tags: ['成绩', '证明', 'PDF'],
      url: '/apps/transcript-generator',
      status: 'new',
      featured: true,
      group: 'insights',
      usage: 0,
      order: 4
    },
  ],
  announcements: [
    {
      id: 'maint-1',
      title: '课堂投屏将于 22:00-23:00 维护',
      time: '2025-12-18',
      tag: '维护',
      pinned: true,
      content: '维护期间请使用本地投屏或提前下载课件。',
    },
    {
      id: 'new-feature',
      title: '新增「成绩与作业分析」入口',
      time: '2025-12-17',
      tag: '更新',
      content: '可按班级与知识点查看表现并获得建议。',
    },
    {
      id: 'guide',
      title: '试卷生成新增难度分层参数示例',
      time: '2025-12-15',
      tag: '提示',
      content: '在组卷前可选择难度梯度并保存模板。',
    },
  ],
}

export default portalConfig
