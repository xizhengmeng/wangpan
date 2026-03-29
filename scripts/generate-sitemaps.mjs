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

const structure = readJsonFile(path.join(dataDir, "content-structure.json"), {
  channels: [],
  categories: [],
  topics: [],
});
const resources = readJsonFile(path.join(dataDir, "resources.json"), []);
const gaokaoManifest = readJsonFile(path.join(dataDir, "gaokao-zhenti-manifest.json"), {
  resources: [],
});
const zhongkaoManifest = readJsonFile(path.join(dataDir, "zhongkao-zhenti-manifest.json"), {
  resources: [],
});
const examCollectionsData = readJsonFile(path.join(dataDir, "exam-collections.json"), {
  collections: [],
});
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const publishedResources = resources.filter((resource) => resource.publish_status === "published");

function getApplicableRegions(resource) {
  const list = resource?.meta?.applicable_regions;
  if (Array.isArray(list)) {
    return list.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof resource?.meta?.region === "string" && resource.meta.region) {
    return [resource.meta.region];
  }
  return [];
}

function buildExamComboEntries(baseUrlValue, slug, manifestResources) {
  const combos = new Map();

  for (const resource of manifestResources) {
    const year = typeof resource?.meta?.year === "string" ? resource.meta.year : "";
    const updatedAt = resource?.updated_at || resource?.published_at || undefined;
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

function buildExamSubjectEntries(baseUrlValue, slug, manifestResources) {
  const subjects = new Map();

  for (const resource of manifestResources) {
    const subject = typeof resource?.meta?.subject === "string" ? resource.meta.subject : "";
    const updatedAt = resource?.updated_at || resource?.published_at || undefined;
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

function buildExamRegionEntries(baseUrlValue, slug, manifestResources) {
  const regions = new Map();

  for (const resource of manifestResources) {
    const updatedAt = resource?.updated_at || resource?.published_at || undefined;
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

function buildExamTopicEntry(baseUrlValue, slug, manifestResources) {
  if (!Array.isArray(manifestResources) || manifestResources.length === 0) {
    return [];
  }

  const lastmod = manifestResources.reduce((latest, resource) => {
    const updatedAt = resource?.updated_at || resource?.published_at || undefined;
    if (!updatedAt) {
      return latest;
    }
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, undefined);

  return [{ loc: absoluteUrl(baseUrlValue, `/topic/${slug}`), lastmod }];
}

const categoryIdsWithResources = new Set(
  publishedResources.map((resource) => resource.category_id).filter(Boolean)
);

const tagSet = new Set();
for (const resource of publishedResources) {
  for (const tag of resource.tags || []) {
    tagSet.add(tag);
  }
}

const urlEntries = dedupeEntries([
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
  ...buildExamTopicEntry(baseUrl, "gaokaozhenti", gaokaoManifest.resources || []),
  ...buildExamTopicEntry(baseUrl, "zhongkaozhenti", zhongkaoManifest.resources || []),
  ...[...tagSet]
    .sort((a, b) => String(a).localeCompare(String(b), "zh-CN"))
    .map((tag) => ({ loc: absoluteUrl(baseUrl, `/tag/${slugify(tag)}`) })),
  ...publishedResources.map((resource) => ({
    loc: absoluteUrl(baseUrl, `/resource/${resource.slug}`),
    lastmod: resource.updated_at || resource.published_at || undefined,
  })),
  ...buildExamSubjectEntries(baseUrl, "gaokaozhenti", gaokaoManifest.resources || []),
  ...buildExamRegionEntries(baseUrl, "gaokaozhenti", gaokaoManifest.resources || []),
  ...buildExamComboEntries(baseUrl, "gaokaozhenti", gaokaoManifest.resources || []),
  ...buildExamSubjectEntries(baseUrl, "zhongkaozhenti", zhongkaoManifest.resources || []),
  ...buildExamRegionEntries(baseUrl, "zhongkaozhenti", zhongkaoManifest.resources || []),
  ...buildExamComboEntries(baseUrl, "zhongkaozhenti", zhongkaoManifest.resources || []),
  ...["gaokaozhenti", "zhongkaozhenti"].map((slug) => ({ loc: absoluteUrl(baseUrl, `/collections/${slug}`) })),
  ...(examCollectionsData.collections || []).map((collection) => ({
    loc: absoluteUrl(baseUrl, `/collection/${collection.slug}`),
    lastmod: collection.lastmod || undefined,
  })),
]);

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
