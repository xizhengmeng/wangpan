# MySQL 初始化说明

## 环境变量

复制 `.env.example` 为 `.env.local`，然后填写：

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=wangpan
ADMIN_PASSWORD=admin888
ADMIN_SECRET=change_me_in_production
```

## 自动初始化

应用在第一次服务端访问数据库时会自动执行：

- 检查数据库是否存在
- 如果不存在则自动创建数据库
- 自动创建缺失的数据表
- 自动补齐缺失字段
- 如果频道和资源表为空，自动把 `data/` 里的初始结构和资源导入数据库

也就是说，只要数据库账号本身具备 `CREATE DATABASE` 和 `ALTER` 权限，应用启动后不需要手动跑建库建表命令。

## 手动初始化

如果你希望在部署前提前建好结构，也可以手动执行：

```bash
npm run init:db
```

## 把现有 JSON 数据同步到 MySQL

```bash
npm run sync:data
```

这一步会同步：
- 站点资料 `site_profile`
- 频道 `channels`
- 栏目 `categories`
- 专题 `topics`
- 资源 `resources`
- 标签 `resource_tags`
- 专题关联 `resource_topics`
- 事件 `track_events`
- 反馈 `feedback`

说明：
- `sync:data` 适合初始化迁移。
- `track_events` 和 `feedback` 会先清空再导入，避免重复累计。
- 同步完成后，前台页面、后台列表、导航、搜索、统计都从 MySQL 读取。

## 运行项目

```bash
npm run dev
```

## 当前表结构

- `site_profile`
- `channels`
- `categories`
- `topics`
- `resources`
- `resource_tags`
- `resource_topics`
- `track_events`
- `feedback`
