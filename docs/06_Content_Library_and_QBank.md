# 内容资源库 / 题库后台设计（草案）

> ⚠️ 本文档已整合至 `docs/07_Platform_Architecture_MicroApps_Content.md`（统一架构与微应用/内容中台规范）。此处保留作为历史版本与补充材料。

> 目标：在现有 BFF + Prisma 框架下，为“课程资源库/题库”提供可运营的后台管理与前端访问接口，兼顾版本、权限与多租户。

## 范围与目标
- 资源库：课件、素材、视频、音频、PPT 模板、教案等文件或结构化内容。
- 题库：客观/主观题，支持知识点、学科、难度、年级标签，支持解析与多媒体。
- 能力：创建/编辑/删除、上架/下架、版本管理、批量导入导出、审核流、权限控制（教师/管理员/只读）。

## 数据建模（Prisma 草案）
- `Asset`（现有）：扩展用于资源库  
  - `type`: `file|markdown|video|audio|quiz-json|pptx|image`  
  - `metadata`：JSON（文件大小、mime、duration、grade、subject、tags、version、status=ACTIVE/DRAFT/ARCHIVED）  
  - `visibility`: `PRIVATE|INTERNAL|PUBLIC`  
  - `tags`: JSON 数组（年级/学科/关键词）  
  - `toolId`：可选，关联到具体工具（如资源库/题库）。
- `Question`（新增）：  
  - `id`, `tenantId`, `stem`, `type` (`single|multi|fill|short|essay`), `options` JSON, `answer` JSON, `analysis` TEXT  
  - `subject`, `grade`, `difficulty`（1-5）  
  - `knowledgePoints` JSON 数组  
  - `attachments` JSON（图片/音频/视频 URL）  
  - `status` (`DRAFT|PUBLISHED|ARCHIVED`), `version` Int  
  - `createdBy`, `updatedBy`, `createdAt`, `updatedAt`.
- `QuestionSet`（可选）：一组题目的集合（试卷/练习），持有 `questionIds` JSON、有 `status/version`。
- 审计：沿用 `AuditLog` 记录资源/题目 CRUD、导入导出。

## API 设计（BFF，均走 `/api` 前缀）
> 需要 JWT + 角色校验，管理员/编辑角色可写，教师可读。

### 资源库
- `GET /resources`：列表/筛选；query：`page,size,keyword,subject,grade,tag,status,visibility,type`；返回分页。
- `POST /resources`：创建资源（metadata + 内容/URL）；文件走预签名上传或表单直传。
- `GET /resources/:id`：详情。
- `PUT /resources/:id`：更新 metadata（含状态上架/下架/归档）。
- `DELETE /resources/:id`：软删除/归档。
- `POST /resources/batch/import`：批量导入（上传 JSON/CSV 后后台异步入库）。
- `GET /resources/export`：导出查询结果（CSV/JSON）。

### 题库
- `GET /questions`：分页查询（`keyword,subject,grade,difficulty,status,knowledgePoint`）。
- `POST /questions`：创建题目。
- `GET /questions/:id`：详情。
- `PUT /questions/:id`：更新题目/版本。
- `POST /questions/:id/publish`：状态流转为 PUBLISHED。
- `DELETE /questions/:id`：归档/删除。
- `POST /questions/import`：导入题目（JSON/Excel 模板），支持异步任务。
- `GET /questions/export`：导出查询结果。
- `GET /question-sets` / `POST /question-sets` ...：题组/试卷 CRUD（可选）。

### 附加接口
- `GET /taxonomies/subjects|grades|knowledge-points`：基础字典。
- `POST /upload/presign`：获取文件上传预签名 URL。
- `GET /stats/resources` / `GET /stats/questions`：运营统计（数量、上架率、最近更新）。

## 权限与审核
- 角色：`ADMIN`（全量）、`EDITOR`（创建/编辑/上架）、`VIEWER`（只读）。  
- 可选审核流：创建/更新进入 `DRAFT`，管理员审核后 `PUBLISHED`。  
- 所有写操作记录 `AuditLog`（操作人、资源类型、ID、diff）。

## 前端管理需求（Admin）
- 资源库：列表筛选、批量导入/导出、单条创建/编辑（上传文件或粘贴 Markdown）、上架/下架、版本历史查看。
- 题库：列表筛选、题目编辑器（支持选项/填空/主观题）、批量导入 Excel 模板、导出、知识点多选、预览。
- 权限控制：非管理员隐藏写操作；无权限的按钮禁用。

## 实施步骤建议
1. 数据库：新增 `Question`（及可选 `QuestionSet`），扩展 `Asset.metadata` 规范；运行 `prisma migrate dev`。
2. 后端：按上面路由拆分 `routes/resources.ts` 与 `routes/questions.ts`，复用现有 `auth` + `rateLimit` + `requestId`，写 `adminOnly`/`editorOnly` 中间件。
3. 前端 Admin：新增“资源库管理”“题库管理”页面，先做最小可用（列表 + 创建/编辑 + 导入），后补版本/审核。
4. 导入模板：定义 Excel/JSON 模板，提供示例文件并在 UI 提供下载。
5. 监控/审计：写入 `AuditLog`，加运营统计接口，便于后台看上架/活跃度。
