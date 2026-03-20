# 技术方案

## 1. 技术栈

- 框架：Next.js Pages Router
- 语言：TypeScript
- 存储：本地 JSON + JSONL 文件
- 样式：全局 CSS

## 2. 模块划分

- `pages/`：前台页面、后台页面、API、SEO 路由
- `components/`：搜索框、资源卡片、统计埋点、后台界面
- `lib/`：资源存储、CSV 导入、搜索排序、统计汇总
- `data/`：资源数据和事件日志

## 3. 当前实现原则

- 先用文件存储完成业务闭环
- 结构保持可迁移，后续可替换为 MySQL 或 PostgreSQL
- 搜索先做关键词相关性排序
- 统计先做事件日志，后续可接分析型数据库
