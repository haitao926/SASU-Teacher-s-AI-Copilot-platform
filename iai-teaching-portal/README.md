# AI 辅助教学入口页（教师端 · PC）

本项目基于 Vue 3 + Vite，提供一个无需登录的教师端 PC 入口页，聚合 AI 辅助教学应用，支持搜索、分组筛选、推荐位和公告展示。

## 功能速览
- 卡片入口：名称/简介/标签/状态徽标，点击新窗口跳转。
- 筛选与搜索：按分组、标签和关键词过滤，可切换“只看推荐”。
- 公告与提醒：置顶与时间排序，展示维护/更新提示。
- 配置驱动：入口、分组、公告、联系人信息集中在 `src/data/portalConfig.ts`。
- PC 优化：三栏布局、状态徽标、浅色风格，可自适应窄屏。

## 开发与预览
```bash
npm install
npm run dev   # 本地开发，默认端口 5173
npm run build # 生产构建
```

## 如何更新入口与公告
编辑 `src/data/portalConfig.ts`：
- `groups`：分组导航名称数组。
- `entries`：入口卡片，字段包含 `id/name/description/tags/url/status/featured/group`。
- `announcements`：公告，字段包含 `id/title/time/tag/pinned/content`。
- `contact`：页内联系信息与链接。

常见调整：
- 下线入口：将 `status` 设为 `maintenance` 或暂时从数组移除。
- 置顶推荐：设置 `featured: true`，推荐区自动显示。
- 新公告：新增对象并标记 `pinned: true` 可置顶。

## 目录结构
```
iai-teaching-portal/
├─ src/
│  ├─ App.vue               # 页面结构与交互
│  ├─ data/portalConfig.ts  # 配置数据
│  └─ style.css             # 全局基础样式
├─ index.html
└─ vite.config.ts
```

## 部署建议
- 可静态托管（如 Nginx/OSS/CDN），入口页与子系统解耦。
- 建议配合 CDN 缓存与基础 WAF/防刷；外链可加来源参数便于统计。
