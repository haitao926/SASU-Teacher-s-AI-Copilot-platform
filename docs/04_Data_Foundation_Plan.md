# 项目架构演进与数据地基规划 (v2.1)

> **日期**: 2026-01-05  
> **目标**: 构建稳固的数据底层，支持应用层（小工具）的敏捷开发、动态上架与资产沉淀。

## 1. 核心理念：Core-Plugins + Asset Hub

为了解决“应用越来越多、系统越来越重、数据割裂”的问题，采用 **“核心 + 插件”** 模式：

* **Core (地基)**: 用户管理、权限、工具注册、资产存储。
* **Plugins (应用)**: 独立“小工具卡片”（OCR、绘图、搜题），即插即用。
* **Asset Hub (资产中心)**: 工具产出（图片、教案、题目、流程图）统一沉淀与复用。

## 2. 数据模型设计 (Database Schema, v2.1)

通用约束：  
- 默认 `tenantId = "default"`，未来可按校区/班级扩展；删除采用软删 `deletedAt`。  
- 重要枚举：`ToolStatus = draft/active/maintenance/deprecated`；`AssetType = mermaid/image/quiz-json/markdown/text/audio/video/file`；`AssetVisibility = private/internal/public`。
- 由于当前使用 SQLite，枚举/JSON 以字符串 + 应用层校验存储（`tags/metadata` 持久化为 JSON 字符串，`type/visibility/status` 以字符串常量约束）。

### 2.1 Tool (工具注册表)
动态上架/下架前端工具，避免硬编码菜单。

| 字段名 | 类型 | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 主键 | `uuid` |
| `tenantId` | String | 所属租户/学校 | `"default"` |
| `code` | String | 唯一标识码（租户内唯一） | `"ai-flowchart"` |
| `name` | String | 显示名称 | `"AI 流程图助手"` |
| `description` | String? | 简要说明 | `"输入文字生成流程图"` |
| `route` | String | 前端路由 | `"/apps/flowchart"` |
| `icon` | String | 图标标识 | `"mdi:graph"` |
| `category` | String | 分类 | `"efficiency"` / `"content"` |
| `tags` | Json? | 标签数组 | `["AI","图形"]` |
| `status` | Enum | 状态 | `active` |
| `isEnabled` | Boolean | 开关 | `true` |
| `order` | Int | 排序 | `10` |
| `ownerId` | UUID? | 负责人 | `User.id` |
| `createdAt/updatedAt/deletedAt` | DateTime | 审计字段 |  |

### 2.2 Asset (通用资产表)
统一存储各工具产物，多态且可扩展。

| 字段名 | 类型 | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 主键 | `uuid` |
| `tenantId` | String | 所属租户/学校 | `"default"` |
| `title` | String | 资产标题 | `"冒泡排序流程图"` |
| `summary` | String? | 摘要/描述 | `"七年级算法示例"` |
| `content` | String? | 主要内容（小体量文本/JSON） | Mermaid 代码 / 题目 JSON |
| `contentUrl` | String? | 大文件存储地址 | OSS/GCS URL |
| `type` | Enum | 资产类型 | `mermaid` |
| `metadata` | Json? | 结构化元信息 | `{size:1234, mime:"image/png"}` |
| `tags` | Json? | 标签数组 | `["python","algorithm"]` |
| `version` | Int | 版本号 | `1` |
| `authorId` | UUID | 作者 | `User.id` |
| `toolId` | UUID? | 来源工具 | `Tool.id` |
| `visibility` | Enum | 可见性 | `private/internal/public` |
| `createdAt/updatedAt/deletedAt` | DateTime | 审计字段 |  |

索引（SQLite）：`Tool(tenantId, code/route/status)`；`Asset(tenantId, type/visibility/authorId/toolId)`。

## 3. 接口与流转 (API & Flows)

- `/api/tools`：返回可用工具列表（按租户、状态、是否启用过滤），供首页/侧边栏动态渲染。  
- `/api/tools` 管理端：`POST /tools`、`PUT /tools/:id`、`DELETE /tools/:id`、`POST /tools/:id/restore`，仅 ADMIN。  
- `/api/assets`：资产的创建、查询、查看详情、软删/恢复；默认返回「本人 + 本租户 internal/public」资产。支持过滤 `toolId/type/visibility`、分页。  
- 鉴权：写操作均需登录；读取时遵循租户 + 可见性规则；管理员可软删任意资产。  
- 存储策略：小体量文本放 `content`，大文件放对象存储并记录 `contentUrl` + `metadata`。  
- 标签与检索：`tags` 以数组 JSON 存储，后续可扩全文检索。

## 4. 实施路线图 (Roadmap)

### 阶段一：地基搭建 (Foundation)
- [x] **Schema & Migration**：更新 `schema.prisma`，增加审计/软删/租户字段；生成迁移并初始化本地 SQLite。
- [x] **Seed**：注册现有工具（OCR、Chat、Flowchart），写入示例资产。
- [x] **索引/校验**：为高频过滤列建索引；校验 `content` 与 `contentUrl` 至少一项存在。

### 阶段二：机制打通 (Registry & Menu)
- [x] **Backend**：落地 `/api/tools`、`/api/assets`（增删查+软删/恢复）、鉴权与分页（操作日志待补充）。
- [ ] **Frontend**：侧边栏/首页改为调用 `/api/tools` 渲染；资产卡片页支持按标签/类型筛选。
- [ ] **Admin**：提供工具开关/排序、资产软删/恢复的后台入口。

### 阶段三：应用落地与积累 (Apps & Accumulation)
- [ ] **新应用**：上线 “AI 绘图卡片 (Flowchart Maker)”——输入自然语言，生成 Mermaid，点击“保存”写入 `Asset`。
- [ ] **集成改造**：Chat / OCR 增加“保存到资源库”动作，写入 `Asset` 并打标签。
- [ ] **复用场景**：教案/备课工具可从 `Asset` 选择已有图/题目复用。

### 阶段四：运营与安全
- [ ] **权限与共享策略**：支持按班级/学校的 `internal` 共享；审计日志记录读/写关键操作。
- [ ] **监控与治理**：埋点资产创建/查看量，定期清理软删资产；新增版本回滚策略（基于 `version`）。

## 5. 预期价值

1. **架构解耦**：新增工具只需一个前端卡片 + 一条工具注册记录，不改动核心。
2. **数据复用**：跨工具调用资产库（图/题/方案），复用教学素材。
3. **资产沉淀**：随使用积累形成数字资源库，且具备版本、可见性与审计能力。
