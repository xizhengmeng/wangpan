# K12 资料库迁移设计

## 目标

把来源库 `k12_platform` 中的 K12 资料，迁移到当前网盘站的数据模型中，同时保留：

- `resource_groups` 作为前台主资源页
- `resources` 作为组内资料明细
- `tags/resource_tags` 作为标签、筛选和专题来源

迁移后的前台目标不是“单文件下载站”，而是“资料包下载站”。

## 来源库概况

来源库核心表：

- `resource_groups`
- `resources`
- `tags`
- `resource_tags`

已确认的样本规模：

- `resources`: 59298
- `resource_groups`: 2140
- `resource_tags`: 350734

来源库字段特征：

- `resource_groups.download_url` 更接近实际下载承接链接
- `resources.pan_url` 很多仍是本地 `file://` 路径
- `resources` 字段已经包含 `grade / subject / type / edition / region / year`
- `tags` 里已经沉淀了大量 `学段 / 册次 / 科目 / 版本 / 资料类型`

## 迁移原则

### 1. group 是主资源

来源库 `resource_groups` 迁移到目标库 `resources`。

一个 group 对应一个前台资源页，例如：

- `七上数学【人教】一课一练`
- `小升初语文阅读理解答题技巧`
- `中考数学专项训练`

### 2. resource 是明细

来源库 `resources` 不直接生成前台下载页，而是迁移到新增的 `resource_items` 表，作为组页下的“包含内容 / 文件清单 / 资料目录”。

### 3. tags 优先服务 group

来源库标签优先聚合到 group 级页面，支持：

- 搜索召回
- SEO 标签页
- 专题聚合
- 筛选和推荐

## 目标库映射

### resource_groups -> resources

来源字段：

- `resource_groups.id`
- `resource_groups.name`
- `resource_groups.path`
- `resource_groups.download_url`
- `resource_groups.pan_type`
- `resource_groups.pan_code`
- `resource_groups.description`

目标字段：

- `resources.id`: 生成稳定 ID，建议前缀 `k12grp_`
- `resources.title`: 对应 `resource_groups.name`
- `resources.slug`: 由 group 名生成
- `resources.summary`: 优先 `resource_groups.description`，否则由 path 和资料类型生成
- `resources.category`: 统一写入前台类目名，例如 `中小学资料`
- `resources.channel_id`: 指向 K12 频道
- `resources.category_id`: 指向对应栏目
- `resources.quark_url`: 优先使用 `resource_groups.download_url`
- `resources.extract_code`: 映射 `resource_groups.pan_code`
- `resources.publish_status`: `published`
- `resources.meta`: 存结构化信息

建议写入 `resources.meta` 的字段：

- `source_group_id`
- `source_group_path`
- `source_pan_type`
- `grade`
- `subject`
- `edition`
- `resource_type`
- `item_count`
- `content_kinds`

### resources -> resource_items

来源字段：

- `resources.id`
- `resources.group_id`
- `resources.title`
- `resources.description`
- `resources.grade`
- `resources.subject`
- `resources.type`
- `resources.edition`
- `resources.region`
- `resources.year`
- `resources.has_answer`
- `resources.pan_type`
- `resources.pan_url`

目标字段：

- `resource_items.id`: 生成稳定 ID，建议前缀 `k12item_`
- `resource_items.parent_resource_id`: 对应目标 `resources.id`
- `resource_items.source_resource_id`: 对应来源 `resources.id`
- `resource_items.title`
- `resource_items.description`
- `resource_items.file_ext`: 由标题或 URL 推断
- `resource_items.grade`
- `resource_items.subject`
- `resource_items.resource_type`
- `resource_items.edition`
- `resource_items.region`
- `resource_items.year`
- `resource_items.has_answer`
- `resource_items.source_pan_type`
- `resource_items.source_pan_url`

### tags/resource_tags -> resource_tags

优先迁到 group 页：

- `年级`
- `上册/下册/全一册`
- `语文/数学/英语/...`
- `人教版/北师版/...`
- `一课一练/单元测试/期中/期末/专项/复习/知识清单`

不建议第一阶段把所有标签都打到 `resource_items` 上。

## 前台呈现

### 列表页

只展示 group 级资源：

- 标题
- 摘要
- 标签
- 更新时间
- 网盘按钮

### 详情页

按下面 4 块呈现：

1. 资源包信息
2. 资料说明
3. 包含内容（来自 `resource_items`）
4. 相关推荐

### 搜索

搜索时可以同时检索：

- `resources.title`
- `resources.summary`
- `resource_tags.tag_name`
- `resource_items.title`

但搜索结果仍然返回 group 页，而不是 item 页。

## 类目映射建议

建议在目标站新增一个 K12 频道：

- `中小学资料`

建议栏目：

- `小学资料`
- `初中资料`
- `中考专区`
- `小升初 / 六升七`
- `打印资料`

建议专题：

- `一课一练`
- `单元测试`
- `期中期末`
- `专项训练`
- `知识清单`
- `知识点总结`
- `阅读理解`
- `写作素材`
- `字帖`

## 数据清洗要求

来源库字段不能直接信任，迁移前至少要做下面这些校正：

1. `subject` 与标题或路径冲突时，以 `group_path + title` 为准
2. `edition` 为空时，从标签和路径补推
3. `type` 做标准化映射
4. `download_url` 为空时，不直接发布
5. 去掉明显脏标题：
   - 文件扩展名残留
   - 半截目录名
   - 重复空格
   - 错位前缀

## type 标准化建议

来源库 `resources.type` 当前高频值：

- `one_lesson_one_practice`
- `comprehensive_test`
- `unit_test`
- `knowledge_summary`
- `final`
- `preview`
- `midterm`
- `advanced`
- `monthly_exam`

建议映射为统一展示文案：

- `one_lesson_one_practice` -> `一课一练`
- `unit_test` -> `单元测试`
- `monthly_exam` -> `月考`
- `midterm` -> `期中`
- `final` -> `期末`
- `knowledge_summary` -> `知识总结`
- `comprehensive_test` -> `综合测试`
- `advanced` -> `专项提升`
- `preview` -> `预习导学`

## 迁移步骤

### 第一步：dry-run

只跑统计和样本预览，不写入目标库。

检查项：

- 有多少 group 具备下载链接
- 每个 group 下有多少 items
- 标签聚合是否合理
- category / topic 映射是否符合预期

### 第二步：小样本导入

建议先导入：

- 七年级上册数学
- 小升初语文专项
- 中考数学专项

### 第三步：全量导入

完成小样本验证后，再放开全量。

## 验收标准

1. group 页可以正常展示下载入口
2. group 页下能看到明细列表
3. 标签页和搜索页能召回这些资源
4. 没有把本地 `file://` 链接直接暴露给前台
5. 没有生成大量无下载链接的薄页
