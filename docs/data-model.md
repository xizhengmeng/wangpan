# 数据模型

## 1. 频道

字段：

- `id`
- `name`
- `slug`
- `description`
- `sort`
- `featured`
- `status`

## 2. 栏目

字段：

- `id`
- `channel_id`
- `parent_id`
- `name`
- `slug`
- `description`
- `sort`
- `featured`
- `status`

## 3. 专题

字段：

- `id`
- `category_id`
- `name`
- `slug`
- `summary`
- `sort`
- `featured`
- `status`

## 4. 资源

字段：

- `id`
- `title`
- `slug`
- `summary`
- `category`
- `tags[]`
- `cover`
- `quark_url`
- `extract_code`
- `publish_status`
- `published_at`
- `updated_at`
- `meta`

## 5. 资源明细

字段：

- `id`
- `parent_resource_id`
- `source_resource_id`
- `title`
- `slug`
- `description`
- `file_type`
- `file_ext`
- `sort_order`
- `grade`
- `subject`
- `resource_type`
- `edition`
- `region`
- `year`
- `has_answer`
- `source_pan_type`
- `source_pan_url`

## 6. 事件

字段：

- `name`
- `event_time`
- `session_id`
- `anon_user_id`
- `query`
- `resource_id`
- `result_rank`
- `result_count`
- `from_page`
- `referer`
- `device`
- `ua`

## 7. 反馈

字段：

- `id`
- `resource_id`
- `resource_title`
- `resource_slug`
- `reason`
- `note`
- `created_at`
- `resolved`

## 8. 说明

- 运行时数据统一存储在 MySQL
- 表结构见 [sql/schema.sql](/Users/k12/Work/Code/k12/nextjs/wangpan/sql/schema.sql)
- 初始化和迁移说明见 [docs/mysql-setup.md](/Users/k12/Work/Code/k12/nextjs/wangpan/docs/mysql-setup.md)
- K12 组资源迁移设计见 [docs/k12-group-migration.md](/Users/k12/Work/Code/k12/nextjs/wangpan/docs/k12-group-migration.md)
- `data/` 目录中的 JSON / JSONL 文件仅作为初始化迁移源，不再作为线上读写数据源
