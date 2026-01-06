# 实施路线图（面向当前 TODO 项）

> 聚焦学生成绩（上传/导出/概览）、智能阅卷/批改、智能组卷；PPT 大纲暂缓。按阶段拆分可交付项，标注后端/前端/测试要点。

## 阶段 A：学生成绩上传/导出 + 门户集成
- **后端**  
  - ✅ 已有：`/api/academic/scores` 上传、列表、汇总、趋势、导出 CSV/PDF；模型 Student/Exam/Score 具备租户。  
  - [ ] 审计与限流：上传/导出写入 AuditLog，增加学情接口独立 rate limit。
- **前端 - Portal**  
  - [ ] `/apps/student-stats`：已接入 `/scores/summary` 概览与导出（CSV/PDF），待透传 JWT/租户（SSO）。  
  - [ ] Portal Admin：新增“成绩管理”入口，查看考试列表、筛选导出，跳转 student-stats 上传页。
- **前端 - student-stats（apps/student-stats）**  
  - [ ] 上传体验：模板下载、错误行提示、批量大小限制；上传成功反馈。  
  - [ ] 成绩列表/趋势：`/scores` 分页筛选；`/scores/trend/{studentId}` 渲染折线图。  
  - [ ] UI 对齐 Portal 品牌：导航/配色统一。
- **测试**  
  - [ ] E2E：上传→汇总→导出 CSV/PDF；多班级过滤；未登录 401；租户隔离。

## 阶段 B：智能阅卷/批改（优先于智能组卷）
- **数据模型（建议新增）**  
  - Assignment（作业/试卷元信息）、AnswerKey（题目答案与分值）、Submission（学生提交，关联 Student/Assignment）、GradingResult（主客观得分、AI/人工标记）。  
  - 可复用 Score/Exam，或保持独立后写回 Score。
- **后端**  
  - 上传答案/答题卡：保存 AnswerKey；生成答题卡模板。  
  - 上传扫描件/照片：调用 OCR（现有 MinerU/mock）+ 题号定位，客观题自动判分，主观题请求 LLM；生成 GradingResult。  
  - 人工复核：更新分数并写 AuditLog；导出成绩（CSV/PDF）及批改痕迹。  
  - 接口草案：`POST /api/grading/assignments`，`POST /api/grading/answer-keys`，`POST /api/grading/submissions`，`GET /api/grading/submissions`（含状态/进度），`POST /api/grading/submissions/:id/review`，`GET /api/grading/export`.
- **前端 - Portal**  
  - 新增卡片 `/apps/quiz-grading`：创建批次（上传答案）、上传学生卷、查看进度、导出成绩；复核页面支持手动调分。
- **测试**  
  - Mock 流程（无 MinerU/LLM 时）+ 实际 OCR/LLM 配置；大文件超时/重试；客观题精准度验证。

## 阶段 C：智能组卷（次优先）
- **后端**  
  - 题库 API 对接（鉴权/配额）；生成试卷（按知识点/难度/题型配比）；试卷存储为 Asset 或 Paper 模型；导出 MD/Word/PDF。  
  - 接口：`POST /api/quizzes/generate`（输入知识点/题型配比），`GET /api/quizzes/:id`，`POST /api/quizzes/:id/export?format=md|docx|pdf`。
- **前端**  
  - `/apps/quiz-builder`：填写知识点/难度→生成草稿→编辑/重排→保存版本→导出。支持题目替换、加权筛选。
- **测试**  
  - 题库鉴权失败回退；导出正确性；版本保存/恢复。

## 阶段 D：PPT 大纲（暂缓）
- 生成 Markdown 大纲，选择模板/占位符，导出 Marp/Slidev；二次编辑与版本保存。

## 跨阶段基础工作
- **鉴权/租户**：前端请求统一带 JWT + `x-tenant-id`；后端默认 token 解析租户，头部为可选覆盖（白名单校验）。  
- **配置与入口**：`/api/tools` 与 Portal 配置一致，Admin 可开关/排序。  
- **审计与监控**：关键写操作写 AuditLog；为学情/阅卷/组卷接口加独立限流；埋点上传/导出/生成次数。  
- **部署与环境**：准备 Postgres 迁移（enum/JSONB/并发），docker-compose（BFF/Portal/student-stats/DB），env 示例放 `config/`。

## 时间/优先级建议
1) 阶段 A（学情上传/导出+SSO+UI 对齐）  
2) 阶段 B（智能阅卷 MVP：答案上传、客观题判分、主观题 AI 建议、导出、复核）  
3) 阶段 C（组卷生成与导出）  
4) 阶段 D（PPT 大纲）
