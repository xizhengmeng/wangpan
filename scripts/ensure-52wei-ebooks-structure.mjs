import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { EBOOK_CHANNEL, EBOOK_CATEGORIES } from "./lib/wei52-ebooks.mjs";

const SHOULD_EXECUTE = process.argv.includes("--execute");

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

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const preview = {
    channel: EBOOK_CHANNEL,
    categories: EBOOK_CATEGORIES.map((category, index) => ({
      ...category,
      sort_order: index + 1,
      featured: index < 3,
      show_on_home: index < 2,
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

    await connection.execute(
      `INSERT INTO channels (id, name, slug, description, sort_order, featured, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         slug = VALUES(slug),
         description = VALUES(description),
         sort_order = VALUES(sort_order),
         featured = VALUES(featured),
         status = VALUES(status)`,
      [
        EBOOK_CHANNEL.id,
        EBOOK_CHANNEL.name,
        EBOOK_CHANNEL.slug,
        EBOOK_CHANNEL.description,
        EBOOK_CHANNEL.sort_order,
        1,
        "active",
      ]
    );

    for (const [index, category] of EBOOK_CATEGORIES.entries()) {
      const sortOrder = index + 1;
      const featured = index < 3 ? 1 : 0;
      const showOnHome = index < 2 ? 1 : 0;

      await connection.execute(
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
        [
          category.id,
          EBOOK_CHANNEL.id,
          null,
          category.name,
          category.slug,
          category.description,
          sortOrder,
          featured,
          showOnHome,
          "active",
        ]
      );

      await connection.execute(
        `INSERT INTO topics (id, category_id, name, slug, summary, download_url, sort_order, featured, show_on_home, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category_id = VALUES(category_id),
           name = VALUES(name),
           slug = VALUES(slug),
           summary = VALUES(summary),
           download_url = VALUES(download_url),
           sort_order = VALUES(sort_order),
           featured = VALUES(featured),
           show_on_home = VALUES(show_on_home),
           status = VALUES(status)`,
        [
          category.topic.id,
          category.id,
          category.topic.name,
          category.topic.slug,
          category.topic.summary,
          null,
          sortOrder,
          featured,
          showOnHome,
          "active",
        ]
      );
    }

    await connection.commit();
    console.log(`Ensured ebook structure: 1 channel, ${EBOOK_CATEGORIES.length} categories, ${EBOOK_CATEGORIES.length} topics.`);
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
