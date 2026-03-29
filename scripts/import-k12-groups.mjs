import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

const SHOULD_EXECUTE = process.argv.includes("--execute");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1], 10) : 50;
const PREVIEW_PATH = path.join(process.cwd(), "data", "k12-group-migration-preview.json");

const DEFAULT_CHANNEL_ID = process.env.K12_CHANNEL_ID || "channel_k12";
const DEFAULT_CATEGORY_ID = process.env.K12_CATEGORY_ID || "cat_k12";
const DEFAULT_CATEGORY_NAME = process.env.K12_CATEGORY_NAME || "中小学资料";
const DEFAULT_CATEGORY_SLUG = process.env.K12_CATEGORY_SLUG || "k12";
const DEFAULT_CHANNEL_SLUG = process.env.K12_CHANNEL_SLUG || "education-exam";
const DEFAULT_COVER =
  process.env.K12_DEFAULT_COVER ||
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80";
const DEFAULT_STAGE_TOPICS = [
  {
    id: "topic_primary_school_zone",
    name: "小学专区",
    slug: "primary-school-zone",
    summary: "小学同步资料、知识清单、专项练习与打印资料汇总。",
  },
  {
    id: "topic_middle_school_zone",
    name: "初中专区",
    slug: "middle-school-zone",
    summary: "初中同步资料、专项练习、中考相关资源与阶段复习资料汇总。",
  },
  {
    id: "topic_high_school_zone",
    name: "高中专区",
    slug: "high-school-zone",
    summary: "高中同步资料、高考相关资源与阶段复习资料汇总。",
  },
];
const GRADE_MAP = new Map([
  [1, "一年级"],
  [2, "二年级"],
  [3, "三年级"],
  [4, "四年级"],
  [5, "五年级"],
  [6, "六年级"],
  [7, "七年级"],
  [8, "八年级"],
  [9, "九年级"],
]);
const SUBJECT_MAP = new Map([
  ["math", "数学"],
  ["english", "英语"],
  ["chinese", "语文"],
  ["biology", "生物"],
  ["physics", "物理"],
  ["geography", "地理"],
  ["chemistry", "化学"],
  ["politics", "道法"],
  ["history", "历史"],
  ["science", "科学"],
]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stableId(prefix, input) {
  return `${prefix}_${createHash("sha1").update(String(input)).digest("hex").slice(0, 16)}`;
}

function stableSuffix(input, length = 8) {
  return createHash("sha1").update(String(input)).digest("hex").slice(0, length);
}

function normalizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function inferStage(pathText = "") {
  if (/中考/.test(pathText)) return "中考专区";
  if (/小升初|六升七/.test(pathText)) return "小升初/六升七";
  if (/字帖|口算|看图写话/.test(pathText)) return "打印资料";
  if (/^[一二三四五六]年级/.test(pathText)) return "小学资料";
  if (/^[七八九]年级|中国历史|世界历史|化学（五四制|历史与社会|人文地理/.test(pathText)) return "初中资料";
  return DEFAULT_CATEGORY_NAME;
}

function inferGrade(pathText = "", fallback) {
  const match = pathText.match(/([一二三四五六七八九])年级/);
  if (match) return `${match[1]}年级`;
  if (Number.isInteger(fallback) && GRADE_MAP.has(fallback)) {
    return GRADE_MAP.get(fallback);
  }
  return "";
}

function normalizeSubject(value) {
  const normalized = normalizeText(value);
  return SUBJECT_MAP.get(normalized) || normalized;
}

function mapType(type) {
  const map = new Map([
    ["one_lesson_one_practice", "一课一练"],
    ["unit_test", "单元测试"],
    ["monthly_exam", "月考"],
    ["midterm", "期中"],
    ["final", "期末"],
    ["knowledge_summary", "知识总结"],
    ["comprehensive_test", "综合测试"],
    ["advanced", "专项提升"],
    ["preview", "预习导学"],
  ]);
  return map.get(type) || type || "";
}

function chooseSummary(group, items) {
  if (group.description && group.description.trim()) {
    return group.description.trim();
  }

  const typeSet = new Set(items.map((item) => mapType(item.type)).filter(Boolean));
  const subjectSet = new Set(items.map((item) => normalizeSubject(item.subject)).filter(Boolean));
  const editionSet = new Set(items.map((item) => item.edition).filter(Boolean));

  const typeText = [...typeSet].slice(0, 4).join("、");
  const subjectText = [...subjectSet].slice(0, 3).join("、");
  const editionText = [...editionSet].slice(0, 3).join("、");

  return [
    `${group.name}资料包`,
    subjectText ? `涵盖${subjectText}` : "",
    typeText ? `包含${typeText}` : "",
    editionText ? `适配${editionText}` : "",
    items.length ? `共整理 ${items.length} 份资料` : "",
  ]
    .filter(Boolean)
    .join("，");
}

function extractCodeFromUrl(url = "") {
  const match = String(url).match(/(?:pwd|code|提取码)[=:：\s]*([A-Za-z0-9]+)/i);
  return match ? match[1] : null;
}

function collectTags(group, items, tagsByResourceId) {
  const tagMap = new Map();
  const pushTag = (value) => {
    const name = normalizeText(value);
    if (!name) return;
    const key = slugify(name);
    if (!key) return;
    if (!tagMap.has(key)) {
      tagMap.set(key, name);
    }
  };

  pushTag(inferStage(group.path));

  for (const item of items) {
    pushTag(mapType(item.type));
    pushTag(normalizeSubject(item.subject));
    pushTag(item.edition);
    const gradeLabel = inferGrade(group.path, item.grade);
    if (gradeLabel) {
      pushTag(gradeLabel);
    }

    for (const tag of tagsByResourceId.get(item.id) || []) {
      pushTag(tag);
    }
  }

  return Array.from(tagMap.entries()).map(([slug, name], sortOrder) => ({
    tag_name: name,
    tag_slug: slug,
    sort_order: sortOrder,
  }));
}

function resolveStageCategoryId(stage, categoryMapping) {
  if (stage === "小学资料" || stage === "小升初/六升七" || stage === "打印资料") {
    return categoryMapping.primaryCategoryId || categoryMapping.categoryId;
  }
  if (stage === "初中资料" || stage === "中考专区") {
    return categoryMapping.middleCategoryId || categoryMapping.categoryId;
  }
  if (stage === "高中资料") {
    return categoryMapping.highCategoryId || categoryMapping.categoryId;
  }
  return categoryMapping.categoryId;
}

function resolveStageTopicIds(stage, topicMapping) {
  const topicIds = [];
  if (stage === "小学资料" || stage === "小升初/六升七" || stage === "打印资料") {
    if (topicMapping.primaryTopicId) topicIds.push(topicMapping.primaryTopicId);
  }
  if (stage === "初中资料" || stage === "中考专区") {
    if (topicMapping.middleTopicId) topicIds.push(topicMapping.middleTopicId);
  }
  if (stage === "高中资料") {
    if (topicMapping.highTopicId) topicIds.push(topicMapping.highTopicId);
  }
  if (stage === "中考专区" && topicMapping.zhongkaoTopicId) {
    topicIds.push(topicMapping.zhongkaoTopicId);
  }
  if (stage === "高考专区" && topicMapping.gaokaoTopicId) {
    topicIds.push(topicMapping.gaokaoTopicId);
  }
  return Array.from(new Set(topicIds));
}

function mapGroupToResource(group, items, tags, categoryMapping) {
  const resourceId = stableId("k12grp", group.id);
  const quarkUrl = group.download_url || null;
  const extractCode = group.pan_code || extractCodeFromUrl(group.download_url || "");
  const contentKinds = Array.from(new Set(items.map((item) => mapType(item.type)).filter(Boolean)));
  const subjects = Array.from(new Set(items.map((item) => normalizeSubject(item.subject)).filter(Boolean)));
  const editions = Array.from(new Set(items.map((item) => item.edition).filter(Boolean)));
  const years = Array.from(new Set(items.map((item) => item.year).filter(Boolean))).sort();
  const slugBase = slugify(group.name) || resourceId;
  const stage = inferStage(group.path);

  return {
    id: resourceId,
    title: group.name,
    slug: `${slugBase}-${stableSuffix(group.id)}`,
    summary: chooseSummary(group, items),
    category: stage,
    channel_id: categoryMapping.channelId,
    category_id: resolveStageCategoryId(stage, categoryMapping),
    cover: DEFAULT_COVER,
    quark_url: quarkUrl,
    extract_code: extractCode,
    publish_status: quarkUrl ? "published" : "draft",
    published_at: group.created_at || group.updated_at || new Date().toISOString(),
    updated_at: group.updated_at || group.created_at || new Date().toISOString(),
    meta: {
      source_group_id: group.id,
      source_group_path: group.path,
      source_pan_type: group.pan_type,
      source_pan_code: group.pan_code,
      item_count: items.length,
      subjects,
      editions,
      years: years.map(String),
      content_kinds: contentKinds,
      tags: tags.map((item) => item.tag_name),
    },
    tags,
  };
}

function mapItemToResourceItem(parentResourceId, item, sortOrder) {
  const fileExtMatch = item.title.match(/\.([A-Za-z0-9]+)$/);
  return {
    id: stableId("k12item", item.id),
    parent_resource_id: parentResourceId,
    source_resource_id: item.id,
    title: item.title,
    slug: slugify(item.title),
    description: item.description || null,
    file_type: item.type || null,
    file_ext: fileExtMatch ? fileExtMatch[1].toLowerCase() : null,
    sort_order: sortOrder,
    grade: item.grade || null,
    subject: normalizeSubject(item.subject) || null,
    resource_type: item.type || null,
    edition: item.edition || null,
    region: item.region || null,
    year: item.year || null,
    has_answer: item.has_answer ? 1 : 0,
    source_pan_type: item.pan_type || null,
    source_pan_url: item.pan_url || null,
  };
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

async function resolveTargetCategoryMapping(connection) {
  const [categoryRows] = await connection.query(
    `
      SELECT c.id, c.channel_id
      FROM categories c
      WHERE c.id = ? OR c.slug = ? OR c.name IN (?, ?)
      ORDER BY
        CASE
          WHEN c.id = ? THEN 0
          WHEN c.slug = ? THEN 1
          WHEN c.name = ? THEN 2
          ELSE 3
        END
      LIMIT 1
    `,
    [
      DEFAULT_CATEGORY_ID,
      DEFAULT_CATEGORY_SLUG,
      DEFAULT_CATEGORY_NAME,
      "中小学",
      DEFAULT_CATEGORY_ID,
      DEFAULT_CATEGORY_SLUG,
      DEFAULT_CATEGORY_NAME,
    ]
  );

  if (categoryRows.length > 0) {
    const rootCategoryId = categoryRows[0].id;
    const [childRows] = await connection.query(
      `
        SELECT id, slug
        FROM categories
        WHERE parent_id = ? OR slug IN ('primary-school', 'middle-school', 'high-school')
      `,
      [rootCategoryId]
    );
    const childMap = new Map(childRows.map((row) => [row.slug, row.id]));
    return {
      channelId: categoryRows[0].channel_id,
      categoryId: rootCategoryId,
      primaryCategoryId: childMap.get("primary-school") || null,
      middleCategoryId: childMap.get("middle-school") || null,
      highCategoryId: childMap.get("high-school") || null,
    };
  }

  const [channelRows] = await connection.query(
    `
      SELECT id
      FROM channels
      WHERE id = ? OR slug = ?
      ORDER BY CASE WHEN id = ? THEN 0 WHEN slug = ? THEN 1 ELSE 2 END
      LIMIT 1
    `,
    [DEFAULT_CHANNEL_ID, DEFAULT_CHANNEL_SLUG, DEFAULT_CHANNEL_ID, DEFAULT_CHANNEL_SLUG]
  );

  const channelId = channelRows[0]?.id || DEFAULT_CHANNEL_ID;
  if (channelRows.length === 0) {
    await connection.execute(
      `
        INSERT INTO channels (id, name, slug, description, sort_order, featured, status)
        VALUES (?, ?, ?, ?, ?, 0, 'active')
      `,
      [channelId, "教育考试", DEFAULT_CHANNEL_SLUG, "教育考试与中小学资料频道", 30]
    );
  }

  await connection.execute(
    `
      INSERT INTO categories (id, channel_id, parent_id, name, slug, description, sort_order, featured, status, show_on_home)
      VALUES (?, ?, NULL, ?, ?, ?, ?, 0, 'active', 0)
    `,
    [DEFAULT_CATEGORY_ID, channelId, "中小学", DEFAULT_CATEGORY_SLUG, "中小学学习资料与试卷资源", 30]
  );

  return {
    channelId,
    categoryId: DEFAULT_CATEGORY_ID,
    primaryCategoryId: null,
    middleCategoryId: null,
    highCategoryId: null,
  };
}

const sourceConnection = await mysql.createConnection({
  host: process.env.SOURCE_DB_HOST || "127.0.0.1",
  port: Number.parseInt(process.env.SOURCE_DB_PORT || "3306", 10),
  user: process.env.SOURCE_DB_USER || "root",
  password: process.env.SOURCE_DB_PASSWORD || "Han123456",
  database: process.env.SOURCE_DB_NAME || "k12_platform",
  charset: "utf8mb4",
  timezone: "Z",
});
let targetConnection = null;
let categoryMapping = {
  channelId: DEFAULT_CHANNEL_ID,
  categoryId: DEFAULT_CATEGORY_ID,
  primaryCategoryId: null,
  middleCategoryId: null,
  highCategoryId: null,
};
let topicMapping = {
  primaryTopicId: null,
  middleTopicId: null,
  highTopicId: null,
  zhongkaoTopicId: null,
  gaokaoTopicId: null,
};

async function resolveTargetTopicMapping(connection, categoryId) {
  const [existingRows] = await connection.query(
    `
      SELECT id, slug
      FROM topics
      WHERE category_id = ?
         OR slug IN ('zhongkaozhenti', 'gaokaozhenti', 'primary-school-zone', 'middle-school-zone', 'high-school-zone')
    `,
    [categoryId]
  );

  const slugToId = new Map(existingRows.map((row) => [row.slug, row.id]));
  for (const topic of DEFAULT_STAGE_TOPICS) {
    if (!slugToId.has(topic.slug)) {
      await connection.execute(
        `
          INSERT INTO topics (id, category_id, name, slug, summary, download_url, sort_order, featured, show_on_home, status, field_schema)
          VALUES (?, ?, ?, ?, ?, NULL, 20, 1, 0, 'active', NULL)
        `,
        [topic.id, categoryId, topic.name, topic.slug, topic.summary]
      );
      slugToId.set(topic.slug, topic.id);
    }
  }

  return {
    primaryTopicId: slugToId.get("primary-school-zone") || null,
    middleTopicId: slugToId.get("middle-school-zone") || null,
    highTopicId: slugToId.get("high-school-zone") || null,
    zhongkaoTopicId: slugToId.get("zhongkaozhenti") || null,
    gaokaoTopicId: slugToId.get("gaokaozhenti") || null,
  };
}

try {
  const [[counts]] = await sourceConnection.query(`
    SELECT
      (SELECT COUNT(*) FROM resource_groups) AS groups_total,
      (SELECT COUNT(*) FROM resource_groups WHERE download_url IS NOT NULL AND download_url <> '') AS groups_with_download,
      (SELECT COUNT(*) FROM resources) AS resources_total,
      (SELECT COUNT(*) FROM resources WHERE group_id IS NOT NULL) AS resources_with_group
  `);

  const [groupRows] = await sourceConnection.query(
    `
      SELECT
        g.id,
        g.name,
        g.path,
        g.level,
        g.download_url,
        g.pan_type,
        g.pan_code,
        g.description,
        g.created_at,
        g.updated_at,
        COUNT(r.id) AS item_count
      FROM resource_groups g
      LEFT JOIN resources r ON r.group_id = g.id
      GROUP BY g.id, g.name, g.path, g.level, g.download_url, g.pan_type, g.pan_code, g.description, g.created_at, g.updated_at
      HAVING COUNT(r.id) > 0
      ORDER BY (g.download_url IS NOT NULL AND g.download_url <> '') DESC, COUNT(r.id) DESC, g.path ASC
      LIMIT ?
    `,
    [LIMIT]
  );

  const groupIds = groupRows.map((row) => row.id);
  const [itemRows] = groupIds.length
    ? await sourceConnection.query(
        `
          SELECT
            id, group_id, title, description, grade, subject, type, edition, region, year,
            pan_type, pan_url, pan_code, has_answer, created_at, updated_at
          FROM resources
          WHERE group_id IN (${groupIds.map(() => "?").join(",")})
          ORDER BY group_id ASC, created_at ASC, title ASC
        `,
        groupIds
      )
    : [[]];

  const resourceIds = itemRows.map((row) => row.id);
  const [tagRows] = resourceIds.length
    ? await sourceConnection.query(
        `
          SELECT rt.resource_id, t.name
          FROM resource_tags rt
          INNER JOIN tags t ON t.id = rt.tag_id
          WHERE rt.resource_id IN (${resourceIds.map(() => "?").join(",")})
          ORDER BY rt.resource_id ASC, t.count DESC, t.name ASC
        `,
        resourceIds
      )
    : [[]];

  const itemsByGroupId = new Map();
  for (const item of itemRows) {
    const list = itemsByGroupId.get(item.group_id) || [];
    list.push(item);
    itemsByGroupId.set(item.group_id, list);
  }

  const tagsByResourceId = new Map();
  for (const row of tagRows) {
    const list = tagsByResourceId.get(row.resource_id) || [];
    list.push(row.name);
    tagsByResourceId.set(row.resource_id, list);
  }

  const migrationRows = groupRows.map((group) => {
    const items = itemsByGroupId.get(group.id) || [];
    const tags = collectTags(group, items, tagsByResourceId);
    const resource = mapGroupToResource(group, items, tags, categoryMapping);
    const resourceItems = items.map((item, index) => mapItemToResourceItem(resource.id, item, index));

    return {
      source_group: group,
      target_resource: resource,
      resource_items: resourceItems,
    };
  });

  const preview = migrationRows.map((entry) => ({
    source_group: entry.source_group,
    target_resource: entry.target_resource,
    sample_items: entry.resource_items.slice(0, 12),
  }));

  fs.writeFileSync(
    PREVIEW_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source_counts: counts,
        limit: LIMIT,
        preview,
      },
      null,
      2
    )
  );

  console.log(`K12 migration preview written to ${PREVIEW_PATH}`);
  console.log(`Source counts: ${JSON.stringify(counts)}`);
  console.log(`Preview groups: ${preview.length}`);

  if (!SHOULD_EXECUTE) {
    console.log("Dry-run only. Re-run with --execute after confirming channel/category mapping.");
  } else {
    targetConnection = await mysql.createConnection({
      host: required("DB_HOST"),
      port: Number.parseInt(process.env.DB_PORT || "3306", 10),
      user: required("DB_USER"),
      password: process.env.DB_PASSWORD || "",
      database: required("DB_NAME"),
      charset: "utf8mb4",
      timezone: "Z",
    });

    categoryMapping = await resolveTargetCategoryMapping(targetConnection);
    topicMapping = await resolveTargetTopicMapping(targetConnection, categoryMapping.categoryId);
    for (const entry of migrationRows) {
      entry.target_resource.channel_id = categoryMapping.channelId;
      entry.target_resource.category_id = resolveStageCategoryId(entry.target_resource.category, categoryMapping);
      entry.target_resource.topic_ids = resolveStageTopicIds(entry.target_resource.category, topicMapping);
    }

    await targetConnection.beginTransaction();

    for (const entry of migrationRows) {
      const resource = entry.target_resource;

      await targetConnection.execute(
        `
          INSERT INTO resources (
            id, title, slug, summary, category, channel_id, category_id, cover, quark_url, extract_code,
            publish_status, published_at, updated_at, meta
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            slug = VALUES(slug),
            summary = VALUES(summary),
            category = VALUES(category),
            channel_id = VALUES(channel_id),
            category_id = VALUES(category_id),
            cover = VALUES(cover),
            quark_url = VALUES(quark_url),
            extract_code = VALUES(extract_code),
            publish_status = VALUES(publish_status),
            published_at = VALUES(published_at),
            updated_at = VALUES(updated_at),
            meta = VALUES(meta)
        `,
        [
          resource.id,
          resource.title,
          resource.slug,
          resource.summary,
          resource.category,
          resource.channel_id,
          resource.category_id,
          resource.cover,
          resource.quark_url,
          resource.extract_code,
          resource.publish_status,
          resource.published_at,
          resource.updated_at,
          JSON.stringify(resource.meta),
        ]
      );

      await targetConnection.execute("DELETE FROM resource_tags WHERE resource_id = ?", [resource.id]);
      await targetConnection.execute("DELETE FROM resource_topics WHERE resource_id = ?", [resource.id]);
      await targetConnection.execute("DELETE FROM resource_items WHERE parent_resource_id = ?", [resource.id]);

      for (const tag of resource.tags) {
        await targetConnection.execute(
          `
            INSERT INTO resource_tags (resource_id, tag_name, tag_slug, sort_order)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              tag_name = VALUES(tag_name),
              sort_order = VALUES(sort_order)
          `,
          [resource.id, tag.tag_name, tag.tag_slug, tag.sort_order]
        );
      }

      for (const topicId of resource.topic_ids || []) {
        await targetConnection.execute(
          `
            INSERT INTO resource_topics (resource_id, topic_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE topic_id = VALUES(topic_id)
          `,
          [resource.id, topicId]
        );
      }

      for (const item of entry.resource_items) {
        await targetConnection.execute(
          `
            INSERT INTO resource_items (
              id, parent_resource_id, source_resource_id, title, slug, description, file_type, file_ext,
              sort_order, grade, subject, resource_type, edition, region, year, has_answer,
              source_pan_type, source_pan_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              title = VALUES(title),
              slug = VALUES(slug),
              description = VALUES(description),
              file_type = VALUES(file_type),
              file_ext = VALUES(file_ext),
              sort_order = VALUES(sort_order),
              grade = VALUES(grade),
              subject = VALUES(subject),
              resource_type = VALUES(resource_type),
              edition = VALUES(edition),
              region = VALUES(region),
              year = VALUES(year),
              has_answer = VALUES(has_answer),
              source_pan_type = VALUES(source_pan_type),
              source_pan_url = VALUES(source_pan_url)
          `,
          [
            item.id,
            item.parent_resource_id,
            item.source_resource_id,
            item.title,
            item.slug,
            item.description,
            item.file_type,
            item.file_ext,
            item.sort_order,
            item.grade,
            item.subject,
            item.resource_type,
            item.edition,
            item.region,
            item.year,
            item.has_answer,
            item.source_pan_type,
            item.source_pan_url,
          ]
        );
      }
    }

    await targetConnection.commit();
    console.log(`Imported ${preview.length} K12 group resources into target DB.`);
  }
} catch (error) {
  if (SHOULD_EXECUTE && targetConnection) {
    await targetConnection.rollback();
  }
  throw error;
} finally {
  await sourceConnection.end();
  if (targetConnection) {
    await targetConnection.end();
  }
}
