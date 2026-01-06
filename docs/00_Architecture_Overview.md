# ReOpenInnoLab-智教空间 - Architecture Overview

> **Version**: 1.0 (Prototype)
> **Last Updated**: 2026-01-05

## 1. 项目定位与目标

* **产品名称**：ReOpenInnoLab-智教空间 (Teacher's AI Copilot)
* **核心定位**：K12 教师的“一站式”AI 教学效能平台。
* **目标用户**：K12 一线教师。
* **核心价值**：通过集成多种 AI 能力（OCR 文档解析、LLM 备课助手、学情分析），解决备课繁琐、批改耗时、数据分散痛点。

## 2. 总体技术架构 (Architecture)

本项目采用 **Monorepo** 结构，基于 **“大前端门户 (Portal) + 插件化微应用 (Micro-Apps) + 统一 BFF 后端”** 的架构模式。

```mermaid
graph TD
    subgraph "前端层 (Browser)"
        Portal[门户 Shell (iai-teaching-portal)]
        Portal --> |集成| AppOCR[OCR 工具 (插件)]
        Portal --> |集成| AppChat[AI 助手 (插件)]
        Portal --> |跳转| AppStats[学情统计 (独立应用)]
        
        Store[全局状态 Pinia]
    end

    subgraph "网关与服务层 (BFF Service)"
        BFF[BFF Service (Node.js/Fastify)]
        BFF --> Auth[鉴权 & 限流]
        BFF --> Router[路由分发]
    end

    subgraph "后端/第三方能力 (Backend/3rd Party)"
        MinerU[MinerU API (文档解析)]
        LLM[OpenAI/DeepSeek (大模型)]
        DB[(Prisma / SQLite)]
    end

    AppOCR --> |REST| BFF
    AppChat --> |SSE| BFF
    AppStats --> |REST| BFF
    
    BFF --> |Proxy| MinerU
    BFF --> |Stream| LLM
    BFF --> |CRUD| DB
```

### 核心组件
1.  **Portal Shell (`iai-teaching-portal`)**: 
    - 基于 Vue 3 + Vite。
    - 负责全局布局、导航、登录态管理 (JWT) 和微应用挂载。
2.  **Micro-Apps**:
    - **OCR**: 内置于 Portal 的组件级应用，负责文档上传与解析预览。
    - **Chat**: 内置于 Portal 的组件级应用，提供流式 AI 对话。
    - **Student Stats (`apps/student-stats`)**: 独立部署的 Vue 应用，通过 Portal 菜单跳转访问。
3.  **BFF (`bff`)**: 
    - 基于 Fastify + Prisma。
    - 提供统一的 API 入口，处理鉴权 (Auth)、限流 (Rate Limit) 和第三方服务代理 (Proxy)。

## 3. 核心技术栈 (Tech Stack)

| 领域 | 选型 | 理由 |
| :--- | :--- | :--- |
| **语言** | **TypeScript** | 前后端统一语言，类型安全，易于维护。 |
| **前端框架** | **Vue 3 (Composition API)** | 响应式能力强，生态成熟。 |
| **构建工具** | **Vite** | 极速冷启动，开发体验优异。 |
| **样式库** | **TailwindCSS + Element Plus** | 兼顾灵活定制与企业级组件规范。 |
| **后端框架** | **Fastify** | 高性能 Node.js 框架，插件机制灵活。 |
| **ORM** | **Prisma** | 类型安全的数据库访问层，支持 SQLite/PostgreSQL。 |
| **文档解析** | **MinerU** | 专用于复杂文档（公式/表格）的高精度 PDF 解析引擎。 |

## 4. 目录结构规范

```text
/
├── bff/                    # Backend for Frontend 服务
│   ├── src/
│   │   ├── services/       # 业务逻辑层 (LLM, MinerU封装)
│   │   ├── routes/         # 路由定义 (API 接口)
│   │   └── plugins/        # 全局插件 (Auth, RateLimit)
├── iai-teaching-portal/    # 教师门户前端
│   ├── src/
│   │   ├── views/apps/     # 内置微应用 (OCR, Chat)
│   │   ├── components/     # 全局组件
│   │   └── data/           # 静态配置 (portalConfig.ts)
├── apps/
│   └── student-stats/      # 学情分析独立应用
└── docs/                   # 项目文档
```

## 5. 关键功能模块规划

### 模块 A：文档解析中心 (Intelligent OCR)
* **引擎**：MinerU (PDF-Extract-Kit)。
* **功能**：支持 PDF/图片上传，还原公式 ($LaTeX$)、表格。提供 Markdown 预览与 ZIP 下载。
* **状态**：原型已完成 (M1)。

### 模块 B：AI 教学备课助手 (Co-Pilot)
* **引擎**：通用 LLM (DeepSeek/OpenAI)。
* **功能**：流式对话，辅助教案生成、题目解析。支持上下文记忆。
* **状态**：开发中 (M2)。

### 模块 C：学情数据分析 (Analytics)
* **引擎**：ECharts + 内部数据模型。
* **功能**：班级成绩趋势、知识点掌握度分析。
* **状态**：独立应用待集成。

## 6. 实施策略

1.  **基础设施固化**：BFF 骨架与 Monorepo 结构已就绪。
2.  **单点突破**：优先打通 **OCR** 全流程（已完成），验证 "前端上传 -> BFF 代理 -> 外部 API -> 轮询结果" 的模式。
3.  **模式复制**：将 OCR 的开发模式复制到 Chat（SSE 流式）和 Stats（数据查询）。
