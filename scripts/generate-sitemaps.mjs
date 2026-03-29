import fs from "node:fs";
import path from "node:path";

import mysql from "mysql2/promise";

const MAX_URLS_PER_SITEMAP = 500;
const DEFAULT_MAX_TOTAL_URLS = 1000;
const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const sitemapsDir = path.join(publicDir, "sitemaps");
const isFullMode = process.argv.includes("--full");

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

loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

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

function absoluteUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl).toString();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function dedupeEntries(entries) {
  const map = new Map();

  for (const entry of entries) {
    const current = map.get(entry.loc);
    if (!current) {
      map.set(entry.loc, entry);
      continue;
    }

    if (entry.lastmod && (!current.lastmod || entry.lastmod > current.lastmod)) {
      current.lastmod = entry.lastmod;
    }
  }

  return Array.from(map.values());
}

function buildUrlSet(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => {
    const lastmod = entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n` : "";
    return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n${lastmod}  </url>`;
  })
  .join("\n")}
</urlset>`;
}

function buildSitemapIndex(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
}

function ensureCleanDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  for (const entry of fs.readdirSync(dirPath)) {
    if (entry.endsWith(".xml")) {
      fs.rmSync(path.join(dirPath, entry), { force: true });
    }
  }
}

function parseMeta(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getMetaString(resource, key) {
  return typeof resource.meta?.[key] === "string" ? resource.meta[key] : "";
}

function getApplicableRegions(resource) {
  const list = resource.meta?.applicable_regions;
  if (Array.isArray(list)) {
    return list.map((item) => String(item).trim()).filter(Boolean);
  }
  const region = getMetaString(resource, "region");
  return region ? [region] : [];
}

function buildExamComboEntries(baseUrlValue, slug, resources) {
  const combos = new Map();

  for (const resource of resources) {
    const year = getMetaString(resource, "year");
    const updatedAt = resource.updated_at || resource.published_at || undefined;
    if (!/^(19|20)\d{2}$/.test(year)) {
      continue;
    }

    for (const region of getApplicableRegions(resource)) {
      const key = `${year}||${region}`;
      const current = combos.get(key);
      if (!current) {
        combos.set(key, {
          loc: absoluteUrl(baseUrlValue, `/topic/${slug}/${year}/${region}`),
          lastmod: updatedAt,
        });
        continue;
      }

      if (updatedAt && (!current.lastmod || updatedAt > current.lastmod)) {
        current.lastmod = updatedAt;
      }
    }
  }

  return Array.from(combos.values()).sort((a, b) => a.loc.localeCompare(b.loc, "zh-CN"));
}

function buildExamSubjectEntries(baseUrlValue, slug, resources) {
  const subjects = new Map();

  for (const resource of resources) {
    const subject = getMetaString(resource, "subject");
    const updatedAt = resource.updated_at || resource.published_at || undefined;
    if (!subject) {
      continue;
    }

    const current = subjects.get(subject);
    if (!current) {
      subjects.set(subject, {
        loc: absoluteUrl(baseUrlValue, `/topic/${slug}/subject/${subject}`),
        lastmod: updatedAt,
      });
      continue;
    }

    if (updatedAt && (!current.lastmod || updatedAt > current.lastmod)) {
      current.lastmod = updatedAt;
    }
  }

  return Array.from(subjects.values()).sort((a, b) => a.loc.localeCompare(b.loc, "zh-CN"));
}

function buildExamRegionEntries(baseUrlValue, slug, resources) {
  const regions = new Map();

  for (const resource of resources) {
    const updatedAt = resource.updated_at || resource.published_at || undefined;
    for (const region of getApplicableRegions(resource)) {
      const current = regions.get(region);
      if (!current) {
        regions.set(region, {
          loc: absoluteUrl(baseUrlValue, `/topic/${slug}/region/${region}`),
          lastmod: updatedAt,
        });
        continue;
      }

      if (updatedAt && (!current.lastmod || updatedAt > current.lastmod)) {
        current.lastmod = updatedAt;
      }
    }
  }

  return Array.from(regions.values()).sort((a, b) => a.loc.localeCompare(b.loc, "zh-CN"));
}

function buildExamTopicEntry(baseUrlValue, slug, resources) {
  if (!Array.isArray(resources) || resources.length === 0) {
    return [];
  }

  const lastmod = resources.reduce((latest, resource) => {
    const updatedAt = resource.updated_at || resource.published_at || undefined;
    if (!updatedAt) {
      return latest;
    }
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, undefined);

  return [{ loc: absoluteUrl(baseUrlValue, `/topic/${slug}`), lastmod }];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sortZh(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
}

function sortYears(values) {
  return [...values].sort((a, b) => Number(b) - Number(a));
}

function getLastmod(resources) {
  return resources.reduce((latest, resource) => {
    const candidate = resource.updated_at || resource.published_at || "";
    if (!candidate) return latest;
    return !latest || candidate > latest ? candidate : latest;
  }, "");
}

function summarizeFacets(resources) {
  return {
    subjects: sortZh(unique(resources.map((resource) => getMetaString(resource, "subject")))),
    years: sortYears(unique(resources.map((resource) => getMetaString(resource, "year")))),
    regions: sortZh(unique(resources.flatMap(getApplicableRegions))),
    paper_versions: sortZh(unique(resources.map((resource) => getMetaString(resource, "paper_version")))),
    cities: sortZh(unique(resources.map((resource) => getMetaString(resource, "city")))),
  };
}

function createCollection({ examSlug, collectionType, title, filters, resources }) {
  const facets = summarizeFacets(resources);
  const slugParts = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key, value]) => (typeof value === "boolean" ? key : String(value)));

  return {
    slug: `${examSlug}-${collectionType}-${slugify(slugParts.join("-"))}`,
    exam_slug: examSlug,
    collection_type: collectionType,
    title,
    resource_count: resources.length,
    subject_count: facets.subjects.length,
    year_count: facets.years.length,
    lastmod: getLastmod(resources),
    filters,
  };
}

function buildGroupedCollections(resources, keyBuilder) {
  const map = new Map();

  for (const resource of resources) {
    const groups = keyBuilder(resource).filter(Boolean);
    for (const group of groups) {
      const current = map.get(group.key) || { filters: group.filters, resources: [] };
      current.resources.push(resource);
      map.set(group.key, current);
    }
  }

  return map;
}

function buildGaokaoCollections(resources) {
  const collections = [];

  const bySubject = buildGroupedCollections(resources, (resource) => {
    const subject = getMetaString(resource, "subject");
    if (!subject) return [];
    return [{ key: `subject:${subject}`, filters: { subject } }];
  });
  for (const { filters, resources: list } of bySubject.values()) {
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "subject-history",
        title: `${filters.subject}历年高考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  const byPaperVersion = buildGroupedCollections(resources, (resource) => {
    const paperVersion = getMetaString(resource, "paper_version");
    if (!paperVersion) return [];
    return [{ key: `paper:${paperVersion}`, filters: { paper_version: paperVersion } }];
  });
  for (const { filters, resources: list } of byPaperVersion.values()) {
    if (list.length < 3) continue;
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "paper-version",
        title: `${filters.paper_version}高考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  const bySubjectPaperVersion = buildGroupedCollections(resources, (resource) => {
    const subject = getMetaString(resource, "subject");
    const paperVersion = getMetaString(resource, "paper_version");
    if (!subject || !paperVersion) return [];
    return [{ key: `subject-paper:${subject}:${paperVersion}`, filters: { subject, paper_version: paperVersion } }];
  });
  for (const { filters, resources: list } of bySubjectPaperVersion.values()) {
    if (list.length < 2) continue;
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "subject-paper-version",
        title: `${filters.subject}${filters.paper_version}高考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  const byYearRegion = buildGroupedCollections(resources, (resource) => {
    const year = getMetaString(resource, "year");
    const regions = getApplicableRegions(resource);
    if (!year || regions.length === 0) return [];
    return regions.map((region) => ({
      key: `year-region:${year}:${region}`,
      filters: { year, region, all_subjects: true },
    }));
  });
  for (const { filters, resources: list } of byYearRegion.values()) {
    const subjectCount = new Set(list.map((item) => getMetaString(item, "subject")).filter(Boolean)).size;
    if (list.length < 8 || subjectCount < 5) continue;
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "year-region",
        title: `${filters.year}年${filters.region}高考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  const byRegionSubject = buildGroupedCollections(resources, (resource) => {
    const subject = getMetaString(resource, "subject");
    const regions = getApplicableRegions(resource);
    if (!subject || regions.length === 0) return [];
    return regions.map((region) => ({
      key: `region-subject:${region}:${subject}`,
      filters: { region, subject },
    }));
  });
  for (const { filters, resources: list } of byRegionSubject.values()) {
    if (list.length < 3) continue;
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "region-subject",
        title: `${filters.region}${filters.subject}历年高考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  return collections;
}

function buildZhongkaoCollections(resources) {
  const collections = [];

  const bySubject = buildGroupedCollections(resources, (resource) => {
    const subject = getMetaString(resource, "subject");
    if (!subject) return [];
    return [{ key: `subject:${subject}`, filters: { subject } }];
  });
  for (const { filters, resources: list } of bySubject.values()) {
    collections.push(
      createCollection({
        examSlug: "zhongkaozhenti",
        collectionType: "subject-history",
        title: `${filters.subject}历年中考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  const byYearRegion = buildGroupedCollections(resources, (resource) => {
    const year = getMetaString(resource, "year");
    const regions = getApplicableRegions(resource);
    if (!year || regions.length === 0) return [];
    return regions.map((region) => ({
      key: `year-region:${year}:${region}`,
      filters: { year, region, all_subjects: true },
    }));
  });
  for (const { filters, resources: list } of byYearRegion.values()) {
    const subjectCount = new Set(list.map((item) => getMetaString(item, "subject")).filter(Boolean)).size;
    if (list.length < 8 || subjectCount < 5) continue;
    collections.push(
      createCollection({
        examSlug: "zhongkaozhenti",
        collectionType: "year-region",
        title: `${filters.year}年${filters.region}中考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  const byRegionSubject = buildGroupedCollections(resources, (resource) => {
    const subject = getMetaString(resource, "subject");
    const regions = getApplicableRegions(resource);
    if (!subject || regions.length === 0) return [];
    return regions.map((region) => ({
      key: `region-subject:${region}:${subject}`,
      filters: { region, subject },
    }));
  });
  for (const { filters, resources: list } of byRegionSubject.values()) {
    if (list.length < 3) continue;
    collections.push(
      createCollection({
        examSlug: "zhongkaozhenti",
        collectionType: "region-subject",
        title: `${filters.region}${filters.subject}历年中考真题合集`,
        filters,
        resources: list,
      })
    );
  }

  return collections;
}

function sortCollections(collections) {
  const typeOrder = new Map([
    ["subject-history", 1],
    ["region-subject", 2],
    ["paper-version", 3],
    ["subject-paper-version", 4],
    ["year-region", 5],
  ]);

  return [...collections].sort((a, b) => {
    const aType = typeOrder.get(a.collection_type) || 99;
    const bType = typeOrder.get(b.collection_type) || 99;
    if (aType !== bType) return aType - bType;
    if (b.resource_count !== a.resource_count) return b.resource_count - a.resource_count;
    if ((b.lastmod || "") !== (a.lastmod || "")) return String(b.lastmod || "").localeCompare(String(a.lastmod || ""));
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

function createEntry(loc, lastmod, priority) {
  return { loc, lastmod, priority };
}

function sortPriorityEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if ((b.lastmod || "") !== (a.lastmod || "")) return String(b.lastmod || "").localeCompare(String(a.lastmod || ""));
    return a.loc.localeCompare(b.loc, "zh-CN");
  });
}

function buildCompactEntries({
  baseUrl,
  channels,
  categories,
  topics,
  resources,
  tagSet,
  allCollections,
  gaokaoResources,
  zhongkaoResources,
  categoryIdsWithResources,
}) {
  const examHubEntries = [
    ...buildExamTopicEntry(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamTopicEntry(baseUrl, "zhongkaozhenti", zhongkaoResources),
    ...buildExamSubjectEntries(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamSubjectEntries(baseUrl, "zhongkaozhenti", zhongkaoResources),
    ...buildExamRegionEntries(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamRegionEntries(baseUrl, "zhongkaozhenti", zhongkaoResources),
  ].map((entry) => createEntry(entry.loc, entry.lastmod, 85));

  const collectionEntries = sortCollections(allCollections).map((collection) =>
    createEntry(absoluteUrl(baseUrl, `/collection/${collection.slug}`), collection.lastmod || undefined, 100)
  );

  const coreEntries = [
    createEntry(absoluteUrl(baseUrl, "/"), undefined, 120),
    ...["gaokaozhenti", "zhongkaozhenti"].map((slug) =>
      createEntry(absoluteUrl(baseUrl, `/collections/${slug}`), undefined, 110)
    ),
    ...channels.map((channel) => createEntry(absoluteUrl(baseUrl, `/channel/${channel.slug}`), undefined, 90)),
    ...categories
      .filter((category) => categoryIdsWithResources.has(category.id))
      .map((category) => createEntry(absoluteUrl(baseUrl, `/category/${category.slug}`), undefined, 88)),
    ...topics.map((topic) => createEntry(absoluteUrl(baseUrl, `/topic/${topic.slug}`), undefined, 87)),
  ];

  const tagEntries = [...tagSet]
    .sort((a, b) => String(a).localeCompare(String(b), "zh-CN"))
    .map((tag) => createEntry(absoluteUrl(baseUrl, `/tag/${slugify(tag)}`), undefined, 40));

  const resourceEntries = resources
    .slice()
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
    .map((resource) =>
      createEntry(
        absoluteUrl(baseUrl, `/resource/${resource.slug}`),
        resource.updated_at || resource.published_at || undefined,
        20
      )
    );

  return sortPriorityEntries(
    dedupeEntries([
      ...coreEntries,
      ...collectionEntries,
      ...examHubEntries,
      ...tagEntries,
      ...resourceEntries,
    ])
  ).slice(0, DEFAULT_MAX_TOTAL_URLS);
}

function buildFullEntries({
  baseUrl,
  channels,
  categories,
  topics,
  resources,
  tagSet,
  allCollections,
  gaokaoResources,
  zhongkaoResources,
  categoryIdsWithResources,
}) {
  return dedupeEntries([
    { loc: absoluteUrl(baseUrl, "/") },
    ...channels.map((channel) => ({ loc: absoluteUrl(baseUrl, `/channel/${channel.slug}`) })),
    ...categories
      .filter((category) => categoryIdsWithResources.has(category.id))
      .map((category) => ({ loc: absoluteUrl(baseUrl, `/category/${category.slug}`) })),
    ...topics.map((topic) => ({ loc: absoluteUrl(baseUrl, `/topic/${topic.slug}`) })),
    ...buildExamTopicEntry(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamTopicEntry(baseUrl, "zhongkaozhenti", zhongkaoResources),
    ...[...tagSet]
      .sort((a, b) => String(a).localeCompare(String(b), "zh-CN"))
      .map((tag) => ({ loc: absoluteUrl(baseUrl, `/tag/${slugify(tag)}`) })),
    ...resources.map((resource) => ({
      loc: absoluteUrl(baseUrl, `/resource/${resource.slug}`),
      lastmod: resource.updated_at || resource.published_at || undefined,
    })),
    ...buildExamSubjectEntries(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamRegionEntries(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamComboEntries(baseUrl, "gaokaozhenti", gaokaoResources),
    ...buildExamSubjectEntries(baseUrl, "zhongkaozhenti", zhongkaoResources),
    ...buildExamRegionEntries(baseUrl, "zhongkaozhenti", zhongkaoResources),
    ...buildExamComboEntries(baseUrl, "zhongkaozhenti", zhongkaoResources),
    ...["gaokaozhenti", "zhongkaozhenti"].map((slug) => ({ loc: absoluteUrl(baseUrl, `/collections/${slug}`) })),
    ...allCollections.map((collection) => ({
      loc: absoluteUrl(baseUrl, `/collection/${collection.slug}`),
      lastmod: collection.lastmod || undefined,
    })),
  ]);
}

const pool = mysql.createPool({
  host: required("DB_HOST"),
  port: Number.parseInt(process.env.DB_PORT || "3306", 10),
  user: required("DB_USER"),
  password: process.env.DB_PASSWORD || "",
  database: required("DB_NAME"),
  waitForConnections: true,
  connectionLimit: 4,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true,
});

const [channelRows, categoryRows, topicRows, resourceRows, tagRows, resourceTopicRows] = await Promise.all([
  pool.query(
    `SELECT id, slug, status
     FROM channels
     WHERE status = 'active'
     ORDER BY sort_order ASC, name ASC`
  ),
  pool.query(
    `SELECT id, slug, status
     FROM categories
     WHERE status = 'active'
     ORDER BY sort_order ASC, name ASC`
  ),
  pool.query(
    `SELECT id, slug, status
     FROM topics
     WHERE status = 'active'
     ORDER BY sort_order ASC, name ASC`
  ),
  pool.query(
    `SELECT id, slug, category_id, updated_at, published_at, meta
     FROM resources
     WHERE publish_status = 'published'
     ORDER BY updated_at DESC`
  ),
  pool.query(
    `SELECT DISTINCT rt.tag_name
     FROM resource_tags rt
     INNER JOIN resources r ON r.id = rt.resource_id
     WHERE r.publish_status = 'published'
     ORDER BY rt.tag_name ASC`
  ),
  pool.query(
    `SELECT resource_id, topic_id
     FROM resource_topics`
  ),
]);

await pool.end();

const channels = channelRows[0];
const categories = categoryRows[0];
const topics = topicRows[0];
const resources = resourceRows[0].map((row) => ({
  id: row.id,
  slug: row.slug,
  category_id: row.category_id,
  updated_at: row.updated_at,
  published_at: row.published_at,
  meta: parseMeta(row.meta),
}));
const topicIdsByResourceId = new Map();
for (const row of resourceTopicRows[0]) {
  const list = topicIdsByResourceId.get(row.resource_id) || [];
  list.push(row.topic_id);
  topicIdsByResourceId.set(row.resource_id, list);
}

const topicIdBySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));
const gaokaoTopicId = topicIdBySlug.get("gaokaozhenti");
const zhongkaoTopicId = topicIdBySlug.get("zhongkaozhenti");
const gaokaoResources = gaokaoTopicId
  ? resources.filter((resource) => (topicIdsByResourceId.get(resource.id) || []).includes(gaokaoTopicId))
  : [];
const zhongkaoResources = zhongkaoTopicId
  ? resources.filter((resource) => (topicIdsByResourceId.get(resource.id) || []).includes(zhongkaoTopicId))
  : [];

const allCollections = sortCollections([
  ...buildGaokaoCollections(gaokaoResources),
  ...buildZhongkaoCollections(zhongkaoResources),
]);

const categoryIdsWithResources = new Set(resources.map((resource) => resource.category_id).filter(Boolean));
const tagSet = new Set(tagRows[0].map((row) => row.tag_name));
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3014";

const urlEntries = isFullMode
  ? buildFullEntries({
      baseUrl,
      channels,
      categories,
      topics,
      resources,
      tagSet,
      allCollections,
      gaokaoResources,
      zhongkaoResources,
      categoryIdsWithResources,
    })
  : buildCompactEntries({
      baseUrl,
      channels,
      categories,
      topics,
      resources,
      tagSet,
      allCollections,
      gaokaoResources,
      zhongkaoResources,
      categoryIdsWithResources,
    });

ensureCleanDirectory(sitemapsDir);
fs.mkdirSync(publicDir, { recursive: true });

const sitemapFiles = chunk(urlEntries, MAX_URLS_PER_SITEMAP).map((entries, index) => {
  const fileName = `sitemap${index + 1}.xml`;
  fs.writeFileSync(path.join(sitemapsDir, fileName), buildUrlSet(entries), "utf8");
  return absoluteUrl(baseUrl, `/sitemaps/${fileName}`);
});

fs.writeFileSync(path.join(publicDir, "sitemap.xml"), buildSitemapIndex(sitemapFiles), "utf8");

console.log(
  `Generated ${sitemapFiles.length} sitemap file(s) with ${urlEntries.length} url(s) total (${isFullMode ? "full" : "compact"} mode).`
);
