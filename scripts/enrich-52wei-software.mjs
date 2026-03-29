import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { buildSoftwareSummary, pickSoftwareCover } from "./lib/wei52-software.mjs";

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

  const connection = await mysql.createConnection({
    host: required("DB_HOST"),
    port: Number(required("DB_PORT")),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    charset: "utf8mb4",
  });

  try {
    const [rows] = await connection.execute(
      `SELECT r.id, r.title, r.category, COALESCE(GROUP_CONCAT(rt.tag_name ORDER BY rt.sort_order SEPARATOR '||'), '') AS tag_names
       FROM resources r
       LEFT JOIN resource_tags rt ON rt.resource_id = r.id
       WHERE r.id LIKE 'res52soft_%'
       GROUP BY r.id, r.title, r.category`
    );

    await connection.beginTransaction();

    for (const row of rows) {
      const tags = String(row.tag_names || "")
        .split("||")
        .map((value) => value.trim())
        .filter(Boolean);
      const summary = buildSoftwareSummary(row.title, row.category, tags);
      const cover = pickSoftwareCover(row.title, row.category, tags);

      await connection.execute(
        `UPDATE resources
         SET summary = ?, cover = ?, updated_at = NOW()
         WHERE id = ?`,
        [summary, cover, row.id]
      );
    }

    await connection.commit();
    console.log(`Enriched ${rows.length} 52wei software resources.`);
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
