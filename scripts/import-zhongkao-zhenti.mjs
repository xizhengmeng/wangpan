import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

const ROOT_DIR = process.argv[2] && !process.argv[2].startsWith("--")
  ? path.resolve(process.argv[2])
  : "/Users/k12/Downloads/《十年中考真题 (2013-2024) 》全科分类汇编";
const SHOULD_EXECUTE = process.argv.includes("--execute");
const KEEP_EXISTING = process.argv.includes("--keep-existing");
const MANIFEST_PATH = path.join(process.cwd(), "data", "zhongkao-zhenti-manifest.json");

const CHANNEL_ID = "channel_education_exam";
const CATEGORY_ID = "cat_middle_school";
const CATEGORY_NAME = "初中";
const TOPIC_ID = "topic_5809e10b9244";
const TOPIC_SLUG = "zhongkaozhenti";
const TOPIC_NAME = "中考真题";
const TOPIC_SUMMARY = "汇总全国中考真题，支持按科目、年份、地区和城市筛选。";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80";
const MIN_YEAR = 2013;
const MAX_YEAR = 2024;
const ALLOWED_EXTENSIONS = new Set([".doc", ".docx", ".pdf", ".zip"]);
const KIND_ORDER = ["原卷版", "解析版", "答案版", "听力", "扫描版", "图片版", "PDF版"];
const TOPIC_FIELD_SCHEMA = [
  { key: "subject", label: "科目", type: "text" },
  { key: "year", label: "年份", type: "text" },
  { key: "region", label: "地区", type: "text" },
  { key: "city", label: "城市", type: "text" },
];
const PROVINCES = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江", "江苏", "浙江", "安徽", "福建",
  "江西", "山东", "河南", "湖北", "湖南", "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海",
  "内蒙古", "广西", "西藏", "宁夏", "新疆",
];
const PROVINCE_SET = new Set(PROVINCES);
const PROVINCE_INDEX = new Map(PROVINCES.map((province, index) => [province, index]));
const SUBJECT_ALIASES = new Map([
  ["物理", "物理"],
  ["数学", "数学"],
  ["地理", "地理"],
  ["化学", "化学"],
  ["生物", "生物"],
  ["英语", "英语"],
  ["语文", "语文"],
  ["历史", "历史"],
  ["道法", "道法"],
]);
const DIRECT_CITY_REGION_MAP = new Map([
  ["深圳", "广东"],
  ["广州", "广东"],
  ["武汉", "湖北"],
  ["昆明", "云南"],
  ["长春", "吉林"],
  ["乌鲁木齐", "新疆"],
  ["哈尔滨", "黑龙江"],
  ["沈阳", "辽宁"],
  ["贵阳", "贵州"],
  ["兰州", "甘肃"],
  ["呼和浩特", "内蒙古"],
  ["成都", "四川"],
  ["绵阳", "四川"],
  ["南充", "四川"],
]);
const CITY_HINTS = Array.from(new Set([
  ...DIRECT_CITY_REGION_MAP.keys(),
  "龙东地区",
  "北部湾",
  "北部湾经济区",
  "湘西州",
  "恩施州",
  "凉山州",
  "临夏州",
  "嘉峪关市",
]));
const PROVINCE_PATTERN = PROVINCES.slice().sort((a, b) => b.length - a.length).join("|");
const SUBJECT_PATTERN = Array.from(SUBJECT_ALIASES.keys())
  .concat(["生物学", "道德与法治", "思想品德", "科学"])
  .sort((a, b) => b.length - a.length)
  .join("|");

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

function walkFiles(dirPath, list = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, list);
      continue;
    }
    if (entry.isFile()) {
      list.push(fullPath);
    }
  }
  return list;
}

function normalizeSpaces(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeBaseName(fileName) {
  return normalizeSpaces(fileName)
    .replace(/[【\[]/g, "（")
    .replace(/[】\]]/g, "）")
    .replace(/\(\d+\)$/g, "")
    .replace(/（\d+）$/g, "")
    .replace(/【\d+】$/g, "")
    .replace(/[\u3000]/g, " ");
}

function stripDecorators(text) {
  return normalizeSpaces(text)
    .replace(/^精品解析[:：]?\s*/g, "")
    .replace(/^精品解析\s*/g, "")
    .replace(/^精编[:：]?\s*/g, "")
    .replace(/（网络回忆版）/g, "")
    .replace(/（回忆版）/g, "")
    .replace(/\(网络回忆版\)/g, "")
    .replace(/\(回忆版\)/g, "");
}

function extractYear(text) {
  const match = String(text).match(/(19|20)\d{2}/);
  return match ? match[0] : null;
}

function extractYearFromPath(relativePath) {
  const matches = [...String(relativePath).matchAll(/(19|20)\d{2}/g)].map((match) => match[0]);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function extractSubject(relativePath) {
  const firstSegment = relativePath.split(path.sep)[0] || "";
  const match = firstSegment.match(/^初中(.+?)\s+历年/);
  if (!match) {
    return null;
  }
  return SUBJECT_ALIASES.get(match[1]) || match[1] || null;
}

function sortRegions(regions) {
  return Array.from(new Set(regions))
    .filter((region) => PROVINCE_SET.has(region))
    .sort((a, b) => {
      const aIndex = PROVINCE_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = PROVINCE_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.localeCompare(b, "zh-CN");
    });
}

function normalizeProvinceCandidate(text) {
  const value = normalizeSpaces(text)
    .replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市/g, "");

  if (value.includes("新疆生产建设兵团")) {
    return "新疆";
  }

  for (const province of PROVINCES) {
    if (value.includes(province)) {
      return province;
    }
  }

  return null;
}

function extractProvince(text) {
  return normalizeProvinceCandidate(text);
}

function detectKinds(baseName, ext) {
  const kinds = [];
  if (/原卷版|原卷/.test(baseName)) kinds.push("原卷版");
  if (/解析版|含解析|答案\+解析|附解析|精编word版/.test(baseName)) kinds.push("解析版");
  if (/含答案|答案/.test(baseName) && !kinds.includes("解析版")) kinds.push("答案版");
  if (/听力/.test(baseName) || ext === ".zip") kinds.push("听力");
  if (/扫描版/.test(baseName)) kinds.push("扫描版");
  if (/图片版/.test(baseName)) kinds.push("图片版");
  if (/PDF版|PDF文件版/i.test(baseName) || ext === ".pdf") kinds.push("PDF版");
  return Array.from(new Set(kinds));
}

function normalizeCity(city, region) {
  if (!city) {
    return null;
  }

  let value = normalizeSpaces(city)
    .replace(/^[-_:：,，、·]+/, "")
    .replace(/[-_:：,，、·]+$/, "")
    .replace(/^(各市|各地市|地区|地市|全省|全市|省卷|市卷)/, "")
    .replace(/(地区卷|地市卷|各市卷|各地市卷|地区试卷|地区试题|地市试卷|地市试题|试卷|试题|真题|中考|统考|学业水平考试).*$/g, "")
    .replace(new RegExp(`(${SUBJECT_PATTERN}).*$`), "")
    .replace(/（.*$/, "")
    .replace(/\(.*$/, "")
    .trim();

  if (region && value.startsWith(region)) {
    value = value.slice(region.length).trim();
  }

  if (!value || /^(省|市|各市|各地市|地区|地市|全省|全市)$/.test(value)) {
    return null;
  }

  return value;
}

function extractProvinceCityByPattern(text) {
  const normalized = stripDecorators(normalizeBaseName(text));

  const afterYearMatch = normalized.match(
    new RegExp(`(?:19|20)\\d{2}年?(${PROVINCE_PATTERN})(?:省|市|壮族自治区|回族自治区|维吾尔自治区|自治区)?([^（）()]*?)(?:中考|初中学业|学业水平考试|试卷|试题|真题)`)
  );
  if (afterYearMatch) {
    const region = extractProvince(afterYearMatch[1]);
    return { region, city: normalizeCity(afterYearMatch[2], region) };
  }

  const beforeYearMatch = normalized.match(
    new RegExp(`(${PROVINCE_PATTERN})(?:省|市|壮族自治区|回族自治区|维吾尔自治区|自治区)?([^（）()]*?)(?:19|20)\\d{2}年?(?:中考|初中学业|学业水平考试|试卷|试题|真题)`)
  );
  if (beforeYearMatch) {
    const region = extractProvince(beforeYearMatch[1]);
    return { region, city: normalizeCity(beforeYearMatch[2], region) };
  }

  for (const match of normalized.matchAll(/（([^（）]+)卷）/g)) {
    const raw = match[1];
    const region = extractProvince(raw);
    if (!region) {
      continue;
    }
    return { region, city: normalizeCity(raw.replace(region, ""), region) };
  }

  const provinceOnlyMatch = normalized.match(
    new RegExp(`(?:^|——)(${PROVINCE_PATTERN})(?:省|市|壮族自治区|回族自治区|维吾尔自治区|自治区)?([^【（(]*)`)
  );
  if (provinceOnlyMatch) {
    const region = extractProvince(provinceOnlyMatch[1]);
    return { region, city: normalizeCity(provinceOnlyMatch[2], region) };
  }

  return { region: null, city: null };
}

function extractCityWithoutProvince(text) {
  const normalized = stripDecorators(normalizeBaseName(text));
  const year = extractYear(normalized);
  if (year) {
    const beforeYear = normalized.match(
      new RegExp(`^([^（）()+]+?)(?:19|20)\\d{2}年?(?:中考|初中学业|学业水平考试|${SUBJECT_PATTERN}|试卷|试题|真题)`)
    );
    if (beforeYear) {
      return normalizeCity(beforeYear[1], null);
    }

    const withoutYear = normalized.slice(normalized.indexOf(year) + year.length).replace(/^年/, "");
    const match = withoutYear.match(
      new RegExp(`^([^（）()+]+?)(?:中考|初中学业|学业水平考试|${SUBJECT_PATTERN}|试卷|试题|真题)`)
    );
    if (match) {
      return normalizeCity(match[1], null);
    }
  }

  const labelOnlyMatch = normalized.match(
    new RegExp(`(?:^|——)([^【（(]+?)(?:省|市|州|地区|经济区)?$`)
  );
  return normalizeCity(labelOnlyMatch?.[1] || "", null);
}

function extractProvinceCityFromPath(relativePath) {
  const segments = relativePath.split(path.sep);
  for (const segment of segments.slice(1, -1)) {
    const region = extractProvince(segment);
    if (region) {
      const cityCandidate = normalizeCity(
        segment
          .replace(/^\d+/, "")
          .replace(region, "")
          .replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|省|市/g, ""),
        region
      );
      return { region, city: cityCandidate };
    }

    for (const city of CITY_HINTS) {
      if (segment.includes(city)) {
        return {
          region: DIRECT_CITY_REGION_MAP.get(city) || null,
          city,
        };
      }
    }
  }

  return { region: null, city: null };
}

function resolveLocation(relativePath, baseName) {
  const fileLocation = extractProvinceCityByPattern(baseName);
  const pathLocation = extractProvinceCityFromPath(relativePath);

  const region = fileLocation.region || pathLocation.region;
  let city = fileLocation.city || extractCityWithoutProvince(baseName) || pathLocation.city;
  city = normalizeCity(city, region);

  if (!region && city && DIRECT_CITY_REGION_MAP.has(city)) {
    return { region: DIRECT_CITY_REGION_MAP.get(city), city };
  }

  if (region === "新疆" && /兵团/.test(baseName) && !city) {
    return { region, city: "生产建设兵团" };
  }

  return { region, city };
}

function buildCityRegionIndex(rootDir, files) {
  const cityRegionSets = new Map();

  for (const fullPath of files) {
    const ext = path.extname(fullPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      continue;
    }

    const relativePath = path.relative(rootDir, fullPath);
    const rawBaseName = path.basename(fullPath, ext);
    const baseName = stripDecorators(normalizeBaseName(rawBaseName));
    const fileLocation = extractProvinceCityByPattern(baseName);
    const pathLocation = extractProvinceCityFromPath(relativePath);
    const region = fileLocation.region || pathLocation.region;
    const city = normalizeCity(fileLocation.city || pathLocation.city, region);

    if (!region || !city) {
      continue;
    }

    const regionSet = cityRegionSets.get(city) || new Set();
    regionSet.add(region);
    cityRegionSets.set(city, regionSet);
  }

  const cityRegionIndex = new Map(DIRECT_CITY_REGION_MAP);
  for (const [city, regions] of cityRegionSets.entries()) {
    if (regions.size === 1) {
      cityRegionIndex.set(city, Array.from(regions)[0]);
    }
  }

  return cityRegionIndex;
}

function extractPaperVariant(baseName) {
  const match = stripDecorators(baseName).match(/([AB])卷/);
  return match ? `${match[1]}卷` : null;
}

function buildSummary(title, kinds, fileCount) {
  const parts = kinds.length > 0 ? kinds.join("、") : "资料文件";
  return `${title}，收录 ${parts}，共 ${fileCount} 个文件。`;
}

function stableHash(text) {
  return createHash("sha1").update(text).digest("hex");
}

function buildDisplayLocation(region, city) {
  if (!region) {
    return city || "";
  }
  return city ? `${region}${city}` : region;
}

function createResourceRecord(group) {
  const hash = stableHash(group.key);
  const location = buildDisplayLocation(group.region, group.city);
  const variantSuffix = group.paperVariant ? `（${group.paperVariant}）` : "";
  const title = `${group.year}年${location}中考${group.subject}真题${variantSuffix}`;
  const tags = Array.from(new Set([
    "中考",
    "中考真题",
    group.subject,
    group.year ? `${group.year}中考` : null,
    group.region,
    group.city,
    group.paperVariant,
  ].filter(Boolean)));
  const meta = {
    subject: group.subject,
    year: group.year,
    region: group.region,
    applicable_regions: [group.region],
    ...(group.city ? { city: group.city } : {}),
    ...(group.paperVariant ? { paper_variant: group.paperVariant } : {}),
    ...(group.kinds.length > 0 ? { content_kinds: group.kinds } : {}),
  };

  return {
    id: `res_zhongkao_${hash.slice(0, 16)}`,
    slug: `zhongkao-zhenti-${hash.slice(0, 16)}`,
    title,
    summary: buildSummary(title, group.kinds, group.files.length),
    category: CATEGORY_NAME,
    channel_id: CHANNEL_ID,
    category_id: CATEGORY_ID,
    topic_id: TOPIC_ID,
    tags,
    cover: DEFAULT_COVER,
    quark_url: null,
    extract_code: null,
    publish_status: "published",
    published_at: `${group.year || "2024"}-06-15T00:00:00.000Z`,
    updated_at: new Date().toISOString(),
    meta,
    files: group.files,
    kinds: group.kinds,
  };
}

function ensureTopic(connection) {
  return connection.execute(
    `INSERT INTO topics (id, category_id, name, slug, summary, download_url, sort_order, featured, status, field_schema)
     VALUES (?, ?, ?, ?, ?, NULL, 0, 1, 'active', ?)
     ON DUPLICATE KEY UPDATE
       category_id = VALUES(category_id),
       name = VALUES(name),
       slug = VALUES(slug),
       summary = VALUES(summary),
       featured = VALUES(featured),
       status = VALUES(status),
       field_schema = VALUES(field_schema)`,
    [TOPIC_ID, CATEGORY_ID, TOPIC_NAME, TOPIC_SLUG, TOPIC_SUMMARY, JSON.stringify(TOPIC_FIELD_SCHEMA)]
  );
}

function buildGroups(rootDir) {
  const groups = new Map();
  const skipped = [];
  const files = walkFiles(rootDir);
  const cityRegionIndex = buildCityRegionIndex(rootDir, files);

  for (const fullPath of files) {
    const ext = path.extname(fullPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      continue;
    }

    const relativePath = path.relative(rootDir, fullPath);
    const subject = extractSubject(relativePath);
    if (!subject) {
      skipped.push({ relativePath, reason: "无法识别科目" });
      continue;
    }

    const rawBaseName = path.basename(fullPath, ext);
    const baseName = stripDecorators(normalizeBaseName(rawBaseName));
    const year = extractYear(baseName) || extractYearFromPath(relativePath);
    if (!year) {
      skipped.push({ relativePath, reason: "无法识别年份" });
      continue;
    }
    if (Number(year) < MIN_YEAR || Number(year) > MAX_YEAR) {
      skipped.push({ relativePath, reason: "超出年份范围" });
      continue;
    }

    const { region: rawRegion, city: rawCity } = resolveLocation(relativePath, baseName);
    const city = normalizeCity(rawCity, rawRegion);
    const region = rawRegion || (city ? cityRegionIndex.get(city) || null : null);
    if (!region || !PROVINCE_SET.has(region)) {
      skipped.push({ relativePath, reason: "无法识别地区" });
      continue;
    }

    const paperVariant = extractPaperVariant(baseName);
    const key = [subject, year, region, city || "", paperVariant || ""].join("||");
    const group = groups.get(key) || {
      key,
      subject,
      year,
      region,
      city,
      paperVariant,
      files: [],
      kindSet: new Set(),
    };

    group.files.push(relativePath);
    for (const kind of detectKinds(baseName, ext)) {
      group.kindSet.add(kind);
    }
    groups.set(key, group);
  }

  const records = Array.from(groups.values())
    .map((group) => ({
      ...group,
      kinds: KIND_ORDER.filter((kind) => group.kindSet.has(kind)),
    }))
    .sort((a, b) => {
      const yearDelta = Number(b.year) - Number(a.year);
      if (yearDelta !== 0) return yearDelta;
      const regionDelta = a.region.localeCompare(b.region, "zh-CN");
      if (regionDelta !== 0) return regionDelta;
      const cityDelta = String(a.city || "").localeCompare(String(b.city || ""), "zh-CN");
      if (cityDelta !== 0) return cityDelta;
      return a.subject.localeCompare(b.subject, "zh-CN");
    })
    .map(createResourceRecord);

  return { resources: records, skipped, scannedFileCount: files.length };
}

async function clearExistingTopicResources(connection) {
  const [rows] = await connection.query(
    `SELECT resource_id FROM resource_topics WHERE topic_id = ?`,
    [TOPIC_ID]
  );
  const resourceIds = rows.map((row) => row.resource_id);
  if (resourceIds.length === 0) {
    return 0;
  }

  const placeholders = resourceIds.map(() => "?").join(", ");
  await connection.execute(`DELETE FROM resources WHERE id IN (${placeholders})`, resourceIds);
  return resourceIds.length;
}

async function insertResources(connection, resources) {
  let resourceCount = 0;
  let tagCount = 0;

  for (const resource of resources) {
    await connection.execute(
      `INSERT INTO resources (
        id, title, slug, summary, category, channel_id, category_id, cover, quark_url,
        extract_code, publish_status, published_at, updated_at, meta
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
        meta = VALUES(meta)`,
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
        resource.published_at.slice(0, 19).replace("T", " "),
        resource.updated_at.slice(0, 19).replace("T", " "),
        JSON.stringify(resource.meta),
      ]
    );

    await connection.execute("DELETE FROM resource_tags WHERE resource_id = ?", [resource.id]);
    await connection.execute("DELETE FROM resource_topics WHERE resource_id = ?", [resource.id]);

    for (const [index, tag] of resource.tags.entries()) {
      await connection.execute(
        `INSERT INTO resource_tags (resource_id, tag_name, tag_slug, sort_order)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           tag_name = VALUES(tag_name),
           sort_order = VALUES(sort_order)`,
        [resource.id, tag, slugify(tag), index]
      );
      tagCount += 1;
    }

    await connection.execute(
      `INSERT INTO resource_topics (resource_id, topic_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE topic_id = VALUES(topic_id)`,
      [resource.id, resource.topic_id]
    );

    resourceCount += 1;
  }

  return { resourceCount, tagCount };
}

function writeManifest(resources, skipped) {
  const missingCityCount = resources.filter((resource) => !resource.meta.city).length;
  const yearRegionCombos = new Set(
    resources.map((resource) => `${resource.meta.year}||${resource.meta.region}`)
  ).size;

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        root_dir: ROOT_DIR,
        resource_count: resources.length,
        skipped_count: skipped.length,
        stats: {
          missing_city_count: missingCityCount,
          year_region_combo_count: yearRegionCombos,
          subject_count: new Set(resources.map((resource) => resource.meta.subject)).size,
          region_count: sortRegions(resources.map((resource) => resource.meta.region)).length,
        },
        resources,
        skipped,
      },
      null,
      2
    )
  );
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

if (!fs.existsSync(ROOT_DIR)) {
  throw new Error(`目录不存在: ${ROOT_DIR}`);
}

const { resources, skipped, scannedFileCount } = buildGroups(ROOT_DIR);
writeManifest(resources, skipped);

console.log(`Scanned ${scannedFileCount} files.`);
console.log(`Prepared ${resources.length} resources.`);
console.log(`Skipped ${skipped.length} files.`);
console.log(`Manifest written to ${MANIFEST_PATH}`);

if (!SHOULD_EXECUTE) {
  console.log("Dry run only. Re-run with --execute to import into database.");
} else {
  const connection = await mysql.createConnection({
    host: required("DB_HOST"),
    port: Number.parseInt(process.env.DB_PORT || "3306", 10),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD || "",
    database: required("DB_NAME"),
    charset: "utf8mb4",
    timezone: "Z",
  });

  try {
    await connection.beginTransaction();
    await ensureTopic(connection);

    const deletedCount = KEEP_EXISTING ? 0 : await clearExistingTopicResources(connection);
    const { resourceCount, tagCount } = await insertResources(connection, resources);

    await connection.commit();

    console.log(`Deleted ${deletedCount} existing zhongkao-topic resources.`);
    console.log(`Imported ${resourceCount} resources with ${tagCount} tags.`);
    console.log(`Topic ensured: ${TOPIC_NAME} (${TOPIC_SLUG})`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}
