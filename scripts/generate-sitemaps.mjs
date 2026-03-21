import fs from "node:fs";
import path from "node:path";

const MAX_URLS_PER_SITEMAP = 100;
const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const publicDir = path.join(rootDir, "public");
const sitemapsDir = path.join(publicDir, "sitemaps");

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return fallback;
  }

  return JSON.parse(raw);
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

const structure = readJsonFile(path.join(dataDir, "content-structure.json"), {
  channels: [],
  categories: [],
  topics: [],
});
const resources = readJsonFile(path.join(dataDir, "resources.json"), []);
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const publishedResources = resources.filter((resource) => resource.publish_status === "published");

const categoryIdsWithResources = new Set(
  publishedResources.map((resource) => resource.category_id).filter(Boolean)
);

const tagSet = new Set();
for (const resource of publishedResources) {
  for (const tag of resource.tags || []) {
    tagSet.add(tag);
  }
}

const urlEntries = [
  { loc: absoluteUrl(baseUrl, "/") },
  ...structure.channels
    .filter((channel) => channel.status === "active")
    .map((channel) => ({ loc: absoluteUrl(baseUrl, `/channel/${channel.slug}`) })),
  ...structure.categories
    .filter((category) => category.status === "active" && categoryIdsWithResources.has(category.id))
    .map((category) => ({ loc: absoluteUrl(baseUrl, `/category/${category.slug}`) })),
  ...structure.topics
    .filter((topic) => topic.status === "active")
    .map((topic) => ({ loc: absoluteUrl(baseUrl, `/topic/${topic.slug}`) })),
  ...[...tagSet]
    .sort((a, b) => String(a).localeCompare(String(b), "zh-CN"))
    .map((tag) => ({ loc: absoluteUrl(baseUrl, `/tag/${slugify(tag)}`) })),
  ...publishedResources.map((resource) => ({
    loc: absoluteUrl(baseUrl, `/resource/${resource.slug}`),
    lastmod: resource.updated_at || resource.published_at || undefined,
  })),
];

ensureCleanDirectory(sitemapsDir);
fs.mkdirSync(publicDir, { recursive: true });

const sitemapFiles = chunk(urlEntries, MAX_URLS_PER_SITEMAP).map((entries, index) => {
  const fileName = `sitemap-${index + 1}.xml`;
  fs.writeFileSync(path.join(sitemapsDir, fileName), buildUrlSet(entries), "utf8");
  return absoluteUrl(baseUrl, `/sitemaps/${fileName}`);
});

fs.writeFileSync(path.join(publicDir, "sitemap.xml"), buildSitemapIndex(sitemapFiles), "utf8");

console.log(
  `Generated ${sitemapFiles.length} sitemap file(s) with ${urlEntries.length} url(s) total.`
);
