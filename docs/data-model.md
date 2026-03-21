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

## 5. 事件

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

## 6. 反馈

字段：

- `id`
- `resource_id`
- `resource_title`
- `resource_slug`
- `reason`
- `note`
- `created_at`
- `resolved`

## 7. 说明

- 资源存储在 `data/resources.json`
- 行为事件存储在 `data/events.jsonl`
- 反馈存储在 `data/feedback.jsonl`
- 初始频道/栏目/专题结构存储在 `data/content-structure.json`
- 当前为单机文件实现，适合原型和自部署初版
