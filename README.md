# ReOpenInnoLab-智教空间 (ReOpenInnoLab Teacher's AI Copilot Platform)

**ReOpenInnoLab-智教空间** 是一款专为 K12 教师打造的“一站式”教学效能工具。它集成了智能 OCR、学生学情分析、AI 教学助手等多种 AI 能力，通过统一的门户界面，帮助教师从繁琐的日常工作中解放出来。

## 🏗 架构概览 (Architecture)

本项目采用 **Monorepo** 结构，基于 **“门户 (Portal) + 微应用 (Micro-Apps) + BFF 后端”** 的架构设计：

- **门户外壳 (`iai-teaching-portal`)**：教师的主入口。提供统一的仪表盘、导航菜单和应用启动器。
- **微应用 (Micro-Apps)**：独立的功能模块（如学生统计、OCR 工具），既可独立开发部署，也能无缝集成到门户中。
- **BFF 层 (`bff`)**：**服务于前端的后端 (Backend-for-Frontend)**，基于 Fastify 构建。负责处理鉴权、限流以及 API 聚合（代理请求到 LLM、OCR 引擎等），为前端提供简洁统一的接口。

## 📦 核心组件 (Components)

| 组件名称 | 目录位置 | 说明 | 技术栈 |
| :--- | :--- | :--- | :--- |
| **教学门户 (Portal)** | `iai-teaching-portal/` | 教师主工作台，聚合所有工具入口。 | Vue 3, Vite, TailwindCSS, Element Plus |
| **学情统计 (Stats)** | `apps/student-stats/` | 学生成绩与表现的可视化分析仪表盘。 | Vue 3, Vite, ECharts |
| **智能阅卷 (Quiz Grading)** | `apps/quiz-grading/` | 独立微应用：上传答案/试卷，自动判分并导出。 | Vue 3, Vite |
| **智能组卷 (Quiz Builder)** | `apps/quiz-builder/` | 独立微应用：按知识点/难度生成试卷草稿。 | Vue 3, Vite |
| **BFF 服务端** | `bff/` | 负责鉴权、API 代理和限流的后端服务。 | Node.js, Fastify, Prisma |
| **项目文档** | `docs/` | 架构规范、设计文档和使用指南。 | Markdown |

## ✨ 核心特性 (Key Features)

- **统一入口**：单点登录 (SSO) 就绪的架构，一个账号访问所有教学工具。
- **配置驱动**：通过 `portalConfig.ts` 即可轻松管理应用入口、公告和菜单。
- **智能分析**：集成 ECharts，提供直观的学生数据洞察。
- **AI 就绪**：BFF 层预置了 SSE (Server-Sent Events) 支持，完美适配流式 AI 响应。
- **安全可靠**：内置基于 IP 的限流机制和 JWT 身份验证基础。

## 🛠 技术栈 (Tech Stack)

- **语言**：TypeScript (前端 & 后端)
- **前端**：Vue 3 (Composition API), Vite, Pinia, TailwindCSS
- **后端**：Node.js, Fastify, Prisma (SQLite/PostgreSQL)
- **工具**：npm workspaces (项目管理), Shell Scripts (自动化脚本)

## 🚀 快速开始 (Getting Started)

### 前置要求
- **Node.js**: 推荐 v18 或更高版本
- **npm**: v9 或更高版本

### 安装依赖
克隆仓库并安装所有工作区的依赖：
```bash
# 启动脚本会自动检查并安装依赖，
# 你也可以手动执行以下命令：
cd iai-teaching-portal && npm install && cd ..
cd apps/student-stats && npm install && cd ..
cd bff && npm install && cd ..
```

### 运行项目

我们提供了便捷的脚本，可一键启动整个生态系统。

**🟢 开发模式 (Development Mode)**
启动所有服务，支持热更新 (Hot-Reloading)。
```bash
./start_dev.sh
```
- **BFF 服务端**: `http://localhost:8080`
- **教学门户**: `http://localhost:5173`
- **学情统计**: `http://localhost:5174`
- **智能阅卷**: `http://localhost:5175`
- **智能组卷**: `http://localhost:5176`

**🟡 生产模拟 (Production Simulation)**
构建所有项目并以静态服务方式运行，模拟生产环境。
```bash
./start_prod.sh
```
- **BFF 服务端**: `http://localhost:8080`
- **教学门户**: `http://localhost:4173`
- **学情统计**: `http://localhost:4174`
- **智能阅卷**: `http://localhost:4175`
- **智能组卷**: `http://localhost:4176`

## 📂 目录结构

```text
/
├── bff/                    # 后端 API 服务 (BFF)
│   ├── src/                # 源代码 (Fastify)
│   ├── prisma/             # 数据库 Schema
│   └── openapi.json        # API 接口定义
├── iai-teaching-portal/    # 教师门户主前端
│   ├── src/data/           # 配置文件 (portalConfig.ts)
│   └── src/views/          # 页面视图
├── apps/
│   ├── student-stats/      # 学生学情分析微应用
│   ├── quiz-grading/       # 智能阅卷微应用
│   └── quiz-builder/       # 智能组卷微应用
├── docs/                   # 项目文档
├── start_dev.sh            # 一键开发启动脚本
├── start_prod.sh           # 一键生产启动脚本
└── README.md               # 本文件
```

## 📚 详细文档

更多详细信息，请参考各模块的具体文档：

- [架构总览](docs/00_Architecture_Overview.md)
- [门户设计规范](docs/01_Portal_Design_Spec.md)
- [后端架构指南](docs/02_Backend_Architecture_Guide.md)
- [MinerU 集成说明](docs/03_MinerU_Integration.md)
- [数据地基规划](docs/04_Data_Foundation_Plan.md)
- [实施路线图](docs/05_Execution_Plan.md)

## 📄 版权说明

本项目归 **上科大附校 (SASU)** 所有。
