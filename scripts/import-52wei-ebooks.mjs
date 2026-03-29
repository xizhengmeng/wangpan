import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import {
  EBOOK_CHANNEL,
  buildEbookSummary,
  cleanEbookTitle,
  getCategoryConfig,
  inferEbookCategory,
  inferEbookTags,
  normalizeText,
  slugify,
  stableId,
} from "./lib/wei52-ebooks.mjs";

const SHOULD_EXECUTE = process.argv.includes("--execute");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1], 10) : 8000;
const ROOT_DIR = path.join(process.cwd(), "data", "scraped-52wei");

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

function hasExcludedNoise(title) {
  return /(课程|训练营|教程|视频课|讲义|配套视频|资料包|安装包|软件|插件|破解版|绿色版|客户端|试卷|题库|真题|小学|初中|高中|中考|高考)/i.test(
    title
  );
}

function inferFormats(title) {
  const formats = [];
  if (/pdf/i.test(title)) formats.push("PDF");
  if (/epub/i.test(title)) formats.push("EPUB");
  if (/mobi/i.test(title)) formats.push("MOBI");
  if (/azw3/i.test(title)) formats.push("AZW3");
  return formats;
}

function loadCandidates(limit) {
  const files = fs
    .readdirSync(ROOT_DIR)
    .filter((file) => /^batch-\d+\.json$/.test(file))
    .sort();

  const byLink = new Map();
  const byTitle = new Set();
  const categoryCounts = new Map();

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, file), "utf8"));
    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      const rawTitle = normalizeText(item.title);
      const link = normalizeText(item.link);
      if (!rawTitle || !link || !link.includes("pan.quark.cn")) {
        continue;
      }

      const title = cleanEbookTitle(rawTitle);
      if (!title || hasExcludedNoise(title)) {
        continue;
      }

      const categoryKey = inferEbookCategory(title);
      if (!categoryKey) {
        continue;
      }

      const categoryConfig = getCategoryConfig(categoryKey);
      if (!categoryConfig) {
        continue;
      }

      const titleKey = title.toLowerCase();
      if (byLink.has(link) || byTitle.has(titleKey)) {
        continue;
      }

      byLink.set(link, {
        rawTitle,
        title,
        link,
        categoryKey,
        categoryConfig,
      });
      byTitle.add(titleKey);
      categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + 1);

      if (byLink.size >= limit) {
        return {
          items: Array.from(byLink.values()),
          categoryCounts: Object.fromEntries(categoryCounts),
        };
      }
    }
  }

  return {
    items: Array.from(byLink.values()),
    categoryCounts: Object.fromEntries(categoryCounts),
  };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const { items: candidates, categoryCounts } = loadCandidates(LIMIT);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const prepared = candidates.map((item) => {
    const resourceId = stableId("res52book", item.link);
    const suffix = createHash("sha1").update(item.link).digest("hex").slice(0, 8);
    const slugBase = slugify(item.title) || `52wei-ebook-${suffix}`;
    const safeBase = slugBase.slice(0, 235).replace(/-+$/g, "");
    const slug = `${safeBase}-${suffix}-ebook`;
    const tags = inferEbookTags(item.title, item.categoryConfig.name, item.categoryConfig.topic.name);
    const formats = inferFormats(item.title);

    return {
      id: resourceId,
      title: item.title.slice(0, 255),
      slug,
      summary: buildEbookSummary(item.title, item.categoryConfig.name),
      category: item.categoryConfig.name,
      channel_id: EBOOK_CHANNEL.id,
      category_id: item.categoryConfig.id,
      cover: item.categoryConfig.cover,
      quark_url: item.link,
      extract_code: null,
      publish_status: "published",
      published_at: now,
      updated_at: now,
      created_at: now,
      meta: JSON.stringify({
        source: "52wei",
        source_type: "scraped_batch",
        raw_title: item.rawTitle,
        normalized_title: item.title,
        inferred_channel_slug: EBOOK_CHANNEL.slug,
        inferred_category_slug: item.categoryConfig.slug,
        inferred_topic_slug: item.categoryConfig.topic.slug,
        link_owner: "external",
        formats,
      }),
      topic_id: item.categoryConfig.topic.id,
      tags,
    };
  });

  const preview = {
    total: prepared.length,
    categories: categoryCounts,
    samples: prepared.slice(0, 12).map((item) => ({
      title: item.title,
      category: item.category,
      slug: item.slug,
      topic_id: item.topic_id,
      quark_url: item.quark_url,
    })),
  };

  console.log(JSON.stringify(preview, null, 2));

  if (!SHOULD_EXECUTE) {
    return;
  }

  const connection = await mysql.createConnection({
    host: required("DB_HOST"),
    port: Number(required("DB_PORT")),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    charset: "utf8mb4",
  });

  try {
    await connection.beginTransaction();

    const activeIds = new Set(prepared.map((item) => item.id));

    for (const item of prepared) {
      await connection.execute(
        `INSERT INTO resources (
          id, title, slug, summary, category, channel_id, category_id, cover, quark_url, extract_code,
          publish_status, published_at, updated_at, meta, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)
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
          meta = VALUES(meta)`,
        [
          item.id,
          item.title,
          item.slug,
          item.summary,
          item.category,
          item.channel_id,
          item.category_id,
          item.cover,
          item.quark_url,
          item.extract_code,
          item.publish_status,
          item.published_at,
          item.updated_at,
          item.meta,
          item.created_at,
        ]
      );

      await connection.execute("DELETE FROM resource_tags WHERE resource_id = ?", [item.id]);
      for (const tag of item.tags) {
        await connection.execute(
          `INSERT INTO resource_tags (resource_id, tag_name, tag_slug, sort_order)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name), sort_order = VALUES(sort_order)`,
          [item.id, tag.tag_name, tag.tag_slug, tag.sort_order]
        );
      }

      await connection.execute("DELETE FROM resource_topics WHERE resource_id = ?", [item.id]);
      await connection.execute(
        `INSERT INTO resource_topics (resource_id, topic_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE topic_id = VALUES(topic_id)`,
        [item.id, item.topic_id]
      );
    }

    const [existingRows] = await connection.execute(
      `SELECT id
       FROM resources
       WHERE channel_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.source')) = '52wei'`,
      [EBOOK_CHANNEL.id]
    );

    const staleIds = existingRows
      .map((row) => String(row.id))
      .filter((id) => !activeIds.has(id));

    if (staleIds.length > 0) {
      const placeholders = staleIds.map(() => "?").join(", ");
      await connection.execute(
        `UPDATE resources
         SET publish_status = 'offline', updated_at = ?
         WHERE id IN (${placeholders})`,
        [now, ...staleIds]
      );
    }

    await connection.commit();
    console.log(`Imported ${prepared.length} 52wei ebook resources. Offlined ${staleIds.length} stale resources.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
