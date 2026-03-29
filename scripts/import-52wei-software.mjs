import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { buildSoftwareSummary, cleanTitle, pickSoftwareCover } from "./lib/wei52-software.mjs";

const SHOULD_EXECUTE = process.argv.includes("--execute");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1], 10) : 300;
const ROOT_DIR = path.join(process.cwd(), "data", "scraped-52wei");

const CHANNEL_ID = "channel_software_tools";
const CHANNEL_NAME = "软件工具";
const DESKTOP_CATEGORY_ID = "cat_software_platform";
const DESKTOP_CATEGORY_NAME = "软件平台";
const PLUGINS_CATEGORY_ID = "cat_software_tools_misc";
const PLUGINS_CATEGORY_NAME = "插件与书签";
const DESKTOP_TOPIC_ID = "topic_desktop";
const PLUGINS_TOPIC_ID = "topic_plugins";
const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80";

const SOFTWARE_KEYWORDS = [
  "软件",
  "绿色版",
  "破解版",
  "便携版",
  "安装版",
  "最新版",
  "客户端",
  "浏览器",
  "插件",
  "补丁",
  "Office",
  "WPS",
  "Excel",
  "Word",
  "PowerPoint",
  "PPT",
  "Photoshop",
  "Illustrator",
  "AutoCAD",
  "CAD",
  "Premiere",
  "After Effects",
  "AE",
  "IDEA",
  "Cursor",
  "WinRAR",
  "Final Cut",
  "CleanMyMac",
  "微信",
  "QQ",
  "Chrome",
  "Edge",
];

const PLUGIN_KEYWORDS = ["插件", "油猴", "扩展", "书签"];
const STRONG_SOFTWARE_KEYWORDS = [
  "软件",
  "绿色版",
  "破解版",
  "便携版",
  "安装版",
  "最新版",
  "客户端",
  "浏览器",
  "插件",
  "补丁",
  "Photoshop",
  "Illustrator",
  "AutoCAD",
  "Premiere",
  "After Effects",
  "IDEA",
  "Cursor",
  "WinRAR",
  "Final Cut",
  "CleanMyMac",
  "Chrome",
  "Edge",
];
const EXCLUDE_KEYWORDS = [
  "高考",
  "中考",
  "小学",
  "初中",
  "高中",
  "真题",
  "试卷",
  "题库",
  "电影",
  "短剧",
  "动漫",
  "番剧",
  "纪录片",
  "综艺",
  "美剧",
  "韩剧",
  "日剧",
];
const WEAK_CONTENT_KEYWORDS = [
  "模板",
  "课件",
  "资料",
  "文案",
  "方案",
  "手抄报",
  "合同",
  "简历",
  "电子书",
  "书籍",
  "题库",
  "试卷",
  "教案",
  "丛书",
  "教材",
  "出版社",
  "字帖",
  "音序表",
  "epub",
  "mobi",
  "azw3",
];

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

function normalizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
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

function containsAny(text, words) {
  return words.some((word) => text.toLowerCase().includes(word.toLowerCase()));
}

function inferTopic(title) {
  if (containsAny(title, PLUGIN_KEYWORDS)) {
    return {
      topicId: PLUGINS_TOPIC_ID,
      categoryId: PLUGINS_CATEGORY_ID,
      categoryName: PLUGINS_CATEGORY_NAME,
      topicName: "宝藏插件",
    };
  }

  return {
    topicId: DESKTOP_TOPIC_ID,
    categoryId: DESKTOP_CATEGORY_ID,
    categoryName: DESKTOP_CATEGORY_NAME,
    topicName: "电脑软件",
  };
}

function inferTags(title, topicName) {
  const tags = new Map();
  const push = (value) => {
    const name = normalizeText(value);
    if (!name) return;
    const slug = slugify(name);
    if (!slug || tags.has(slug)) return;
    tags.set(slug, name);
  };

  push("52wei");
  push(CHANNEL_NAME);
  push(topicName);

  for (const keyword of SOFTWARE_KEYWORDS) {
    if (title.toLowerCase().includes(keyword.toLowerCase())) {
      push(keyword);
    }
  }

  if (/教程|课程|训练营|实战/.test(title)) {
    push("软件教程");
  }

  if (/绿色版|破解版|便携版|安装版|最新版/.test(title)) {
    push(RegExp.lastMatch);
  }

  return Array.from(tags.entries()).map(([tagSlug, tagName], sortOrder) => ({
    tag_name: tagName,
    tag_slug: tagSlug,
    sort_order: sortOrder,
  }));
}

function loadCandidates(limit) {
  const files = fs
    .readdirSync(ROOT_DIR)
    .filter((file) => /^batch-\d+\.json$/.test(file))
    .sort();

  const byLink = new Map();
  const byTitle = new Set();

  for (const file of files) {
    const items = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, file), "utf8")).items || [];
    for (const item of items) {
      const rawTitle = normalizeText(item.title);
      const link = normalizeText(item.link);
      if (!rawTitle || !link || !link.includes("pan.quark.cn")) {
        continue;
      }

      const title = cleanTitle(rawTitle);
      const hasSoftwareKeyword = containsAny(title, SOFTWARE_KEYWORDS);
      const hasStrongSoftwareKeyword = containsAny(title, STRONG_SOFTWARE_KEYWORDS);
      const hasWeakContentKeyword = containsAny(title, WEAK_CONTENT_KEYWORDS);

      if (
        !title ||
        containsAny(title, EXCLUDE_KEYWORDS) ||
        !hasSoftwareKeyword ||
        !hasStrongSoftwareKeyword ||
        hasWeakContentKeyword
      ) {
        continue;
      }

      const titleKey = title.toLowerCase();
      if (byLink.has(link) || byTitle.has(titleKey)) {
        continue;
      }

      byLink.set(link, { rawTitle, title, link });
      byTitle.add(titleKey);

      if (byLink.size >= limit) {
        return Array.from(byLink.values());
      }
    }
  }

  return Array.from(byLink.values());
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const candidates = loadCandidates(LIMIT);
  const prepared = candidates.map((item) => {
    const resourceId = stableId("res52soft", item.link);
    const suffix = createHash("sha1").update(item.link).digest("hex").slice(0, 8);
    const slugBase = slugify(item.title) || `52wei-software-${suffix}`;
    const slug = `${slugBase}-${suffix}`;
    const topic = inferTopic(item.title);
    const tags = inferTags(item.title, topic.topicName);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    return {
      id: resourceId,
      title: item.title.slice(0, 255),
      slug,
      summary: buildSoftwareSummary(item.title, topic.categoryName, tags.map((tag) => tag.tag_name)),
      category: topic.categoryName,
      channel_id: CHANNEL_ID,
      category_id: topic.categoryId,
      cover: pickSoftwareCover(item.title, topic.categoryName, tags.map((tag) => tag.tag_name)) || DEFAULT_COVER,
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
        inferred_channel_slug: "software-tools",
        inferred_topic_slug: topic.topicId === PLUGINS_TOPIC_ID ? "plugins-zone" : "desktop-software",
      }),
      topic_id: topic.topicId,
      tags,
    };
  });

  const preview = {
    total: prepared.length,
    samples: prepared.slice(0, 10).map((item) => ({
      title: item.title,
      slug: item.slug,
      category: item.category,
      quark_url: item.quark_url,
      topic_id: item.topic_id,
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

    await connection.commit();
    console.log(`Imported ${prepared.length} 52wei software resources.`);
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
