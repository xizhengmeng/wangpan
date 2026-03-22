import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const dataDir = path.join(process.cwd(), 'data');
const structure = JSON.parse(fs.readFileSync(path.join(dataDir, 'content-structure.json'), 'utf8'));
const resources = JSON.parse(fs.readFileSync(path.join(dataDir, 'resources.json'), 'utf8'));
const eventsPath = path.join(dataDir, 'events.jsonl');
const feedbackPath = path.join(dataDir, 'feedback.jsonl');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function toSqlDate(value) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const events = readJsonLines(eventsPath);
const feedbackItems = readJsonLines(feedbackPath);

const connection = await mysql.createConnection({
  host: required('DB_HOST'),
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  user: required('DB_USER'),
  password: process.env.DB_PASSWORD || '',
  database: required('DB_NAME'),
  charset: 'utf8mb4',
  timezone: 'Z',
});

try {
  await connection.beginTransaction();

  await connection.execute('DELETE FROM track_events');
  await connection.execute('DELETE FROM feedback');

  await connection.execute(
    `INSERT INTO site_profile (id, name, tagline, short_link, positioning, featured_message, hot_searches)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       tagline = VALUES(tagline),
       short_link = VALUES(short_link),
       positioning = VALUES(positioning),
       featured_message = VALUES(featured_message),
       hot_searches = VALUES(hot_searches)`,
    [
      structure.site_profile.name,
      structure.site_profile.tagline,
      structure.site_profile.short_link,
      structure.site_profile.positioning,
      structure.site_profile.featured_message || null,
      structure.site_profile.hot_searches ? JSON.stringify(structure.site_profile.hot_searches) : null,
    ]
  );

  for (const channel of structure.channels) {
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
      [channel.id, channel.name, channel.slug, channel.description, channel.sort, channel.featured ? 1 : 0, channel.status]
    );
  }

  for (const category of structure.categories) {
    await connection.execute(
      `INSERT INTO categories (id, channel_id, parent_id, name, slug, description, sort_order, featured, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         parent_id = VALUES(parent_id),
         name = VALUES(name),
         slug = VALUES(slug),
         description = VALUES(description),
         sort_order = VALUES(sort_order),
         featured = VALUES(featured),
         status = VALUES(status)`,
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

  for (const topic of structure.topics) {
    await connection.execute(
      `INSERT INTO topics (id, category_id, name, slug, summary, download_url, sort_order, featured, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         category_id = VALUES(category_id),
         name = VALUES(name),
         slug = VALUES(slug),
         summary = VALUES(summary),
         download_url = VALUES(download_url),
         sort_order = VALUES(sort_order),
         featured = VALUES(featured),
         status = VALUES(status)`,
      [topic.id, topic.category_id, topic.name, topic.slug, topic.summary, topic.download_url || null, topic.sort, topic.featured ? 1 : 0, topic.status]
    );
  }

  for (const resource of resources) {
    await connection.execute(
      `INSERT INTO resources (
        id, title, slug, summary, category, channel_id, category_id, cover, quark_url, extract_code,
        publish_status, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        updated_at = VALUES(updated_at)`,
      [
        resource.id,
        resource.title,
        resource.slug,
        resource.summary,
        resource.category,
        resource.channel_id || null,
        resource.category_id || null,
        resource.cover,
        resource.quark_url || null,
        resource.extract_code || null,
        resource.publish_status,
        toSqlDate(resource.published_at),
        toSqlDate(resource.updated_at),
      ]
    );

    await connection.execute('DELETE FROM resource_tags WHERE resource_id = ?', [resource.id]);
    await connection.execute('DELETE FROM resource_topics WHERE resource_id = ?', [resource.id]);

    for (const [index, tag] of (resource.tags || []).entries()) {
      await connection.execute(
        `INSERT INTO resource_tags (resource_id, tag_name, tag_slug, sort_order)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name), sort_order = VALUES(sort_order)`,
        [resource.id, tag, slugify(tag), index]
      );
    }

    for (const topicId of resource.topic_ids || []) {
      await connection.execute(
        `INSERT INTO resource_topics (resource_id, topic_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE topic_id = VALUES(topic_id)`,
        [resource.id, topicId]
      );
    }
  }

  for (const event of events) {
    await connection.execute(
      `INSERT INTO track_events (
        name, event_time, session_id, anon_user_id, query_text, resource_id, result_rank, result_count,
        from_page, referer, device, ua
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.name,
        toSqlDate(event.event_time),
        event.session_id || null,
        event.anon_user_id || null,
        event.query || null,
        event.resource_id || null,
        event.result_rank ?? null,
        event.result_count ?? null,
        event.from_page || null,
        event.referer || null,
        event.device || null,
        event.ua || null,
      ]
    );
  }

  for (const item of feedbackItems) {
    await connection.execute(
      `INSERT INTO feedback (id, resource_id, resource_title, resource_slug, reason, note, created_at, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         resource_title = VALUES(resource_title),
         resource_slug = VALUES(resource_slug),
         reason = VALUES(reason),
         note = VALUES(note),
         created_at = VALUES(created_at),
         resolved = VALUES(resolved)`,
      [
        item.id,
        item.resource_id,
        item.resource_title,
        item.resource_slug,
        item.reason,
        item.note || null,
        toSqlDate(item.created_at),
        item.resolved ? 1 : 0,
      ]
    );
  }

  await connection.commit();
  console.log('Seed data synced to MySQL.');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
