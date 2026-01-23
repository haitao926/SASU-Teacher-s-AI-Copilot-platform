# ReOpenInnoLab-智教空间 Development Roadmap

> **Current Phase**: V1.5（从“应用集合”升级为“数据平台”）
>
> **核心中的核心**：
> 1) **教师资源资产化沉淀**（Asset Library）  
> 2) **学生学习数据采集与分析**（Learning Events + Academic Records）
>
> **统一口径文档**：`docs/07_Platform_Architecture_MicroApps_Content.md`

---

## P0：平台可用性（先把“能用/能管/能沉淀/能追踪”跑通）

### 鉴权与用户体系（影响所有微应用）
- [x] 登录与 JWT：`POST /api/auth/login` + `GET /api/whoami`
- [x] 登录失败锁定（5 次 / 15 分钟）+ 解锁/重置密码（Admin）
- [x] Dev 启动自动确保种子账号可用（避免锁死）
- [ ] 统一“开发默认账号/重置方式”到入口文档与脚本（Portal README / BFF README / 一键命令）

### Admin 配置能力（用后台驱动前台，而不是硬编码）
- [x] **入口/分组配置**：`/api/entries/config` + Admin CRUD（分组/入口）
- [x] **前台文案与 Tips**：`/api/portal/settings` + Admin 配置页
- [x] **公告管理**：`/api/announcements` + Admin 管理页（仅首页展示置顶）
- [x] **用户管理**：角色/状态/导入导出/审批/解锁/重置密码
- [x] **学生名册**：Admin 导入/导出 + 脚本导入（`StudentsToExcel2026-1-6.xls` 实为 TSV）
- [x] **资源库/题库后台**：资源库管理、题库管理（最小可用）
- [x] **学习数据看板**：Events Dashboard + Recent/Stats API

### DB 与迁移（必须可部署、可重装、可复现）
- [x] 修复迁移历史（提供可运行 baseline migration）
- [ ] 明确 DB 策略：SQLite（dev/demo）+ Postgres（prod）与 rebaseline/squash 方案
- [ ] 补齐 `.gitignore` 与产物清理（db-journal/tsbuildinfo 等）

---

## P1：数据中台（内容 & 学习数据）

### 内容中台（Teacher Assets）
- [x] **Asset API**：统一收敛 `/api/assets`（可见性/软删/校验）
- [x] **题库 API**：`/api/questions` CRUD + 发布/导出（可运营的最小能力）
- [ ] **大文件存储适配层**：local → S3/MinIO + 预签名上传 + `contentUrl/metadata` 规范
- [ ] **开放 API 契约**：导出 OpenAPI，生成 Portal/微应用 typed client（减少 401/headers 漏带）

### 学习数据中台（Student Learning Data）
- [x] **LearningEvent**：`POST /api/events`（单条/批量）+ `/api/events/stats`
- [ ] **事件字典（Taxonomy）**：最小可版本化 action 列表 + payload 必填键
- [ ] **自动事件**：关键服务端动作自动写入事件（资产创建/发布/导出/阅卷发布等）

---

## P2：关键业务闭环（会出现“复杂应用”的地方）

### 智能阅卷（复杂应用示例）
- [x] 基础链路：批次/提交/判分（Mock/LLM-ready）+ 成绩写回 + CSV 资产沉淀
- [ ] **人工复核**：`/api/grading/submissions/:id/review` + UI 调分 + 重新发布
- [ ] **模板驱动 ROI**：答题卡模板 Asset → 自动定位/复用/版本
- [ ] **个人讲评/报告**：PDF/Asset 沉淀（可分享/可追踪）

### 学情分析
- [x] 从本地 Excel 改为 BFF `/api/academic/*`
- [ ] 趋势/个体追踪视图 + 上传体验硬化（模板/错误行报告）

---

## P3：生态扩展（“别人写的新应用怎么接进来”）
- [ ] 明确“接入合同”：路由 + Entry/Group +（可选）Tool + 权限 + 数据沉淀点（Asset/Event）
- [ ] 提供微应用模板（standalone + integrated）与最小示例（whoami、assets、events）

---

## P4：工程化与部署
- [ ] Dockerfile（Portal/BFF）+ docker-compose（DB/Redis/MinIO）
- [ ] CI（build/lint/typecheck）+ 数据库迁移流水线（deploy）
