# IAI Teaching BFF (基础骨架)

用途：为门户与后续 AI 工具提供统一入口，内置鉴权、限流、SSE 转发示例与 OpenAPI 文档。

## 快速开始
```bash
cd bff
cp .env.example .env   # 调整端口、CORS、JWT_SECRET 等
npm install
npm run db:setup       # 初始化数据库 + 写入种子数据（首次运行必做）
npm run dev            # 开发模式，端口默认 8080
npm run export:openapi # 构建并导出 openapi.json
```

## 数据库初始化（Prisma）
本项目使用 Prisma migrations 管理数据库结构（默认 SQLite：`bff/prisma/dev.db`）。

常用命令：
```bash
cd bff
npm run db:migrate   # 应用 migrations（dev）
npm run db:reset     # 重置 dev.db（会清空数据）
npm run seed         # 写入种子账号/示例数据
```

默认种子账号（development 环境会自动确保可用）：
- `admin / admin123`
- `teacher1 / password123`

如果登录提示 `Account locked, please try later`：
- 开发环境：重启 `bff`（会自动清理锁定状态）
- 或执行：`npm run reset:admin`（重置 admin 密码并解除锁定）

## 可用接口（前缀 `/api`）
- `GET /health`：健康检查。
- `POST /auth/mock`：本地调试获取短期 JWT（生产环境自动禁用）。
- `GET /whoami`：需要 Bearer Token，返回解析后的用户信息。
- `GET /stream/demo`：SSE 示例，需要 Bearer Token。
- `GET /docs`：Swagger UI。

本地测试示例（获取 token）：
```bash
curl -X POST http://localhost:8080/api/auth/mock \
  -H "content-type: application/json" \
  -d '{"sub":"teacher-001","roles":["teacher"]}'
```
将响应的 `token` 放入请求头：
```bash
curl http://localhost:8080/api/whoami \
  -H "authorization: Bearer <token>"
```

导出 OpenAPI（生成 `openapi.json`，用于前端 SDK）：
```bash
npm run export:openapi
```

## 设计要点
- **鉴权**：使用 `@fastify/jwt` 校验短期访问令牌；生产环境需改为从 IdP (OIDC/JWKS) 获取密钥。
- **限流**：`@fastify/rate-limit` 在 BFF 层做速率限制，默认 100 req/min，可在 `.env` 调整。
- **SSE/流式**：示例路由 `/stream/demo` 展示 BFF 层转发流式响应的基本写法。
- **OpenAPI**：`@fastify/swagger` + `@fastify/swagger-ui` 自动暴露接口文档，便于生成前端 SDK。
- **请求追踪**：在 `onRequest` 注入 `x-request-id`，回传到响应头，便于日志关联。
- **账号安全**：种子账号使用 `scrypt` 哈希存储密码；生产环境必须设置强 `JWT_SECRET`（非 `dev-secret-change-me`），管理员专属接口增加了 RBAC 校验。
- **用户管理接口**：`GET/POST/PUT/DELETE /api/users`（Admin），`POST /api/users/:id/reset-password`，`PUT /api/me/password`；登录失败 5 次锁定 15 分钟。

## 数据导入（学生名册）
使用 `StudentsToExcel2026-1-6.xls`（实际为 UTF-8 制表符分隔文本）导入学生基础信息：
```bash
cd bff
npm run import:students -- --file ../StudentsToExcel2026-1-6.xls --tenant default
```
支持 `--dry-run` 预览，必需列：学号、姓名；班级将映射为 `年级-班级` 形式写入 `student.class`。

## 同步门户入口配置到数据库
将 `iai-teaching-portal/public/config/entries.json` 同步到 DB 的 `Group/Entry` 表：
```bash
cd bff
npm run import:entries -- --file ../iai-teaching-portal/public/config/entries.json --tenant default
```
未指定 `--file` 时使用上述默认路径；导入前会清理不在文件中的入口/分组。

## 导入教师账号
支持 CSV/TSV（含表头 `username,name,role,status,password`），未提供密码自动生成：
```bash
cd bff
npm run import:teachers -- --file ../Teachers.csv
```

## 后续扩展建议
- 接入 OIDC/JWKS：替换 `JWT_SECRET` 为 JWKS 签名验证，并校验 `aud/iss/exp`。
- 请求追踪：为每次请求注入 `requestId`，接入 OpenTelemetry。
- 服务发现：为下游（LLM/OCR 等）配置代理与熔断重试，形成完整网关。
