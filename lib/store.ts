import { randomUUID } from "node:crypto";

import { PoolConnection, RowDataPacket } from "mysql2/promise";

import { summarizeEvents } from "@/lib/analytics";
import { execute, queryRows, withTransaction } from "@/lib/db";
import { slugify } from "@/lib/format";
import { searchResources } from "@/lib/search";
import {
  CategoryNode,
  Channel,
  ContentStructure,
  CsvImportResult,
  Feedback,
  FeedbackReason,
  PublishStatus,
  Resource,
  SearchResponse,
  TrackEvent,
  TopicNode,
} from "@/lib/types";

type ResourceRow = RowDataPacket & {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  channel_id: string | null;
  category_id: string | null;
  cover: string;
  quark_url: string | null;
  extract_code: string | null;
  publish_status: PublishStatus;
  published_at: string;
  updated_at: string;
  meta: string | null;
};

type TagRow = RowDataPacket & {
  resource_id: string;
  tag_name: string;
  tag_slug: string;
};

type ResourceTopicRow = RowDataPacket & {
  resource_id: string;
  topic_id: string;
};

type SiteProfileRow = RowDataPacket & {
  name: string;
  tagline: string;
  short_link: string;
  positioning: string;
  featured_message: string | null;
  hot_searches: string | null;
  featured_channels: string | null;
  hot_tags: string | null;
};

type ChannelRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  featured: number;
  status: "active" | "hidden";
};

type CategoryRow = RowDataPacket & {
  id: string;
  channel_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  featured: number;
  show_on_home: number;
  status: "active" | "hidden";
};

type TopicRow = RowDataPacket & {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  summary: string;
  download_url: string | null;
  sort_order: number;
  featured: number;
  status: "active" | "hidden";
  field_schema: string | null;
};

type EventRow = RowDataPacket & {
  name: TrackEvent["name"];
  event_time: string;
  session_id: string | null;
  anon_user_id: string | null;
  query_text: string | null;
  resource_id: string | null;
  result_rank: number | null;
  result_count: number | null;
  from_page: string | null;
  referer: string | null;
  device: string | null;
  ua: string | null;
};

type FeedbackRow = RowDataPacket & {
  id: string;
  resource_id: string;
  resource_title: string;
  resource_slug: string;
  reason: FeedbackReason;
  note: string | null;
  created_at: string;
  resolved: number;
};

function toIsoString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value.includes("T")) {
    return value.endsWith("Z") ? value : `${value}Z`;
  }

  return `${value.replace(" ", "T")}Z`;
}

function toSqlDateTime(value: string | Date) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function parseHotSearches(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    return value
      .split(/\r?\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch { /* ignore */ }
  return [];
}

function mapResourceRow(
  row: ResourceRow,
  tagsByResourceId: Map<string, string[]>,
  topicIdsByResourceId: Map<string, string[]>
): Resource {
  const resource: Resource = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    category: row.category,
    topic_ids: topicIdsByResourceId.get(row.id) || [],
    tags: tagsByResourceId.get(row.id) || [],
    cover: row.cover,
    publish_status: row.publish_status,
    published_at: toIsoString(row.published_at),
    updated_at: toIsoString(row.updated_at),
  };

  if (row.quark_url) {
    resource.quark_url = row.quark_url;
  }

  if (row.channel_id) {
    resource.channel_id = row.channel_id;
  }

  if (row.category_id) {
    resource.category_id = row.category_id;
  }

  if (row.extract_code) {
    resource.extract_code = row.extract_code;
  }

  if (row.meta) {
    try {
      resource.meta = typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta;
    } catch { /* ignore */ }
  }

  return resource;
}

async function loadTagsForResourceIds(resourceIds: string[]) {
  const tagsByResourceId = new Map<string, string[]>();
  if (resourceIds.length === 0) {
    return tagsByResourceId;
  }

  const placeholders = resourceIds.map(() => "?").join(", ");
  const rows = await queryRows<TagRow>(
    `SELECT resource_id, tag_name, tag_slug
     FROM resource_tags
     WHERE resource_id IN (${placeholders})
     ORDER BY resource_id, sort_order ASC, tag_name ASC`,
    resourceIds
  );

  for (const row of rows) {
    const list = tagsByResourceId.get(row.resource_id) || [];
    list.push(row.tag_name);
    tagsByResourceId.set(row.resource_id, list);
  }

  return tagsByResourceId;
}

async function loadTopicIdsForResourceIds(resourceIds: string[]) {
  const topicIdsByResourceId = new Map<string, string[]>();
  if (resourceIds.length === 0) {
    return topicIdsByResourceId;
  }

  const placeholders = resourceIds.map(() => "?").join(", ");
  const rows = await queryRows<ResourceTopicRow>(
    `SELECT resource_id, topic_id
     FROM resource_topics
     WHERE resource_id IN (${placeholders})
     ORDER BY resource_id, topic_id`,
    resourceIds
  );

  for (const row of rows) {
    const list = topicIdsByResourceId.get(row.resource_id) || [];
    list.push(row.topic_id);
    topicIdsByResourceId.set(row.resource_id, list);
  }

  return topicIdsByResourceId;
}

async function hydrateResources(rows: ResourceRow[]) {
  const resourceIds = rows.map((row) => row.id);
  const [tagsByResourceId, topicIdsByResourceId] = await Promise.all([
    loadTagsForResourceIds(resourceIds),
    loadTopicIdsForResourceIds(resourceIds),
  ]);

  return rows.map((row) => mapResourceRow(row, tagsByResourceId, topicIdsByResourceId));
}

async function getResourceRows(whereSql = "", params: unknown[] = []) {
  return queryRows<ResourceRow>(
    `SELECT
      id,
      title,
      slug,
      summary,
      category,
      channel_id,
      category_id,
      cover,
      quark_url,
      extract_code,
      publish_status,
      published_at,
      updated_at,
      meta
     FROM resources
     ${whereSql}
     ORDER BY updated_at DESC`,
    params
  );
}

async function getSingleResource(whereSql: string, params: unknown[]) {
  const rows = await queryRows<ResourceRow>(
    `SELECT
      id,
      title,
      slug,
      summary,
      category,
      channel_id,
      category_id,
      cover,
      quark_url,
      extract_code,
      publish_status,
      published_at,
      updated_at,
      meta
     FROM resources
     ${whereSql}
     ORDER BY updated_at DESC
     LIMIT 1`,
    params
  );
  if (rows.length === 0) {
    return null;
  }

  const resources = await hydrateResources(rows);
  return resources[0] || null;
}

async function upsertResourceRelations(
  connection: PoolConnection,
  resourceId: string,
  tags: string[],
  topicIds: string[]
) {
  await connection.execute(`DELETE FROM resource_tags WHERE resource_id = ?`, [resourceId]);
  await connection.execute(`DELETE FROM resource_topics WHERE resource_id = ?`, [resourceId]);

  for (const [index, tag] of tags.entries()) {
    await connection.execute(
      `INSERT INTO resource_tags (resource_id, tag_name, tag_slug, sort_order)
       VALUES (?, ?, ?, ?)`,
      [resourceId, tag, slugify(tag), index]
    );
  }

  for (const topicId of topicIds) {
    await connection.execute(
      `INSERT INTO resource_topics (resource_id, topic_id)
       VALUES (?, ?)`,
      [resourceId, topicId]
    );
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isValidHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function getAllResources() {
  const rows = await getResourceRows();
  return hydrateResources(rows);
}

export async function getPublishedResources() {
  const rows = await getResourceRows(`WHERE publish_status = ?`, ["published"]);
  return hydrateResources(rows);
}

export async function getResourceBySlug(slug: string) {
  return getSingleResource(`WHERE slug = ?`, [slug]);
}

export async function getResourceById(id: string) {
  return getSingleResource(`WHERE id = ?`, [id]);
}

export async function saveResource(
  input: Omit<Resource, "id" | "updated_at"> & { id?: string }
) {
  const slug = slugify(input.slug || input.title);
  const now = new Date();
  const id = input.id || `res_${Date.now().toString(36)}`;
  const topicIds = Array.from(new Set((input.topic_ids || []).filter(Boolean)));
  const tags = Array.from(new Set((input.tags || []).map((tag) => tag.trim()).filter(Boolean)));

  await withTransaction(async (connection) => {
    const [duplicates] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM resources WHERE slug = ? AND id <> ? LIMIT 1`,
      [slug, id]
    );

    if (duplicates.length > 0) {
      throw new Error("slug 已存在");
    }

    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM resources WHERE id = ? LIMIT 1`,
      [id]
    );

    const payload = [
      id,
      input.title,
      slug,
      input.summary,
      input.category,
      input.channel_id || null,
      input.category_id || null,
      input.cover,
      input.quark_url || null,
      input.extract_code || null,
      input.publish_status,
      toSqlDateTime(input.published_at),
      toSqlDateTime(now),
      input.meta ? JSON.stringify(input.meta) : null,
    ];

    if (existingRows.length > 0) {
      await connection.execute(
        `UPDATE resources SET
          title = ?,
          slug = ?,
          summary = ?,
          category = ?,
          channel_id = ?,
          category_id = ?,
          cover = ?,
          quark_url = ?,
          extract_code = ?,
          publish_status = ?,
          published_at = ?,
          updated_at = ?,
          meta = ?
         WHERE id = ?`,
        [
          input.title,
          slug,
          input.summary,
          input.category,
          input.channel_id || null,
          input.category_id || null,
          input.cover,
          input.quark_url || null,
          input.extract_code || null,
          input.publish_status,
          toSqlDateTime(input.published_at),
          toSqlDateTime(now),
          input.meta ? JSON.stringify(input.meta) : null,
          id,
        ]
      );
    } else {
      await connection.execute(
        `INSERT INTO resources (
          id, title, slug, summary, category, channel_id, category_id, cover, quark_url,
          extract_code, publish_status, published_at, updated_at, meta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        payload
      );
    }

    await upsertResourceRelations(connection, id, tags, topicIds);
  });

  const resource = await getResourceById(id);
  if (!resource) {
    throw new Error("保存失败");
  }
  return resource;
}

export async function deleteResource(id: string) {
  await execute(`DELETE FROM resources WHERE id = ?`, [id]);
}

export async function markResourceStatus(id: string, status: PublishStatus) {
  const resource = await getResourceById(id);
  if (!resource) {
    throw new Error("资源不存在");
  }

  return saveResource({
    ...resource,
    id,
    publish_status: status,
  });
}

export async function importResourcesFromCsv(
  csv: string,
  mode: "insert" | "upsert"
): Promise<CsvImportResult> {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    throw new Error("CSV 内容为空");
  }

  const header = parseCsvLine(rows[0]);
  const requiredHeaders = [
    "title",
    "slug",
    "summary",
    "category",
    "tags",
    "publish_status",
    "published_at",
  ];

  const missingHeaders = requiredHeaders.filter((name) => !header.includes(name));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 缺少字段: ${missingHeaders.join(", ")}`);
  }

  let successCount = 0;
  const failures: CsvImportResult["failures"] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    const values = parseCsvLine(rows[i]);
    const record = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));

    try {
      if (!record.title || !record.slug || !record.summary || !record.category) {
        throw new Error("必填字段不能为空");
      }
      if (record.quark_url && !isValidHttpUrl(record.quark_url)) {
        throw new Error("夸克链接格式不正确");
      }

      const normalizedTags = record.tags
        .split(/[|,，]/)
        .map((tag: string) => tag.trim())
        .filter(Boolean);

      const existing = await getSingleResource(`WHERE slug = ?`, [slugify(record.slug)]);
      if (mode === "insert" && existing) {
        throw new Error("slug 已存在，insert 模式不允许覆盖");
      }

      await saveResource({
        id: existing?.id,
        title: record.title,
        slug: record.slug,
        summary: record.summary,
        category: record.category,
        channel_id: existing?.channel_id,
        category_id: existing?.category_id,
        topic_ids: existing?.topic_ids || [],
        tags: normalizedTags,
        cover: existing?.cover || "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80",
        ...(record.quark_url ? { quark_url: record.quark_url } : {}),
        extract_code: record.extract_code,
        publish_status: (record.publish_status || "draft") as PublishStatus,
        published_at: record.published_at || new Date().toISOString(),
      });
      successCount += 1;
    } catch (error) {
      failures.push({
        row: rowNumber,
        reason: error instanceof Error ? error.message : "导入失败",
      });
    }
  }

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
}

export async function recordEvent(
  event: Omit<TrackEvent, "event_time"> & { event_time?: string }
) {
  const normalizedEvent: TrackEvent = {
    ...event,
    event_time: event.event_time || new Date().toISOString(),
  };

  await execute(
    `INSERT INTO track_events (
      name, event_time, session_id, anon_user_id, query_text, resource_id, result_rank,
      result_count, from_page, referer, device, ua
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedEvent.name,
      toSqlDateTime(normalizedEvent.event_time),
      normalizedEvent.session_id || null,
      normalizedEvent.anon_user_id || null,
      normalizedEvent.query || null,
      normalizedEvent.resource_id || null,
      normalizedEvent.result_rank ?? null,
      normalizedEvent.result_count ?? null,
      normalizedEvent.from_page || null,
      normalizedEvent.referer || null,
      normalizedEvent.device || null,
      normalizedEvent.ua || null,
    ]
  );

  return normalizedEvent;
}

export async function getAnalyticsSummary() {
  const rows = await queryRows<EventRow>(
    `SELECT name, event_time, session_id, anon_user_id, query_text, resource_id, result_rank,
            result_count, from_page, referer, device, ua
     FROM track_events
     ORDER BY event_time DESC`
  );

  return summarizeEvents(
    rows.map((row) => ({
      name: row.name,
      event_time: toIsoString(row.event_time),
      session_id: row.session_id || undefined,
      anon_user_id: row.anon_user_id || undefined,
      query: row.query_text || undefined,
      resource_id: row.resource_id || undefined,
      result_rank: row.result_rank ?? undefined,
      result_count: row.result_count ?? undefined,
      from_page: row.from_page || undefined,
      referer: row.referer || undefined,
      device: row.device || undefined,
      ua: row.ua || undefined,
    }))
  );
}

export async function getCategoryMap() {
  const [categories, publishedResources] = await Promise.all([
    getContentStructure(),
    getPublishedResources(),
  ]);
  const counts = new Map<string, number>();

  for (const resource of publishedResources) {
    if (!resource.category_id) {
      continue;
    }
    counts.set(resource.category_id, (counts.get(resource.category_id) || 0) + 1);
  }

  return categories.categories
    .filter((category) => category.status === "active")
    .map((category) => ({
      name: category.name,
      slug: category.slug,
      count: counts.get(category.id) || 0,
    }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

export async function getTagMap(resources?: Resource[]) {
  const resourceList = resources || (await getPublishedResources());
  const map = new Map<string, { name: string; slug: string; count: number }>();

  for (const resource of resourceList) {
    for (const tag of resource.tags) {
      const slug = slugify(tag);
      const entry = map.get(slug);
      if (entry) {
        entry.count += 1;
      } else {
        map.set(slug, { name: tag, slug, count: 1 });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

export async function getResourcesByCategorySlug(slug: string) {
  const structure = await getContentStructure();
  const category = structure.categories.find((item) => item.slug === slug && item.status === "active");
  const publishedResources = await getPublishedResources();

  if (category) {
    return publishedResources.filter((resource) => resource.category_id === category.id);
  }

  return publishedResources.filter((resource) => slugify(resource.category) === slug);
}

export async function getResourcesByTagSlug(slug: string) {
  const rows = await queryRows<RowDataPacket & { resource_id: string }>(
    `SELECT resource_id FROM resource_tags WHERE tag_slug = ? ORDER BY sort_order ASC`,
    [slug]
  );
  if (rows.length === 0) {
    return [];
  }

  const resources = await getPublishedResources();
  const resourceIds = new Set(rows.map((row) => row.resource_id));
  return resources.filter((resource) => resourceIds.has(resource.id));
}

export async function runSearch(query: string, page = 1, pageSize?: number): Promise<SearchResponse> {
  const publishedResources = await getPublishedResources();
  return searchResources(publishedResources, query, page, pageSize);
}

export async function getContentStructure(): Promise<ContentStructure> {
  const [siteProfileRows, channelRows, categoryRows, topicRows] = await Promise.all([
    queryRows<SiteProfileRow>(
      `SELECT name, tagline, short_link, positioning, featured_message, hot_searches, featured_channels, hot_tags
       FROM site_profile WHERE id = 1 LIMIT 1`
    ),
    queryRows<ChannelRow>(
      `SELECT id, name, slug, description, sort_order, featured, status
       FROM channels
       ORDER BY featured DESC, sort_order ASC, name ASC`
    ),
    queryRows<CategoryRow>(
      `SELECT id, channel_id, parent_id, name, slug, description, sort_order, featured, show_on_home, status
       FROM categories
       ORDER BY show_on_home DESC, channel_id ASC, featured DESC, sort_order ASC, name ASC`
    ),
    queryRows<TopicRow>(
      `SELECT id, category_id, name, slug, summary, download_url, sort_order, featured, status, field_schema
       FROM topics
       ORDER BY category_id ASC, featured DESC, sort_order ASC, name ASC`
    ),
  ]);

  const siteProfile = siteProfileRows[0];

  return {
    site_profile: {
      name: siteProfile?.name || "夸克网盘资料",
      tagline: siteProfile?.tagline || "搜索优先的夸克网盘资料",
      short_link: siteProfile?.short_link || "",
      positioning: siteProfile?.positioning || "通过数据库驱动频道、栏目、专题和资源。",
      ...(siteProfile?.featured_message ? { featured_message: siteProfile.featured_message } : {}),
      ...(siteProfile?.hot_searches ? { hot_searches: parseHotSearches(siteProfile.hot_searches) } : {}),
      ...(siteProfile?.featured_channels ? { featured_channels: parseJsonArray(siteProfile.featured_channels) } : {}),
      ...(siteProfile?.hot_tags ? { hot_tags: parseJsonArray(siteProfile.hot_tags) } : {}),
    },
    channels: channelRows.map<Channel>((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sort: row.sort_order,
      featured: Boolean(row.featured),
      status: row.status,
    })),
    categories: categoryRows.map<CategoryNode>((row) => ({
      id: row.id,
      channel_id: row.channel_id,
      ...(row.parent_id ? { parent_id: row.parent_id } : {}),
      name: row.name,
      slug: row.slug,
      description: row.description,
      sort: row.sort_order,
      featured: Boolean(row.featured),
      show_on_home: Boolean(row.show_on_home),
      status: row.status,
    })),
    topics: topicRows.map<TopicNode>((row) => ({
      id: row.id,
      category_id: row.category_id,
      name: row.name,
      slug: row.slug,
      summary: row.summary,
      ...(row.download_url ? { download_url: row.download_url } : {}),
      sort: row.sort_order,
      featured: Boolean(row.featured),
      status: row.status,
      ...(row.field_schema ? { field_schema: typeof row.field_schema === "string" ? JSON.parse(row.field_schema) : row.field_schema } : {}),
    })),
  };
}

export async function saveSiteProfile(input: {
  name: string;
  tagline: string;
  short_link: string;
  positioning: string;
  featured_message?: string;
  hot_searches?: string[];
  featured_channels?: string[];
  hot_tags?: string[];
}) {
  await execute(
    `UPDATE site_profile
     SET name = ?, tagline = ?, short_link = ?, positioning = ?, featured_message = ?,
         hot_searches = ?, featured_channels = ?, hot_tags = ?
     WHERE id = 1`,
    [
      input.name,
      input.tagline,
      input.short_link,
      input.positioning,
      input.featured_message || null,
      input.hot_searches && input.hot_searches.length > 0 ? JSON.stringify(input.hot_searches) : null,
      input.featured_channels && input.featured_channels.length > 0 ? JSON.stringify(input.featured_channels) : null,
      input.hot_tags && input.hot_tags.length > 0 ? JSON.stringify(input.hot_tags) : null,
    ]
  );

  const structure = await getContentStructure();
  return structure.site_profile;
}

export async function getFeaturedChannels() {
  const structure = await getContentStructure();
  return structure.channels.filter((channel) => channel.status === "active" && channel.featured);
}

export async function getFeaturedTopics() {
  const structure = await getContentStructure();
  return structure.topics.filter((topic) => topic.status === "active" && topic.featured);
}

export async function getTopicBySlug(slug: string) {
  const rows = await queryRows<TopicRow>(
    `SELECT id, category_id, name, slug, summary, download_url, sort_order, featured, status, field_schema
     FROM topics WHERE slug = ? AND status = 'active' LIMIT 1`,
    [slug]
  );
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    ...(row.download_url ? { download_url: row.download_url } : {}),
    sort: row.sort_order,
    featured: Boolean(row.featured),
    status: row.status,
    ...(row.field_schema ? { field_schema: typeof row.field_schema === "string" ? JSON.parse(row.field_schema) : row.field_schema } : {}),
  } as TopicNode;
}

export async function getResolvedDownloadUrlForResource(resource: Pick<Resource, "quark_url" | "topic_ids">) {
  if (resource.quark_url) {
    return resource.quark_url;
  }

  const firstTopicId = resource.topic_ids?.find(Boolean);
  if (!firstTopicId) {
    return null;
  }

  const rows = await queryRows<Pick<TopicRow, "download_url"> & RowDataPacket>(
    `SELECT download_url FROM topics WHERE id = ? LIMIT 1`,
    [firstTopicId]
  );

  return rows[0]?.download_url || null;
}

export async function getResourcesByChannelId(channelId: string) {
  const resources = await getPublishedResources();
  return resources.filter((resource) => resource.channel_id === channelId);
}

export async function getResourcesByCategoryId(categoryId: string) {
  const resources = await getPublishedResources();
  return resources.filter((resource) => resource.category_id === categoryId);
}

export async function getResourcesByTopicId(topicId: string) {
  const resources = await getPublishedResources();
  return resources.filter((resource) => resource.topic_ids?.includes(topicId));
}

export async function getContentStructureTree() {
  const [structure, publishedResources] = await Promise.all([
    getContentStructure(),
    getPublishedResources(),
  ]);

  return structure.channels
    .filter((channel) => channel.status === "active")
    .map((channel) => ({
      ...channel,
      resources: publishedResources.filter((resource) => resource.channel_id === channel.id),
      categories: structure.categories
        .filter((category) => category.channel_id === channel.id && category.status === "active")
        .map((category) => ({
          ...category,
          resources: publishedResources.filter((resource) => resource.category_id === category.id),
          topics: structure.topics
            .filter((topic) => topic.category_id === category.id && topic.status === "active")
            .map((topic) => ({
              ...topic,
              resources: publishedResources.filter((resource) => resource.topic_ids?.includes(topic.id)),
            })),
        })),
    }));
}

export async function getFeedback(): Promise<Feedback[]> {
  const rows = await queryRows<FeedbackRow>(
    `SELECT id, resource_id, resource_title, resource_slug, reason, note, created_at, resolved
     FROM feedback
     ORDER BY created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    resource_id: row.resource_id,
    resource_title: row.resource_title,
    resource_slug: row.resource_slug,
    reason: row.reason,
    ...(row.note ? { note: row.note } : {}),
    created_at: toIsoString(row.created_at),
    resolved: Boolean(row.resolved),
  }));
}

export async function recordFeedback(
  input: Omit<Feedback, "id" | "created_at" | "resolved">
) {
  const feedback: Feedback = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    resolved: false,
  };

  await execute(
    `INSERT INTO feedback (
      id, resource_id, resource_title, resource_slug, reason, note, created_at, resolved
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      feedback.id,
      feedback.resource_id,
      feedback.resource_title,
      feedback.resource_slug,
      feedback.reason,
      feedback.note || null,
      toSqlDateTime(feedback.created_at),
      feedback.resolved ? 1 : 0,
    ]
  );

  return feedback;
}

export async function resolveFeedback(id: string) {
  await execute(`UPDATE feedback SET resolved = 1 WHERE id = ?`, [id]);
}

// ─── Structure CRUD ────────────────────────────────────────────────────────

export async function saveChannel(input: {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sort_order?: number;
  featured?: boolean;
  status?: "active" | "hidden";
}): Promise<Channel> {
  const id = input.id || `channel_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const sort_order = input.sort_order ?? 0;
  const featured = input.featured ? 1 : 0;
  const status = input.status ?? "active";

  await execute(
    `INSERT INTO channels (id, name, slug, description, sort_order, featured, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       slug = VALUES(slug),
       description = VALUES(description),
       sort_order = VALUES(sort_order),
       featured = VALUES(featured),
       status = VALUES(status)`,
    [id, input.name, input.slug, input.description, sort_order, featured, status]
  );
  return { id, name: input.name, slug: input.slug, description: input.description, sort: sort_order, featured: Boolean(featured), status };
}

export async function deleteChannel(id: string) {
  await execute(`DELETE FROM channels WHERE id = ?`, [id]);
}

export async function saveCategory(input: {
  id?: string;
  channel_id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description: string;
  sort_order?: number;
  featured?: boolean;
  show_on_home?: boolean;
  status?: "active" | "hidden";
}): Promise<CategoryNode> {
  const id = input.id || `cat_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const sort_order = input.sort_order ?? 0;
  const featured = input.featured ? 1 : 0;
  const show_on_home = input.show_on_home ? 1 : 0;
  const status = input.status ?? "active";
  const parent_id = input.parent_id || null;

  await execute(
    `INSERT INTO categories (id, channel_id, parent_id, name, slug, description, sort_order, featured, show_on_home, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       channel_id = VALUES(channel_id),
       parent_id = VALUES(parent_id),
       name = VALUES(name),
       slug = VALUES(slug),
       description = VALUES(description),
       sort_order = VALUES(sort_order),
       featured = VALUES(featured),
       show_on_home = VALUES(show_on_home),
       status = VALUES(status)`,
    [id, input.channel_id, parent_id, input.name, input.slug, input.description, sort_order, featured, show_on_home, status]
  );
  return {
    id,
    channel_id: input.channel_id,
    parent_id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    sort: sort_order,
    featured: Boolean(featured),
    show_on_home: Boolean(show_on_home),
    status
  };
}

export async function deleteCategory(id: string) {
  await execute(`DELETE FROM categories WHERE id = ?`, [id]);
}

export async function saveTopic(input: {
  id?: string;
  category_id: string;
  name: string;
  slug: string;
  summary: string;
  download_url?: string;
  sort_order?: number;
  featured?: boolean;
  status?: "active" | "hidden";
  field_schema?: unknown;
}): Promise<TopicNode> {
  const id = input.id || `topic_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const sort_order = input.sort_order ?? 0;
  const featured = input.featured ? 1 : 0;
  const status = input.status ?? "active";
  const fieldSchemaJson = input.field_schema ? JSON.stringify(input.field_schema) : null;

  await execute(
    `INSERT INTO topics (id, category_id, name, slug, summary, download_url, sort_order, featured, status, field_schema)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       category_id = VALUES(category_id),
       name = VALUES(name),
       slug = VALUES(slug),
       summary = VALUES(summary),
       download_url = VALUES(download_url),
       sort_order = VALUES(sort_order),
       featured = VALUES(featured),
       status = VALUES(status),
       field_schema = VALUES(field_schema)`,
    [id, input.category_id, input.name, input.slug, input.summary || "", input.download_url || null, sort_order, featured, status, fieldSchemaJson]
  );
  return {
    id,
    category_id: input.category_id,
    name: input.name,
    slug: input.slug,
    summary: input.summary,
    ...(input.download_url ? { download_url: input.download_url } : {}),
    sort: sort_order,
    featured: Boolean(featured),
    status,
  };
}

export async function deleteTopic(id: string) {
  await execute(`DELETE FROM topics WHERE id = ?`, [id]);
}
