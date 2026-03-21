import fs from "node:fs";
import path from "node:path";

import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

const schemaFile = path.join(process.cwd(), "sql", "schema.sql");
const dataDir = path.join(process.cwd(), "data");
const structureFile = path.join(dataDir, "content-structure.json");
const resourcesFile = path.join(dataDir, "resources.json");
const databaseCharset = "utf8mb4";
const databaseCollation = "utf8mb4_unicode_ci";

const requiredColumns: Record<string, Record<string, string>> = {
  site_profile: {
    id: "TINYINT UNSIGNED NOT NULL",
    name: "VARCHAR(120) NOT NULL",
    tagline: "VARCHAR(255) NOT NULL",
    short_link: "VARCHAR(255) NOT NULL",
    positioning: "TEXT NOT NULL",
    featured_message: "VARCHAR(255) NULL",
    updated_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
  channels: {
    id: "VARCHAR(64) NOT NULL",
    name: "VARCHAR(120) NOT NULL",
    slug: "VARCHAR(160) NOT NULL",
    description: "TEXT NOT NULL",
    sort_order: "INT NOT NULL DEFAULT 0",
    featured: "TINYINT(1) NOT NULL DEFAULT 0",
    status: "ENUM('active','hidden') NOT NULL DEFAULT 'active'",
    created_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    updated_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
  categories: {
    id: "VARCHAR(64) NOT NULL",
    channel_id: "VARCHAR(64) NOT NULL",
    parent_id: "VARCHAR(64) NULL",
    name: "VARCHAR(120) NOT NULL",
    slug: "VARCHAR(160) NOT NULL",
    description: "TEXT NOT NULL",
    sort_order: "INT NOT NULL DEFAULT 0",
    featured: "TINYINT(1) NOT NULL DEFAULT 0",
    status: "ENUM('active','hidden') NOT NULL DEFAULT 'active'",
    created_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    updated_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
  topics: {
    id: "VARCHAR(64) NOT NULL",
    category_id: "VARCHAR(64) NOT NULL",
    name: "VARCHAR(160) NOT NULL",
    slug: "VARCHAR(180) NOT NULL",
    summary: "TEXT NOT NULL",
    sort_order: "INT NOT NULL DEFAULT 0",
    featured: "TINYINT(1) NOT NULL DEFAULT 0",
    status: "ENUM('active','hidden') NOT NULL DEFAULT 'active'",
    created_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    updated_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  },
  resources: {
    id: "VARCHAR(64) NOT NULL",
    title: "VARCHAR(255) NOT NULL",
    slug: "VARCHAR(255) NOT NULL",
    summary: "TEXT NOT NULL",
    category: "VARCHAR(160) NOT NULL",
    channel_id: "VARCHAR(64) NULL",
    category_id: "VARCHAR(64) NULL",
    cover: "VARCHAR(500) NOT NULL",
    quark_url: "VARCHAR(1000) NOT NULL",
    extract_code: "VARCHAR(80) NULL",
    publish_status: "ENUM('draft','published','offline') NOT NULL DEFAULT 'draft'",
    published_at: "DATETIME NOT NULL",
    updated_at: "DATETIME NOT NULL",
    created_at: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
  },
  resource_tags: {
    resource_id: "VARCHAR(64) NOT NULL",
    tag_name: "VARCHAR(120) NOT NULL",
    tag_slug: "VARCHAR(160) NOT NULL",
    sort_order: "INT NOT NULL DEFAULT 0",
  },
  resource_topics: {
    resource_id: "VARCHAR(64) NOT NULL",
    topic_id: "VARCHAR(64) NOT NULL",
  },
  track_events: {
    id: "BIGINT UNSIGNED NOT NULL AUTO_INCREMENT",
    name: "VARCHAR(64) NOT NULL",
    event_time: "DATETIME NOT NULL",
    session_id: "VARCHAR(120) NULL",
    anon_user_id: "VARCHAR(120) NULL",
    query_text: "VARCHAR(255) NULL",
    resource_id: "VARCHAR(64) NULL",
    result_rank: "INT NULL",
    result_count: "INT NULL",
    from_page: "VARCHAR(255) NULL",
    referer: "VARCHAR(1000) NULL",
    device: "VARCHAR(120) NULL",
    ua: "VARCHAR(1000) NULL",
  },
  feedback: {
    id: "VARCHAR(64) NOT NULL",
    resource_id: "VARCHAR(64) NOT NULL",
    resource_title: "VARCHAR(255) NOT NULL",
    resource_slug: "VARCHAR(255) NOT NULL",
    reason: "ENUM('expired','wrong_file','extract_error','other') NOT NULL",
    note: "VARCHAR(200) NULL",
    created_at: "DATETIME NOT NULL",
    resolved: "TINYINT(1) NOT NULL DEFAULT 0",
  },
};

function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`缺少数据库配置: ${name}`);
  }
  return value;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

function toSqlDateTime(value: string | Date) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function localSlugify(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isDatabaseConfigured() {
  return Boolean(
    process.env.DB_HOST &&
      process.env.DB_USER &&
      process.env.DB_NAME
  );
}

function getDatabaseConfig() {
  return {
    host: getRequiredEnv("DB_HOST"),
    port: Number.parseInt(process.env.DB_PORT || "3306", 10),
    user: getRequiredEnv("DB_USER"),
    password: process.env.DB_PASSWORD || "",
    database: getRequiredEnv("DB_NAME"),
  };
}

function getPool() {
  if (pool) {
    return pool;
  }

  const config = getDatabaseConfig();
  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    namedPlaceholders: true,
  });

  return pool;
}

async function ensureDatabaseExists() {
  const config = getDatabaseConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: databaseCharset,
    timezone: "Z",
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET ${databaseCharset} COLLATE ${databaseCollation}`
    );
  } finally {
    await connection.end();
  }
}

async function applySchema() {
  const schemaSql = fs.readFileSync(schemaFile, "utf8");
  await getPool().query(schemaSql);
}

async function ensureMissingColumns() {
  const config = getDatabaseConfig();
  const [rows] = await getPool().query<Array<RowDataPacket & { table_name: string; column_name: string }>>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?`,
    [config.database]
  );

  const existing = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = existing.get(row.table_name) || new Set<string>();
    set.add(row.column_name);
    existing.set(row.table_name, set);
  }

  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const existingColumns = existing.get(tableName) || new Set<string>();
    for (const [columnName, definition] of Object.entries(columns)) {
      if (existingColumns.has(columnName)) {
        continue;
      }

      await getPool().query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`
      );
    }
  }
}

async function ensureDefaultSiteProfile() {
  await getPool().query(
    `INSERT INTO site_profile (id, name, tagline, short_link, positioning, featured_message)
     SELECT 1, '夸克资料站', '搜索优先的夸克资料站', '', '通过数据库驱动频道、栏目、专题和资源。', NULL
     FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM site_profile WHERE id = 1)`
  );
}

async function getTableCount(tableName: string) {
  const [rows] = await getPool().query<Array<RowDataPacket & { count: number }>>(
    `SELECT COUNT(*) AS count FROM \`${tableName}\``
  );
  return rows[0]?.count || 0;
}

async function seedStructureIfEmpty() {
  const structureCount = await getTableCount("channels");
  if (structureCount > 0) {
    return;
  }

  const structure = readJsonFile<{
    site_profile?: {
      name?: string;
      tagline?: string;
      short_link?: string;
      positioning?: string;
      featured_message?: string;
    };
    channels?: Array<{
      id: string;
      name: string;
      slug: string;
      description: string;
      sort: number;
      featured?: boolean;
      status: "active" | "hidden";
    }>;
    categories?: Array<{
      id: string;
      channel_id: string;
      parent_id?: string | null;
      name: string;
      slug: string;
      description: string;
      sort: number;
      featured?: boolean;
      status: "active" | "hidden";
    }>;
    topics?: Array<{
      id: string;
      category_id: string;
      name: string;
      slug: string;
      summary: string;
      sort: number;
      featured?: boolean;
      status: "active" | "hidden";
    }>;
  }>(structureFile, {});

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    if (structure.site_profile) {
      await connection.execute(
        `UPDATE site_profile
         SET name = ?, tagline = ?, short_link = ?, positioning = ?, featured_message = ?
         WHERE id = 1`,
        [
          structure.site_profile.name || "夸克资料站",
          structure.site_profile.tagline || "搜索优先的夸克资料站",
          structure.site_profile.short_link || "",
          structure.site_profile.positioning || "通过数据库驱动频道、栏目、专题和资源。",
          structure.site_profile.featured_message || null,
        ]
      );
    }

    for (const channel of structure.channels || []) {
      await connection.execute(
        `INSERT INTO channels (id, name, slug, description, sort_order, featured, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          channel.id,
          channel.name,
          channel.slug,
          channel.description,
          channel.sort,
          channel.featured ? 1 : 0,
          channel.status,
        ]
      );
    }

    for (const category of structure.categories || []) {
      await connection.execute(
        `INSERT INTO categories (id, channel_id, parent_id, name, slug, description, sort_order, featured, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category.id,
          category.channel_id,
          category.parent_id || null,
          category.name,
          category.slug,
          category.description,
          category.sort,
          category.featured ? 1 : 0,
          category.status,
        ]
      );
    }

    for (const topic of structure.topics || []) {
      await connection.execute(
        `INSERT INTO topics (id, category_id, name, slug, summary, sort_order, featured, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          topic.id,
          topic.category_id,
          topic.name,
          topic.slug,
          topic.summary,
          topic.sort,
          topic.featured ? 1 : 0,
          topic.status,
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function seedResourcesIfEmpty() {
  const resourceCount = await getTableCount("resources");
  if (resourceCount > 0) {
    return;
  }

  const resources = readJsonFile<
    Array<{
      id: string;
      title: string;
      slug: string;
      summary: string;
      category: string;
      channel_id?: string;
      category_id?: string;
      topic_ids?: string[];
      tags: string[];
      cover: string;
      quark_url: string;
      extract_code?: string;
      publish_status: "draft" | "published" | "offline";
      published_at: string;
      updated_at: string;
    }>
  >(resourcesFile, []);

  if (resources.length === 0) {
    return;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    for (const resource of resources) {
      await connection.execute(
        `INSERT INTO resources (
          id, title, slug, summary, category, channel_id, category_id, cover, quark_url,
          extract_code, publish_status, published_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resource.id,
          resource.title,
          resource.slug,
          resource.summary,
          resource.category,
          resource.channel_id || null,
          resource.category_id || null,
          resource.cover,
          resource.quark_url,
          resource.extract_code || null,
          resource.publish_status,
          toSqlDateTime(resource.published_at),
          toSqlDateTime(resource.updated_at),
        ]
      );

      for (const [index, tag] of (resource.tags || []).entries()) {
        await connection.execute(
          `INSERT INTO resource_tags (resource_id, tag_name, tag_slug, sort_order)
           VALUES (?, ?, ?, ?)`,
          [resource.id, tag, localSlugify(tag), index]
        );
      }

      for (const topicId of resource.topic_ids || []) {
        await connection.execute(
          `INSERT INTO resource_topics (resource_id, topic_id) VALUES (?, ?)`,
          [resource.id, topicId]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function seedDatabaseIfEmpty() {
  await seedStructureIfEmpty();
  await seedResourcesIfEmpty();
}

export async function ensureDatabaseReady() {
  if (pool && !initPromise) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      await ensureDatabaseExists();
      getPool();
      await applySchema();
      await ensureMissingColumns();
      await ensureDefaultSiteProfile();
      await seedDatabaseIfEmpty();
    } catch (error) {
      if (pool) {
        await pool.end();
        pool = null;
      }
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

export async function queryRows<T extends RowDataPacket = RowDataPacket>(sql: string, params?: any[]) {
  await ensureDatabaseReady();
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function execute(sql: string, params?: any[]) {
  await ensureDatabaseReady();
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>) {
  await ensureDatabaseReady();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
