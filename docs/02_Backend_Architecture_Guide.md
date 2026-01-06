# Backend Architecture & Modularity Guide

> **适用范围**: `bff` (Backend for Frontend Service)

## 1. 核心理念

BFF 服务作为前端与底层能力之间的 **中间层 (Middleman)**，核心职责是：
1.  **聚合 (Aggregation)**: 将多个下游服务 (LLM, MinerU, DB) 的数据聚合为一个 API 返回给前端。
2.  **控制 (Control)**: 统一处理鉴权 (Auth)、限流 (Rate Limiting) 和审计 (Auditing)。
3.  **简化 (Simplification)**: 为前端提供语义化、类型友好的接口，屏蔽底层复杂性。

## 2. 模块化设计 (Modularity)

为了在一个 BFF 进程中支持多个子应用 (OCR, Chat, Stats)，我们采用 **基于功能的模块化设计**。

### 目录结构约定
```text
bff/src/
├── services/           # [业务层] 纯业务逻辑，不感知 HTTP
│   ├── ocr.ts          # OCR 相关逻辑 (调用 MinerU)
│   ├── chat.ts         # 对话相关逻辑 (调用 LLM)
│   └── users.ts        # 用户/鉴权逻辑
├── routes/             # [路由层] HTTP 接口定义
│   ├── ocr.ts          # POST /api/ocr/*
│   ├── chat.ts         # GET /api/stream/chat
│   └── auth.ts         # POST /api/auth/*
└── plugins/            # [基础层] 通用中间件
    ├── auth.ts         # JWT 校验装饰器
    └── limit.ts        # 限流配置
```

### 接入新功能流程
1.  **定义数据模型**: 在 `prisma/schema.prisma` 中添加所需的数据表 (如 `ChatSession`)。
2.  **编写 Service**: 在 `services/` 下新建文件，封装核心逻辑 (CRUD, 第三方 API 调用)。
    - *原则*: Service 层只抛出 Error，不处理 HTTP 响应。
3.  **编写 Route**: 在 `routes/` 下新建文件，定义 Fastify 路由。
    - *原则*: Route 层负责参数校验 (Schema)、调用 Service、处理 HTTP 状态码。
4.  **注册插件**: 在 `main.ts` 中注册新的 Route 文件。

## 3. 数据层复用 (Prisma)

所有子应用共享同一个 Prisma Client 和数据库连接池。

- **Schema 管理**: 统一在 `bff/prisma/schema.prisma` 维护。
- **多租户/隔离**: 虽共享数据库，但应通过 `userId` 或 `tenantId` 字段在应用层实现数据隔离。

## 4. 鉴权与安全

- **JWT Auth**: 使用 `@fastify/jwt`。所有受保护路由需添加 `preHandler: app.authenticate`。
- **Rate Limit**: 全局默认限流 (如 100 req/min)。特定高消耗接口 (如 OCR Upload) 应在 Route 配置中单独收紧限制。
- **API Key 管理**: 严禁将第三方 API Key (OpenAI, MinerU) 暴露给前端。Key 必须存储在 BFF 的 `.env` 中，由 Service 层读取使用。

## 5. OpenAPI 与 SDK

BFF 会自动生成 OpenAPI 文档 (Swagger)。
- **导出命令**: `npm run export:openapi`
- **前端使用**: 前端项目通过工具 (如 `openapi-typescript`) 根据生成的 JSON 自动生成 TypeScript 类型定义和 API Client，确保前后端契约一致。
