# 上科大附校 IAI 教学辅助平台 - Foundation Framework

## A. 技术方案与架构总览（原始文档）

### 1. 项目定位与目标

* **核心定位**：一站式 AI 教学效能平台（Teacher's AI Copilot）。
* **目标用户**：K12 教师（如上科大附校）。
* **核心价值**：通过集成多种 AI 能力（OCR、RAG、生成式 AI），解决教师备课繁琐、批改耗时、课堂互动单一的痛点。
* **当前阶段**：**V1.0 原型验证期**。
    * *现状*：具备完整的门户 UI 框架、路由系统、静态配置驱动的 Dashboard。
    * *下一步*：将“空壳”应用逐步填充为“真实可用”的工具，首选 MinerU 作为 OCR/文档解析引擎。

### 2. 总体技术架构 (Architecture)

采用 **“大前端门户 + 插件化微应用 + 混合 API 服务”** 的架构模式。

#### 架构分层图
```mermaid
graph TD
    subgraph "客户端 (Browser)"
        Portal[门户框架 (Shell)]
        Portal --> |挂载| AppOCR[OCR 工具 (插件)]
        Portal --> |挂载| AppChat[AI 助手 (插件)]
        Portal --> |挂载| AppPPT[PPT 设计 (插件)]
        
        Store[全局状态 Pinia]
    end

    subgraph "API 网关层 (Virtual Gateway)"
        ServiceOCR[OCR Service]
        ServiceChat[Chat Service]
        ServiceAuth[Auth Service]
    end

    subgraph "后端/第三方能力 (Backend/3rd Party)"
        MinerU[MinerU API (文档解析)]
        LLM[OpenAI/Claude (推理)]
        OSS[对象存储 (文件)]
    end

    AppOCR --> |调用| ServiceOCR
    ServiceOCR --> |HTTP/Token| MinerU
    
    AppChat --> |调用| ServiceChat
    ServiceChat --> |SSE| LLM
```

### 3. 核心技术栈 (Tech Stack)

| 领域 | 选型 | 理由 |
| :--- | :--- | :--- |
| **开发语言** | **TypeScript** | 强类型，保证大型前端项目的可维护性，减少运行时错误。 |
| **前端框架** | **Vue 3 (Composition API)** | 响应式系统强大，适合处理复杂的 AI 交互逻辑。 |
| **构建工具** | **Vite** | 极速冷启动，提升开发体验。 |
| **路由管理** | **Vue Router** | 管理 `/` (首页), `/apps/ocr` (子应用) 等路由。 |
| **状态管理** | **Pinia** | 轻量级状态库，用于在不同 AI 工具间共享数据。 |
| **UI 框架** | **TailwindCSS** + **Iconify** | 快速构建现代、响应式的界面。 |
| **API 客户端** | **Fetch / Axios** | 处理 HTTP 请求。 |
| **文档解析** | **MinerU API** | 专用于复杂文档（公式、表格）的高精度解析。 |

### 4. 目录结构规范 (Directory Structure)

确立 **Based-on-Features (按功能分块)** 的目录规范。

```text
src/
├── components/          # [全局] 通用组件 (Header, Sidebar, Card)
├── composables/         # [全局] 通用逻辑 (useSearch, useUser)
├── views/
│   ├── HomePage.vue     # [门户] 仪表盘首页
│   │
│   └── apps/            # [核心] 独立应用插件区
│       ├── ocr/         # === App 1: MinerU 文档解析 ===
│       │   ├── index.vue        # 入口 UI
│       │   ├── service.ts       # API 适配层 (GetUrl -> Upload -> Poll)
│       │   ├── useMinerU.ts     # 业务逻辑层 (状态机)
│       │   └── types.ts         # 类型定义
│       │
│       ├── chat/        # === App 2: AI 教学助手 ===
│       │   ├── index.vue
│       │   └── ...
│       │
│       └── ppt/         # === App 3: PPT 设计 ===
│           └── ...
└── utils/               # 工具函数
```

### 5. 关键功能模块规划 (Roadmap)

#### 模块 A：文档解析中心 (Intelligent OCR) - *当前重点*
* **引擎**：MinerU (PDF-Extract-Kit)。
* **功能**：支持 PDF/图片上传，精准还原公式 ($LaTeX$)、表格、Markdown 布局。提供解析结果下载或预览。
* **流程**：申请上传链接 -> 直传云端 -> 轮询解析结果 -> 获取 Zip。

#### 模块 B：AI 教学备课助手 (Co-Pilot)
* **引擎**：LLM (大模型) + RAG (检索增强)。
* **功能**：对话式备课，引用模块 A 解析出的教材内容，生成教案大纲。

#### 模块 C：多模态创作 (Creation)
* **引擎**：Canvas 渲染 + 生成式 AI。
* **功能**：根据教案自动生成 PPT 页面，文生图（教学素材）。

### 6. 实施策略

1. **基础设施固化**：确认目录结构和路由逻辑。
2. **单点突破**：集中精力打通 **MinerU 集成**，验证“API 驱动型前端应用”模式。
3. **模式复制**：后续 Chat 和 PPT 模块复制此模式。

---

## B. 基础架构方案（门户 Shell + SSO + BFF）

**架构目标**：门户 Shell + SSO + BFF 打通；统一路由/设计系统/SDK 基座；SSE/限流/审计闭环。

**组件划分**
- 前端：Vue3/Vite/Pinia/Tailwind；路由 `/`（门户）+ `/apps/...`（占位跳转）；提取 Design System 包（按钮/布局/主题/消息）。
- SSO：OIDC（Keycloak/Auth0/自建 IdP）；登录由门户发起；短时 Access Token + Refresh Token 存 httpOnly Cookie。
- BFF：NestJS/Fastify；鉴权（JWT 验证）、租户/用户注入、速率限制、审计日志、SSE 转发（LLM 流式）、统一错误码。
- API Gateway：Nginx/Traefik 负责入口路由与 TLS；限流/鉴权优先在 BFF 实现。

**核心流转**
- 登录：门户跳转 IdP 登录 → 回调带 code → 后端兑换 token → httpOnly Cookie 设置 → 前端仅用短时 Access Token 调 BFF。
- API：前端调用 typed SDK → BFF 校验/限流 → 下游（LLM/OCR/存储）→ SSE/流式由 BFF 统一转发。
- 状态：跨页面通过 URL/deep link + 后端存储的 id（docId/sessionId）；不做全局前端共享状态。

**标准约定**
- 错误码：401/403/429/5xx；业务错误统一 `{code,message,requestId}`。
- 幂等：上传/任务接口使用 `idempotency-key` 或 `requestId`。
- 可观测性：BFF 接入日志/指标/Trace（OpenTelemetry + Prometheus/Loki 可选）。

**最低可用技术选型**
- BFF：NestJS + Fastify 适配器，`@nestjs/throttler` 限流，`class-validator` 参数校验，SSE 用 `@nestjs/platform-express` 或手写 stream。
- SSO：Keycloak（自管）或 Auth0（托管）；JWT 签名用 JWKS 拉取。
- SDK：OpenAPI（BFF 导出）+ `openapi-typescript`/`orval` 生成前端 SDK。

## C. 任务清单 / Milestone

- **M0（1 天）**：确定 IdP（Keycloak/托管）、域名路由方案（门户与 BFF 域名）、错误码/幂等/限流标准。
- **M1（3-5 天）**：搭建 BFF 骨架（NestJS）；接 OIDC 验证与 JWKS；实现限流/鉴权中间件；输出 OpenAPI。
- **M2（2-3 天）**：前端接入 SSO（登录跳转/回调/登出）；接入 typed SDK；打通基础路由与 Design System 初版。
- **M3（2-3 天）**：实现 SSE 转发样例（LLM 假数据或占位服务）；接入审计日志、请求 ID。
- **M4（2-3 天）**：编写契约测试/集成冒烟（登录→调用受保护 API→SSE 流）；配置 CI/CD（lint/test/build）。

## D. BFF 骨架实现（当前进度）

已在 `bff/` 目录落地基础骨架（Fastify），包含：
- 鉴权与限流：`@fastify/jwt` + `@fastify/rate-limit`，短期密钥由 `.env` 配置。
- 路由：`/api/health`、`/api/auth/mock`（本地发短期 JWT）、`/api/whoami`（鉴权示例）、`/api/stream/demo`（SSE 示例）。
- 文档：`/docs` Swagger UI，便于后续生成前端 SDK。
- 请求追踪：`x-request-id` 在入站生成并回传响应头，方便日志关联。

本地运行：
```bash
cd bff
cp .env.example .env
npm install
npm run dev
```

导出 OpenAPI（生成 `openapi.json`，便于前端生成 typed SDK）：
```bash
cd bff
npm run export:openapi
```
