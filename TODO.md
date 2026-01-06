# ReOpenInnoLab-智教空间 开发待办 (Product Roadmap)

> **当前阶段**: V1.0 Prototype -> V2.0 MVP (Minimum Viable Product)
> **核心目标**: 将门户中展示的“空壳”应用逐步替换为真实可用的 AI 微应用。

## 🚀 核心应用交付 (Core Apps Delivery)

### 1. 智能 OCR (Smart OCR)
*状态: 🟡 原型完成，待生产化*
- [x] **基础流程**: 文件上传 -> MinerU 解析 -> Markdown 预览。
- [x] **结果导出**: 支持下载 Word (.docx) 和 PDF 格式（需后端处理 MinerU 返回的 ZIP）。
- [x] **多页预览**: 优化前端预览组件，支持翻页查看 PDF 解析结果。
- [x] **历史记录**: 用户可查看自己之前的解析任务记录（需数据库 `OcrTask` 表支持）。

### 2. AI 教学助手 (AI Copilot)
*状态: 🔴 仅有入口，待开发*
- [x] **对话界面 (`/apps/chat`)**: 实现类似 ChatGPT 的分栏布局（左侧历史会话，右侧聊天框）。
- [x] **流式响应**: 对接 BFF 的 SSE 接口 (`/api/stream/chat`)，实现打字机效果。
- [x] **教学场景预设**:
    - [x] **一键润色**: 输入粗糙指令，AI 自动优化为结构化 Prompt。
    - [x] **教案生成**: 选择年级/学科/课题，自动生成标准教案模板。

### 3. 学生学情统计 (Student Stats)
*状态: 🟡 独立应用，待集成*
- [ ] **无缝跳转/SSO**: 门户卡片跳转 student-stats 时携带 JWT/租户，免二次登录。
- [x] **入口配置**: Portal 首页卡片指向 `/apps/student-stats`，并支持配置 `VITE_STATS_APP_URL` 跳转上传端。
- [ ] **上传体验**: student-stats 增加模板下载、上传成功/失败提示与错误行反馈，限制批量大小。
- [x] **导出报表**: BFF `/api/academic/scores/export?format=csv|pdf`，Portal 内置导出按钮（CSV/PDF）。
- [ ] **概览/趋势**: Portal `/apps/student-stats` 显示考试+班级概览；student-stats 待补充成绩列表、筛选和趋势图。
- [ ] **UI 统一**: 调整 `apps/student-stats` 顶部导航/配色以匹配 Portal 品牌。

### 4. 更多工具 (More Tools)
*状态: ⚪️ 规划中（优先智能阅卷，其次组卷，PPT 暂缓）*
- [ ] **智能阅卷/批改 (`/apps/quiz-grading`)**: 后端已提供作业/答案/提交/导出 CSV 的 MVP；待接入 OCR+LLM、人工复核、AuditLog、Portal 前端与 PDF 导出。
- [ ] **智能组卷 (`/apps/quiz-builder`)**: 后端提供 mock 生成接口；待对接题库 API、草稿保存、导出 MD/Word/PDF、Portal 前端交互。
- [ ] **PPT 大纲 (`/apps/ppt`)**: 输入主题 -> 生成 Markdown 大纲；支持版式模板选择、图片占位符、导出 Marp/Slidev；允许二次编辑与版本保存。

---

## 🏗 平台能力建设 (Platform Capabilities)

### 用户中心 & 鉴权 (Auth & User)
- [ ] **真实登录**: 对接 Keycloak 或实现基于数据库的账号密码登录（替换 Mock）。
- [ ] **个人设置**: 允许用户修改头像、昵称，绑定手机号。
- [ ] **应用收藏**: 将“常用应用”数据从 LocalStorage 迁移至云端数据库，实现多端同步。

### 运营与配置 (Ops & Config)
- [ ] **动态配置**: 将 `portalConfig.ts` 移至后端数据库，提供 `/api/config` 接口。
- [ ] **简易后台**: 允许管理员在后台页面直接添加/下架应用卡片，发布公告。

### 运维与工程化 (DevOps)
- [ ] **Docker 部署**: 编写 Dockerfile，支持 `docker-compose up` 一键拉起所有服务（BFF + Portal + Redis + Postgres）。
- [ ] **监控告警**: 接入 Sentry 或 Prometheus，监控 BFF 接口报错与响应延迟。

---

## 🐛 已知问题 (Known Issues)
- [ ] **移动端适配**: Portal 在手机端侧边栏交互不够流畅。
- [ ] **Markdown 渲染**: 目前的简易渲染器不支持数学公式 ($LaTeX$) 的复杂嵌套。

## ✅ 已完成 (Done)
- [x] **品牌重塑**: 全线更名为 **ReOpenInnoLab-智教空间**。
- [x] **门户框架**: 响应式布局、卡片网格、全局搜索、配置驱动引擎。
- [x] **BFF 基座**: Node.js (Fastify) + Prisma 架构，支持鉴权与限流。
- [x] **MinerU 对接**: 完成了 OCR 引擎的 API 封装与联调。
