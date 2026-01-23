# SASU 平台微应用全栈架构白皮书 v1.0

> ⚠️ 本文档已整合至 `docs/07_Platform_Architecture_MicroApps_Content.md`（统一架构与微应用/内容中台规范）。此处保留作为历史版本与补充材料。

## 1. 核心愿景

构建一个**模块化、可插拔、全栈隔离**的教育应用生态系统。每个微应用（Micro-App）都应被视为一个独立的“器官”，拥有独立的生命周期、数据流转能力和标准化的交互界面，既能独立存活（开发调试），又能无缝协作（集成运行）。

---

## 2. 前端架构 (UI/UX Layer)

### 2.1 物理结构：Monorepo 工作区
所有微应用统一托管在 `apps/` 目录下，与主门户 (`iai-teaching-portal`) 并列。

```text
root/
├── apps/
│   ├── smart-lens/       # 微应用 A
│   ├── doc-parser/       # 微应用 B
│   └── ...
├── iai-teaching-portal/  # 宿主门户 (Host)
├── bff/                  # 后端服务
├── package.json          # Root Workspace Config
└── pnpm-workspace.yaml   # Workspace Definition
```

### 2.2 应用外壳 (App Shell) 规范
所有微应用**必须**遵循统一的视觉框架，以保证用户体验的一致性。

*   **布局容器**：
    *   高度：`h-screen` 或 `min-h-screen`。
    *   背景色：`bg-slate-50`。
*   **顶部导航栏 (Header)**：
    *   高度：固定 `64px` (`h-16`)。
    *   层级：`z-50`, `sticky top-0`。
    *   **左侧**：[返回按钮] + [图标] + [应用名称] + [简介]。
    *   **右侧**：[全局操作区]（如历史记录、设置）。
*   **内容区域 (Main)**：
    *   内边距：`p-4` 或 `p-6`。
    *   最大宽度：建议 `max-w-[1600px]` 居中。

### 2.3 运行模式
微应用需支持两种运行模式，通过 `vite.config.ts` 配置：
1.  **独立开发模式 (Stand-alone)**：拥有 `index.html` 和 `src/main.ts`，可独立启动服务器，包含模拟的 Auth 环境。
2.  **集成模式 (Integrated/Library)**：通过 `src/index.ts` 导出 Vue 组件，供门户路由懒加载。

---

## 3. 后端架构 (Backend Layer)

### 3.1 API 命名空间
BFF 层必须严格隔离不同业务的接口，防止路由冲突。

*   **格式**：`/api/<app-code>/<resource>`
*   **示例**：
    *   `POST /api/ocr/upload`
    *   `GET /api/grading/assignments`
    *   `GET /api/chat/history`

### 3.2 服务层 (Services)
每个微应用在 BFF 的 `src/services/` 下应有对应的独立模块。
*   禁止跨模块直接调用业务逻辑（如 OCR 服务不应直接修改成绩表）。
*   公共能力（如 `AuditLog`, `User`, `Tenant`）通过 `src/utils` 或核心服务模块提供。

### 3.3 数据库模型
在 `schema.prisma` 中，虽然物理上是单库，但逻辑上应通过注释区分模块。

```prisma
// --- Module: OCR ---
model OcrTask { ... }

// --- Module: Grading ---
model Assignment { ... }
model Submission { ... }
```

---

## 4. 数据流转与资产沉淀 (Data Flow)

微应用不仅是工具，更是**内容的生产者**。所有高价值产出必须回流到平台的**资源库 (Asset Library)**。

### 4.1 标准输出协议
微应用应提供“保存/导出”功能，调用统一的 `Asset` 创建接口。

**Asset 数据结构标准：**
| 字段 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `title` | String | 资源标题 | "七年级数学期末试卷解析" |
| `type` | String | 资源类型 | `markdown`, `quiz-json`, `image`, `file` |
| `content` | String | 核心内容 | Markdown 文本或 JSON 字符串 |
| `contentUrl` | String | 附件地址 | OSS/S3 链接 (如 PDF 原件) |
| `tags` | JSON | 标签 | `["数学", "七年级", "OCR"]` |
| `toolId` | UUID | 来源工具 | 关联到 `Tool` 表中的应用记录 |

### 4.2 交互流程
1.  用户在微应用中完成操作（如生成教案）。
2.  用户点击右上角“存入资源库”。
3.  应用弹出标准对话框（输入标题、标签）。
4.  应用调用 `POST /api/assets` 或各业务特定的 `save-asset` 接口。
5.  数据写入 `Asset` 表，即刻在门户的“备课资源”模块可见。

---

## 5. 开发接入清单 (Checklist)

### 新建应用步骤
1.  **脚手架**：在 `apps/` 下新建目录，复制标准模板（包含 `package.json`, `vite.config.ts`, `index.html`）。
2.  **依赖管理**：在 `package.json` 中声明自身依赖（如 `echarts`, `katex`），避免依赖门户。
3.  **UI 开发**：实现 `App.vue`，确保包含标准 Header。
4.  **后端对接**：在 BFF 注册 `/api/<new-app>` 路由。
5.  **门户注册**：
    *   在 `iai-teaching-portal/src/router/index.ts` 添加路由。
    *   在数据库或 `sync-portal-config.ts` 中添加菜单入口。

---

## 6. 未来演进：微前端 (Micro-Frontend)

当前架构为 **"Monorepo + 组件集成"** 模式。
当单个应用体积过大或需要独立部署时，可平滑升级为 **"基于 Module Federation 的微前端"**：
*   构建目标改为 `js` 资源包。
*   门户通过 URL 动态加载远程组件。
*   无需重写代码，仅需调整 `vite` 构建配置。
