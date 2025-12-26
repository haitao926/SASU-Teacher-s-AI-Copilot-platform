export type EntryStatus = 'available' | 'maintenance' | 'new'

export interface PortalEntry {
  id: string
  name: string
  description: string
  tags: string[]
  url: string
  status: EntryStatus
  featured?: boolean
  group: string
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
  groups: string[]
  entries: PortalEntry[]
  announcements: Announcement[]
  contact: {
    label: string
    link: string
  }
}

export const portalConfig: PortalConfig = {
  title: 'AI 辅助教学入口（教师端 · PC）',
  subtitle: '集中入口、可配置卡片、可用性提示，帮助教师快速抵达课堂与备课工具',
  contact: {
    label: '如需新增入口或维护提示，请联系教务信息化负责人',
    link: 'mailto:it-admin@example.com',
  },
  groups: ['教学流程', '课堂工具', '备课/资源', '测评/批改', '数据分析', '通知/沟通'],
  entries: [
    {
      id: 'grading',
      name: 'AI 作业批改',
      description: '上传作业，自动评分并生成讲评要点',
      tags: ['AI批改', '测评'],
      url: 'https://example.com/grading',
      status: 'available',
      featured: true,
      group: '测评/批改',
    },
    {
      id: 'prep',
      name: '智能备课助手',
      description: '教学目标、重难点拆解，自动生成教案与课件提纲',
      tags: ['AI备课', '资源'],
      url: 'https://example.com/lesson-prep',
      status: 'available',
      featured: true,
      group: '备课/资源',
    },
    {
      id: 'quiz-builder',
      name: '试卷生成',
      description: '按章节与题型自动组卷，支持难度分层与题库过滤',
      tags: ['测评', '自动组卷'],
      url: 'https://example.com/quiz-builder',
      status: 'available',
      featured: true,
      group: '测评/批改',
    },
    {
      id: 'class-activity',
      name: '课堂活动 AI 设计',
      description: '基于课堂主题生成互动环节与分组任务',
      tags: ['课堂', '互动'],
      url: 'https://example.com/class-activity',
      status: 'available',
      group: '课堂工具',
    },
    {
      id: 'attendance',
      name: '课堂点名与记录',
      description: '快速点名，自动生成出勤统计与异常提醒',
      tags: ['课堂', '记录'],
      url: 'https://example.com/attendance',
      status: 'available',
      group: '课堂工具',
    },
    {
      id: 'board',
      name: '课堂投屏',
      description: '一键共享屏幕与课件，支持白板与批注',
      tags: ['课堂', '展示'],
      url: 'https://example.com/board',
      status: 'maintenance',
      group: '课堂工具',
    },
    {
      id: 'resource-hub',
      name: '备课素材库',
      description: '课件模版、例题与拓展资源集中管理',
      tags: ['资源', '备课'],
      url: 'https://example.com/resource-hub',
      status: 'available',
      group: '备课/资源',
    },
    {
      id: 'analysis',
      name: '成绩与作业分析',
      description: '按班级/知识点分析表现，提供教学建议',
      tags: ['数据分析', '反馈'],
      url: 'https://example.com/analysis',
      status: 'new',
      featured: true,
      group: '数据分析',
    },
    {
      id: 'notice',
      name: '通知发布与模板',
      description: '校内/家校通知模板与发布渠道汇总',
      tags: ['沟通', '模板'],
      url: 'https://example.com/notice',
      status: 'available',
      group: '通知/沟通',
    },
    {
      id: 'student-portfolio',
      name: '学生成长档案',
      description: '学习轨迹与亮点整理，便于面谈与反馈',
      tags: ['数据', '反馈'],
      url: 'https://example.com/portfolio',
      status: 'available',
      group: '数据分析',
    },
    {
      id: 'co-teaching',
      name: '协作备课',
      description: '多人协作编辑教案与资源，版本与评审记录',
      tags: ['协作', '备课'],
      url: 'https://example.com/co-teaching',
      status: 'available',
      group: '备课/资源',
    },
    {
      id: 'teaching-schedule',
      name: '教学日程管理',
      description: '课程表、作业提醒、考试安排一目了然',
      tags: ['日程', '课程表'],
      url: 'https://example.com/schedule',
      status: 'available',
      group: '教学流程',
    },
    {
      id: 'smart-ocr',
      name: '智能 OCR (小工具)',
      description: '截图识别文字、公式与化学符号',
      tags: ['OCR', '工具', '识别'],
      url: '/apps/ocr',
      status: 'new',
      featured: true,
      group: '课堂工具',
    },
    {
      id: 'image-gen',
      name: '图片生成与编辑',
      description: 'AI 辅助生成教学素材与图片编辑',
      tags: ['AI绘图', '备课', '素材'],
      url: '/apps/image-gen',
      status: 'new',
      featured: true,
      group: '备课/资源',
    },
    {
      id: 'ai-assistant',
      name: 'AI 教学助手',
      description: '基于大模型的教学问答与资料检索 (RAG)',
      tags: ['AI聊天', '备课', '助手'],
      url: '/apps/chat',
      status: 'new',
      featured: true,
      group: '教学流程',
    },
    {
      id: 'interaction-design',
      name: '教学交互体验设计',
      description: '设计并预览交互式教学网页内容',
      tags: ['交互', 'HTML', '设计'],
      url: '/apps/interaction',
      status: 'new',
      group: '课堂工具',
    },
    {
      id: 'ppt-design',
      name: 'PPT 智能设计',
      description: '快速生成教学 PPT 大纲与风格预览',
      tags: ['PPT', '备课', '设计'],
      url: '/apps/ppt',
      status: 'new',
      group: '备课/资源',
    },
    {
      id: 'lesson-plan',
      name: '智能教案设计',
      description: 'AI 辅助生成结构化教案内容',
      tags: ['教案', '备课', 'AI'],
      url: '/apps/lesson-plan',
      status: 'new',
      group: '教学流程',
    },
    {
      id: 'student-stats',
      name: '学生成绩统计',
      description: '作业提交情况与成绩数据可视化',
      tags: ['统计', '数据', '成绩'],
      url: '/apps/student-stats',
      status: 'new',
      group: '数据分析',
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
