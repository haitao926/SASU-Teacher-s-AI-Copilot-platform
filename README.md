# AI 辅助教学入口页（教师端 · PC）

## 目标与范围
- 仅服务教师用户，作为 AI 辅助教学应用的统一入口页。
- PC 端呈现；无需登录，纯跳转聚合，但保留后续扩展的空间（SSO / 个性化）。
- 入口页应独立可用、可静态托管；外链异常时有友好提示与备用指引。

## 技术栈
### 核心框架
- **Vue 3.4+** (Composition API + `<script setup>`)
- **Vite 5+** 极速构建工具
- **TypeScript** 类型安全

### UI 设计系统
- **Element Plus** 企业级组件库（稳重专业）
- **TailwindCSS** 原子化样式（灵活定制）
- **Iconify** 统一图标方案（支持多图标库）
- **Vue Use** 组合式工具集

### 动画与交互
- **GSAP / Motion One** 高性能动画
- **Auto Animate** 自动过渡动画
- **VueUse Motion** 声明式动画

### 状态管理
- **Pinia** 轻量状态管理（如需扩展 SSO/个性化）

### 工程化
- **ESLint + Prettier** 代码规范
- **Husky + lint-staged** Git 提交钩子
- **Vitest** 单元测试（可选）

## UI 设计规范（专业舒适）

### 设计理念
- **教育专业感**：沉稳、可信赖、权威
- **减少认知负担**：清晰层级、充足留白、一致性
- **提升效率**：快速定位、直观操作、即时反馈

### 色彩系统
```css
/* 主色调：学术蓝 - 专业稳重 */
--primary: #3B82F6;        /* 主色 */
--primary-light: #60A5FA;  /* 悬停态 */
--primary-dark: #2563EB;   /* 按压态 */

/* 辅助色：温暖橙 - 点缀活力 */
--accent: #F59E0B;         /* 推荐/新功能标签 */

/* 中性色：高级灰 */
--gray-50: #F9FAFB;        /* 背景 */
--gray-100: #F3F4F6;       /* 卡片背景 */
--gray-200: #E5E7EB;       /* 边框 */
--gray-600: #4B5563;       /* 次要文字 */
--gray-900: #111827;       /* 主要文字 */

/* 状态色 */
--success: #10B981;        /* 可用 */
--warning: #F59E0B;        /* 维护 */
--info: #3B82F6;           /* 新功能 */
```

### 字体系统
```css
/* 主字体：思源黑体 CN / PingFang SC */
font-family: 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;

/* 字号层级 */
--text-xs: 12px;    /* 标签/辅助信息 */
--text-sm: 14px;    /* 正文 */
--text-base: 16px;  /* 卡片标题 */
--text-lg: 18px;    /* 分组标题 */
--text-xl: 24px;    /* 页面主标题 */
--text-2xl: 32px;   /* Banner */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
```

### 间距系统（8px 网格）
- 微间距：4px（紧凑元素）
- 小间距：8px（标签间距）
- 常规：16px（卡片内边距）
- 中等：24px（模块间距）
- 大间距：32px（分组间距）
- 超大：48px（顶部/底部留白）

### 圆角系统
- 小：4px（标签）
- 中：8px（按钮）
- 大：12px（卡片）
- 超大：16px（容器）

### 阴影系统（层次感）
```css
/* 悬浮卡片 */
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 4px 12px rgba(0,0,0,0.1);
--shadow-lg: 0 12px 32px rgba(0,0,0,0.12);

/* 悬停效果 */
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 动画规范
- **进入动画**：淡入 + 轻微上移（300ms）
- **悬停动画**：上浮 2px + 阴影增强（200ms）
- **点击反馈**：微缩放 0.98（100ms）
- **加载动画**：骨架屏 + 渐进式加载

## 页面模块

### 1. 顶部导航栏（固定吸顶）
- **左侧**：校徽 + 校名（上海科技大学附属学校 IAI 教学平台）
- **中间**：全局搜索框（支持名称/标签/关键词实时过滤，带搜索建议）
- **右侧**：帮助文档 + 反馈入口 + 用户头像占位（预留 SSO）

### 2. 侧边导航（可折叠）
- 分组导航：教学流程、课堂工具、备课/资源、测评/批改、数据分析、通知/沟通
- 支持图标 + 文字，折叠后仅显示图标
- 选中态高亮，微动画反馈

### 3. 主内容区（卡片网格）
- **响应式布局**：自适应 2/3/4 列网格
- **卡片设计**：
  - 左上角：状态徽标（可用/维护中/新功能）
  - 顶部：应用图标（渐变背景）
  - 中部：名称（粗体）+ 描述（灰色）
  - 底部：标签组 + 使用次数/热度指示
  - 悬停：上浮 + 阴影增强 + 显示"立即使用"按钮
- **排序选项**：常用/推荐/最新/全部

### 4. 公告区（右侧侧边栏/可折叠）
- 标题 + 时间 + 标签（维护/更新/通知）
- 支持置顶，未读标记
- 展开查看详情

### 5. 空状态 & 错误提示
- 搜索无结果：友好插图 + "试试其他关键词"
- 外链不可达：温和提示 + 联系方式 + 备用方案
- 加载失败：重试按钮 + 刷新指引

## 入口卡片字段建议
| 字段 | 说明 |
| --- | --- |
| name | 名称，例如“AI 作业批改” |
| description | 一句话简介 |
| tags | 例如 `AI批改` `备课` `数据分析` |
| url | 目标外链，新窗口打开 |
| status | `available` / `maintenance` / `new` |
| featured | 是否在“推荐/常用”区域置顶 |

## 运营与配置
- 卡片列表、分组、公告、状态通过配置文件或轻量后台维护，避免改代码。
- 支持快速下线入口（标记为维护或隐藏）；外链带来源参数便于统计。
- 统计仅收集点击量/跳出率用于排序，不采集个人敏感信息。

## 项目结构
```
iai-teaching-portal/
├── public/
│   ├── config/
│   │   ├── entries.json         # 卡片配置
│   │   └── announcements.json   # 公告配置
│   ├── icons/                   # 应用图标
│   └── logo.svg                 # 校徽
├── src/
│   ├── assets/
│   │   ├── styles/
│   │   │   ├── variables.css    # 设计系统变量
│   │   │   ├── reset.css        # 样式重置
│   │   │   └── animations.css   # 全局动画
│   │   └── images/              # 插图/空状态图
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppHeader.vue    # 顶部导航
│   │   │   ├── AppSidebar.vue   # 侧边导航
│   │   │   └── AppFooter.vue    # 底部信息
│   │   ├── cards/
│   │   │   ├── EntryCard.vue    # 入口卡片
│   │   │   └── StatusBadge.vue  # 状态徽标
│   │   ├── search/
│   │   │   └── GlobalSearch.vue # 全局搜索
│   │   ├── announcement/
│   │   │   └── AnnouncementPanel.vue
│   │   └── common/
│   │       ├── EmptyState.vue   # 空状态
│   │       ├── ErrorTip.vue     # 错误提示
│   │       └── LoadingSkeleton.vue
│   ├── composables/
│   │   ├── useEntries.ts        # 入口数据逻辑
│   │   ├── useSearch.ts         # 搜索逻辑
│   │   └── useAnalytics.ts      # 埋点统计
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   ├── utils/
│   │   ├── config.ts            # 配置加载
│   │   └── link-check.ts        # 外链健康检查
│   ├── App.vue
│   └── main.ts
├── .env.example                 # 环境变量示例
├── tailwind.config.js           # Tailwind 配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json
└── package.json
```

## 开发计划

### Phase 1: 项目初始化（Day 1）
- [x] 技术方案确定
- [ ] 创建 Vue 3 + Vite 项目
- [ ] 安装依赖（Element Plus, Tailwind, TypeScript）
- [ ] 配置开发环境（ESLint, Prettier）
- [ ] 搭建项目目录结构

### Phase 2: 设计系统实现（Day 1-2）
- [ ] 创建 CSS 变量（色彩/字体/间距系统）
- [ ] 配置 Tailwind 主题
- [ ] 封装基础动画组件
- [ ] 实现响应式网格系统

### Phase 3: 核心组件开发（Day 2-3）
- [ ] AppHeader（顶部导航 + 搜索）
- [ ] AppSidebar（侧边分组导航）
- [ ] EntryCard（入口卡片 + 悬停效果）
- [ ] StatusBadge（状态徽标）
- [ ] AnnouncementPanel（公告面板）

### Phase 4: 功能实现（Day 3-4）
- [ ] 配置文件加载（JSON）
- [ ] 全局搜索（实时过滤 + 高亮）
- [ ] 卡片排序/分组逻辑
- [ ] 外链打开（新窗口 + 来源参数）
- [ ] 外链健康检查（可选）

### Phase 5: 交互优化（Day 4）
- [ ] 页面进入动画
- [ ] 卡片悬停/点击反馈
- [ ] 骨架屏加载
- [ ] 空状态/错误提示
- [ ] 无障碍优化（ARIA 标签）

### Phase 6: 埋点与统计（Day 5）
- [ ] 点击统计（简单 PV/UV）
- [ ] 防刷限流（可选）
- [ ] 性能监控（可选）

### Phase 7: 部署与优化（Day 5）
- [ ] Vite 生产构建优化
- [ ] 静态资源 CDN 配置
- [ ] Nginx/Vercel 部署配置
- [ ] 性能测试（Lighthouse）

## 安全与可用性
- 基础 WAF/防刷/速率限制；静态资源建议 CDN 缓存。
- 入口页与外链解耦：即使子系统不可用，入口页仍可打开并给出告知。
- 统一视觉语言，满足基础无障碍（键盘可达、足够对比度、ARIA 标签）。

## 最小可行交付 (MVP) 清单
1. **基础布局**：顶部导航 + 侧边导航 + 主内容区 + 响应式设计
2. **配置驱动**：JSON 配置文件动态加载卡片/分组/公告
3. **核心功能**：
   - 全局搜索（实时过滤，支持名称/标签/描述）
   - 卡片点击跳转（新窗口打开，带来源参数）
   - 状态徽标显示（可用/维护/新）
   - 分组筛选与排序
4. **交互体验**：
   - 页面加载动画
   - 卡片悬停效果（上浮 + 阴影）
   - 骨架屏加载状态
   - 空状态与错误提示
5. **统计埋点**：点击计数（本地存储或简单 API，不含个人信息）
6. **无障碍**：键盘导航 + ARIA 标签 + 足够对比度

## 配置文件示例

### entries.json（卡片配置）
```json
{
  "groups": [
    {
      "id": "teaching-flow",
      "name": "教学流程",
      "icon": "mdi:school",
      "order": 1
    },
    {
      "id": "classroom-tools",
      "name": "课堂工具",
      "icon": "mdi:presentation",
      "order": 2
    },
    {
      "id": "resources",
      "name": "备课/资源",
      "icon": "mdi:book-open-variant",
      "order": 3
    },
    {
      "id": "assessment",
      "name": "测评/批改",
      "icon": "mdi:clipboard-check",
      "order": 4
    },
    {
      "id": "analytics",
      "name": "数据分析",
      "icon": "mdi:chart-line",
      "order": 5
    },
    {
      "id": "communication",
      "name": "通知/沟通",
      "icon": "mdi:bell",
      "order": 6
    }
  ],
  "entries": [
    {
      "id": "ai-grading",
      "name": "AI 作业批改",
      "description": "上传作业批量评分，自动生成讲评建议与错误分析",
      "icon": "gradient-purple",
      "tags": ["AI批改", "自动评分", "测评"],
      "url": "https://grading.example.com?source=iai-portal",
      "status": "available",
      "featured": true,
      "group": "assessment",
      "usage": 1280,
      "order": 1
    },
    {
      "id": "lesson-plan-assistant",
      "name": "智能备课助手",
      "description": "根据教学大纲快速生成教案框架，推荐教学资源",
      "icon": "gradient-blue",
      "tags": ["备课", "教案生成", "AI辅助"],
      "url": "https://lesson.example.com?source=iai-portal",
      "status": "available",
      "featured": true,
      "group": "resources",
      "usage": 980,
      "order": 2
    },
    {
      "id": "classroom-interaction",
      "name": "课堂互动工具",
      "description": "实时投票、随机点名、小组讨论、弹幕互动",
      "icon": "gradient-green",
      "tags": ["课堂互动", "实时反馈"],
      "url": "https://interact.example.com?source=iai-portal",
      "status": "available",
      "featured": false,
      "group": "classroom-tools",
      "usage": 756,
      "order": 3
    },
    {
      "id": "student-portrait",
      "name": "学情分析",
      "description": "学生学习画像、成绩趋势、知识点掌握情况可视化",
      "icon": "gradient-orange",
      "tags": ["数据分析", "学情报告"],
      "url": "https://analytics.example.com?source=iai-portal",
      "status": "available",
      "featured": false,
      "group": "analytics",
      "usage": 523,
      "order": 4
    },
    {
      "id": "exam-generator",
      "name": "智能组卷",
      "description": "基于知识点和难度自动生成试卷，支持导出 Word/PDF",
      "icon": "gradient-red",
      "tags": ["组卷", "试卷生成", "测评"],
      "url": "https://exam.example.com?source=iai-portal",
      "status": "new",
      "featured": true,
      "group": "assessment",
      "usage": 89,
      "order": 5
    },
    {
      "id": "resource-library",
      "name": "教学资源库",
      "description": "课件、视频、习题、素材一站式检索与下载",
      "icon": "gradient-teal",
      "tags": ["资源库", "素材"],
      "url": "https://resources.example.com?source=iai-portal",
      "status": "available",
      "featured": false,
      "group": "resources",
      "usage": 1120,
      "order": 6
    },
    {
      "id": "notification-center",
      "name": "消息通知中心",
      "description": "查看系统通知、教学提醒、家校沟通记录",
      "icon": "gradient-pink",
      "tags": ["通知", "消息"],
      "url": "https://notify.example.com?source=iai-portal",
      "status": "maintenance",
      "featured": false,
      "group": "communication",
      "usage": 430,
      "order": 7
    }
  ]
}

```

### announcements.json（公告配置）
```json
{
  "announcements": [
    {
      "id": "ann-001",
      "title": "智能组卷功能正式上线",
      "content": "全新的智能组卷系统已上线，支持按知识点和难度自动生成试卷，欢迎体验！",
      "time": "2025-12-15 10:30",
      "tag": "新功能",
      "tagType": "info",
      "pinned": true,
      "read": false
    },
    {
      "id": "ann-002",
      "title": "消息通知中心系统维护通知",
      "content": "消息通知中心将于今晚 22:00-23:00 进行系统升级，期间功能暂时不可用，请知悉。",
      "time": "2025-12-17 14:20",
      "tag": "维护",
      "tagType": "warning",
      "pinned": true,
      "read": false
    },
    {
      "id": "ann-003",
      "title": "AI 作业批改功能优化",
      "content": "优化了批改速度和准确率，新增错误类型统计功能。",
      "time": "2025-12-10 09:15",
      "tag": "更新",
      "tagType": "success",
      "pinned": false,
      "read": true
    }
  ]
}
```

## 启动开发

### 快速开始
```bash
# 1. 初始化项目
npm create vite@latest iai-teaching-portal -- --template vue-ts
cd iai-teaching-portal

# 2. 安装依赖
npm install
npm install -D tailwindcss postcss autoprefixer
npm install element-plus @element-plus/icons-vue
npm install @iconify/vue
npm install @vueuse/core @vueuse/motion
npm install pinia

# 3. 初始化 Tailwind
npx tailwindcss init -p

# 4. 启动开发服务器
npm run dev
```

### 构建部署
```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview
```
