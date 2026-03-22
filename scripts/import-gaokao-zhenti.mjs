import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import mysql from 'mysql2/promise';

const ROOT_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : '/Users/k12/Downloads/《35年全国高考真题大合集》1990-2025';
const SHOULD_EXECUTE = process.argv.includes('--execute');
const KEEP_EXISTING = process.argv.includes('--keep-existing');
const MANIFEST_PATH = path.join(process.cwd(), 'data', 'gaokao-zhenti-manifest.json');

const CHANNEL_ID = 'channel_education_exam';
const CATEGORY_ID = 'cat_high_school';
const CATEGORY_NAME = '高中';
const TOPIC_ID = 'topic_b624b085bb4d';
const TOPIC_SLUG = 'gaokaozhenti';
const TOPIC_NAME = '高考真题';
const TOPIC_SUMMARY = '汇总 1990-2025 全国高考真题，支持按科目、年份和地区筛选。';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80';
const ALLOWED_EXTENSIONS = new Set(['.doc', '.docx', '.mp3']);
const KIND_ORDER = ['空白卷', '解析卷', '答案卷', '听力音频'];
const SUBJECT_TAG_FALLBACK = '高考真题';
const TOPIC_FIELD_SCHEMA = [
  { key: 'subject', label: '科目', type: 'text' },
  { key: 'year', label: '年份', type: 'text' },
  { key: 'region', label: '地区', type: 'text' },
];
const PROVINCES = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建',
  '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆',
];
const PROVINCE_SET = new Set(PROVINCES);
const PROVINCE_INDEX = new Map(PROVINCES.map((province, index) => [province, index]));
const SESSION_ALIASES = new Map([
  ['1月', '1月'],
  ['一月', '1月'],
  ['6月', '6月'],
  ['六月', '6月'],
  ['春考', '春考'],
  ['秋考', '秋考'],
]);
const STREAM_ALIASES = new Map([
  ['文', '文科'],
  ['文科', '文科'],
  ['理', '理科'],
  ['理科', '理科'],
]);
const COMBINED_REGION_MAP = new Map([
  ['黑吉辽蒙卷', '黑龙江·吉林·辽宁·内蒙古'],
  ['陕晋青宁卷', '陕西·山西·青海·宁夏'],
]);
const PAPER_VERSION_ALIASES = [
  [/^全国甲(卷)?$/, '全国甲卷'],
  [/^全国乙(卷)?$/, '全国乙卷'],
  [/^甲卷$/, '全国甲卷'],
  [/^乙卷$/, '全国乙卷'],
  [/^全国(?:一|1|I)卷$/, '全国I卷'],
  [/^全国(?:二|2|II)卷$/, '全国II卷'],
  [/^全国(?:三|3|III)卷$/, '全国III卷'],
  [/^全国卷I$/, '全国I卷'],
  [/^全国卷II$/, '全国II卷'],
  [/^全国卷III$/, '全国III卷'],
  [/^新高考(?:一|1|I)卷$/, '新高考I卷'],
  [/^新高考(?:二|2|II)卷$/, '新高考II卷'],
  [/^新课标(?:一|1|I)$/, '新课标I卷'],
  [/^新课标(?:二|2|II)$/, '新课标II卷'],
  [/^新课标(?:三|3|III)$/, '新课标III卷'],
  [/^新课标$/, '新课标卷'],
  [/^全国新课标卷$/, '新课标卷'],
  [/^大纲版$/, '大纲版'],
  [/^全国卷$/, '全国卷'],
  [/^黑吉辽蒙卷$/, '黑吉辽蒙卷'],
  [/^陕晋青宁卷$/, '陕晋青宁卷'],
  [/^自主命题$/, '自主命题'],
];
const YEAR_2025_NEW_GAOKAO_I = new Set(['浙江', '江苏', '山东', '广东', '河北', '福建', '湖北', '湖南', '河南', '江西', '安徽']);
const YEAR_2025_NEW_GAOKAO_II = new Set(['辽宁', '重庆', '海南', '山西', '云南', '贵州', '黑龙江', '吉林', '甘肃', '广西', '西藏', '新疆', '四川', '陕西', '内蒙古', '宁夏', '青海']);

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeQualifier(text) {
  return normalizeSpaces(text)
    .replace(/[Ⅰ]/g, 'I')
    .replace(/[Ⅱ]/g, 'II')
    .replace(/[Ⅲ]/g, 'III')
    .replace(/[_-]?回忆版/g, '')
    .replace(/（/g, '')
    .replace(/）/g, '');
}

function splitRegionLabel(value) {
  return normalizeSpaces(String(value || ''))
    .split(/[·、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortRegions(regions) {
  return Array.from(new Set(regions))
    .filter(Boolean)
    .sort((a, b) => {
      const aIndex = PROVINCE_INDEX.has(a) ? PROVINCE_INDEX.get(a) : Number.MAX_SAFE_INTEGER;
      const bIndex = PROVINCE_INDEX.has(b) ? PROVINCE_INDEX.get(b) : Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.localeCompare(b, 'zh-CN');
    });
}

function isCanonicalFile(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  const ext = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return false;
  }
  if (normalized.includes('/版本1：') || normalized.includes('/版本2：')) {
    return false;
  }
  return normalized.includes('/版本3：') || normalized.includes('/【旧】');
}

function isProvinceViewFile(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  const ext = path.extname(normalized).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) && normalized.includes('/版本2：');
}

function extractSubject(relativePath) {
  const firstSegment = relativePath.split(path.sep)[0] || '';
  const match = firstSegment.match(/^高考(.+?)《/);
  return match ? match[1] : null;
}

function detectKinds(baseName) {
  const kinds = [];
  if (baseName.includes('空白卷')) kinds.push('空白卷');
  if (baseName.includes('解析卷')) kinds.push('解析卷');
  if (baseName.includes('答案卷')) kinds.push('答案卷');
  if (baseName.includes('听力音频')) kinds.push('听力音频');
  return kinds;
}

function normalizeBaseName(fileName) {
  let name = normalizeSpaces(fileName);
  name = name.replace(/【([^】]+)】/g, '（$1）');
  name = name.replace(/\s*（/g, '（').replace(/）\s*/g, '）');
  name = name.replace(/高考(.+?)(真题|试卷)/g, (_all, subject) => `高考${subject}试卷`);
  return normalizeSpaces(name);
}

function stripKinds(baseName) {
  return normalizeSpaces(
    baseName
      .replace(/（空白卷）/g, '')
      .replace(/（解析卷）/g, '')
      .replace(/（答案卷）/g, '')
      .replace(/听力音频/g, '')
  );
}

function extractProvinceFromText(text) {
  const normalized = normalizeQualifier(text);
  for (const province of PROVINCES) {
    if (normalized === province || normalized.startsWith(province)) {
      return province;
    }
  }
  return null;
}

function extractYear(baseName) {
  const match = baseName.match(/(19|20)\d{2}(?=年)/);
  return match ? match[0] : null;
}

function extractQualifiers(baseName) {
  return Array.from(baseName.matchAll(/（([^）]+)）/g))
    .map((match) => normalizeQualifier(match[1]))
    .flatMap((item) => item.split(/[，,、]/).map((part) => normalizeQualifier(part)).filter(Boolean))
    .filter((item) => item && !KIND_ORDER.includes(item));
}

function normalizePaperVersion(raw) {
  const value = normalizeQualifier(raw);
  for (const [pattern, output] of PAPER_VERSION_ALIASES) {
    if (pattern.test(value)) {
      return output;
    }
  }

  if (PROVINCE_SET.has(value)) {
    return `${value}卷`;
  }
  if (PROVINCE_SET.has(value.replace(/卷$/, ''))) {
    return `${value.replace(/卷$/, '')}卷`;
  }

  return value || null;
}

function inferPaperVersionFromProvince(province, year) {
  if (['北京', '天津', '上海', '浙江'].includes(province)) {
    return `${province}卷`;
  }

  if (Number(year) === 2025) {
    if (YEAR_2025_NEW_GAOKAO_I.has(province)) {
      return '新高考I卷';
    }
    if (YEAR_2025_NEW_GAOKAO_II.has(province)) {
      return '新高考II卷';
    }
  }

  return `${province}卷`;
}

function extractProvinceFromTitle(title) {
  const afterYear = title.match(new RegExp(`^(?:19|20)\\d{2}年(${PROVINCES.join('|')})(?:自治区)?`));
  if (afterYear) {
    return afterYear[1];
  }

  const beforeYear = title.match(new RegExp(`^(${PROVINCES.join('|')})(?:自治区)?(?:19|20)\\d{2}年`));
  return beforeYear ? beforeYear[1] : null;
}

function extractProvinceFromProvinceViewPath(relativePath) {
  for (const segment of relativePath.split(path.sep)) {
    const match = segment.match(/（([^）]+)）/);
    if (!match) {
      continue;
    }
    const province = extractProvinceFromText(match[1]);
    if (province) {
      return province;
    }
  }
  return null;
}

function classifyQualifiers(qualifiers, year) {
  let session = null;
  let stream = null;
  let paperVersion = null;
  let region = null;

  for (const qualifier of qualifiers) {
    const embeddedSession = qualifier.match(/^(.+?)(1月|6月|春考|秋考)(卷)?$/);
    if (embeddedSession) {
      const provinceCandidate = embeddedSession[1].replace(/卷$/, '');
      const normalizedSession = SESSION_ALIASES.get(embeddedSession[2]) || embeddedSession[2];
      if (PROVINCE_SET.has(provinceCandidate)) {
        region = provinceCandidate;
        session = normalizedSession;
        if (!paperVersion) {
          paperVersion = inferPaperVersionFromProvince(provinceCandidate, year);
        }
        continue;
      }
    }

    if (!session && SESSION_ALIASES.has(qualifier)) {
      session = SESSION_ALIASES.get(qualifier);
      continue;
    }

    if (!stream && STREAM_ALIASES.has(qualifier)) {
      stream = STREAM_ALIASES.get(qualifier);
      continue;
    }

    if (COMBINED_REGION_MAP.has(qualifier)) {
      paperVersion = normalizePaperVersion(qualifier);
      region = COMBINED_REGION_MAP.get(qualifier);
      continue;
    }

    const provinceCandidate = extractProvinceFromText(qualifier.replace(/卷$/, ''));
    if (PROVINCE_SET.has(provinceCandidate)) {
      region = provinceCandidate;
      if (!paperVersion) {
        paperVersion = inferPaperVersionFromProvince(provinceCandidate, year);
      }
      continue;
    }

    const normalizedVersion = normalizePaperVersion(qualifier);
    if (normalizedVersion && !paperVersion) {
      paperVersion = normalizedVersion;
    }
  }

  return {
    paperVersion,
    region,
    session,
    stream,
  };
}

function buildProvinceHintIndex(rootDir, files) {
  const hints = new Map();

  for (const fullPath of files) {
    const relativePath = path.relative(rootDir, fullPath);
    if (!isProvinceViewFile(relativePath)) {
      continue;
    }

    const subject = extractSubject(relativePath);
    const province = extractProvinceFromProvinceViewPath(relativePath);
    if (!subject || !province) {
      continue;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const rawBaseName = path.basename(fullPath, ext);
    const normalizedBaseName = normalizeBaseName(rawBaseName);
    const title = stripKinds(normalizedBaseName);
    if (!extractYear(title)) {
      continue;
    }

    const key = `${subject}||${title}`;
    const provinceSet = hints.get(key) || new Set();
    provinceSet.add(province);
    hints.set(key, provinceSet);
  }

  return hints;
}

function resolveApplicableRegions(group, provinceHints) {
  const regions = [];
  const titleProvince = extractProvinceFromTitle(group.title);
  if (titleProvince) {
    regions.push(titleProvince);
  }

  if (group.region) {
    regions.push(...splitRegionLabel(group.region));
  }

  if (group.paperVersion) {
    const paperProvince = extractProvinceFromText(group.paperVersion);
    if (paperProvince) {
      regions.push(paperProvince);
    }
  }

  if (provinceHints?.size) {
    regions.push(...provinceHints);
  }

  return sortRegions(regions);
}

function backfillRegionsByPaperVersion(records) {
  const regionsByVersion = new Map();

  for (const record of records) {
    if (!record.paperVersion || !record.year || !record.applicableRegions?.length) {
      continue;
    }

    const key = `${record.year}||${record.paperVersion}`;
    const regionSet = regionsByVersion.get(key) || new Set();
    for (const region of record.applicableRegions) {
      regionSet.add(region);
    }
    regionsByVersion.set(key, regionSet);
  }

  return records.map((record) => {
    if (record.applicableRegions?.length || !record.paperVersion || !record.year) {
      return record;
    }

    const key = `${record.year}||${record.paperVersion}`;
    const fallbackRegions = sortRegions(Array.from(regionsByVersion.get(key) || []));
    if (fallbackRegions.length === 0) {
      return record;
    }

    return {
      ...record,
      applicableRegions: fallbackRegions,
      region: fallbackRegions.length === 1 ? fallbackRegions[0] : null,
    };
  });
}

function buildSummary(title, kinds, fileCount) {
  const parts = kinds.length > 0 ? kinds.join('、') : '资料文件';
  return `${title}，收录 ${parts}，共 ${fileCount} 个文件。`;
}

function stableHash(text) {
  return createHash('sha1').update(text).digest('hex');
}

function createResourceRecord(group) {
  const hash = stableHash(group.key);
  const title = group.title;
  const applicableRegions = sortRegions(group.applicableRegions || []);
  const tags = Array.from(new Set([
    '高考',
    SUBJECT_TAG_FALLBACK,
    group.subject,
    group.year ? `${group.year}高考` : null,
    group.paperVersion,
    ...applicableRegions,
    group.session,
    group.stream,
  ].filter(Boolean)));
  const meta = {
    subject: group.subject,
    ...(group.year ? { year: group.year } : {}),
    ...(group.paperVersion ? { paper_version: group.paperVersion } : {}),
    ...(applicableRegions.length === 1 ? { region: applicableRegions[0] } : {}),
    ...(applicableRegions.length > 0 ? { applicable_regions: applicableRegions } : {}),
    ...(group.session ? { session: group.session } : {}),
    ...(group.stream ? { stream: group.stream } : {}),
  };

  return {
    id: `res_gaokao_${hash.slice(0, 16)}`,
    slug: `gaokao-zhenti-${hash.slice(0, 16)}`,
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
    publish_status: 'published',
    published_at: `${group.year || '2008'}-06-07T00:00:00.000Z`,
    updated_at: new Date().toISOString(),
    meta,
    files: group.files,
    kinds: group.kinds,
  };
}

function ensureTopicAndCategory(connection) {
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
  const provinceHintIndex = buildProvinceHintIndex(rootDir, files);

  for (const fullPath of files) {
    const relativePath = path.relative(rootDir, fullPath);
    if (!isCanonicalFile(relativePath)) {
      continue;
    }

    const subject = extractSubject(relativePath);
    if (!subject) {
      skipped.push({ relativePath, reason: '无法识别科目' });
      continue;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const rawBaseName = path.basename(fullPath, ext);
    const normalizedBaseName = normalizeBaseName(rawBaseName);
    const title = stripKinds(normalizedBaseName);
    const year = extractYear(title);
    if (!year) {
      skipped.push({ relativePath, reason: '无法识别年份' });
      continue;
    }

    const qualifiers = extractQualifiers(title);
    const { paperVersion, region, session, stream } = classifyQualifiers(qualifiers, year);
    const key = `${subject}||${title}`;
    const applicableRegions = resolveApplicableRegions(
      { title, paperVersion, region },
      provinceHintIndex.get(key)
    );
    const group = groups.get(key) || {
      key,
      subject,
      year,
      qualifiers,
      paperVersion,
      region: applicableRegions.length === 1 ? applicableRegions[0] : null,
      applicableRegions,
      session,
      stream,
      title,
      files: [],
      kinds: new Set(),
    };

    group.files.push(relativePath);
    for (const kind of detectKinds(normalizedBaseName)) {
      group.kinds.add(kind);
    }

    groups.set(key, group);
  }

  const records = backfillRegionsByPaperVersion(Array.from(groups.values()))
    .map((group) => ({
      ...group,
      kinds: KIND_ORDER.filter((kind) => group.kinds.has(kind)),
    }))
    .sort((a, b) => {
      const yearDelta = Number(b.year) - Number(a.year);
      if (yearDelta !== 0) return yearDelta;
      const regionDelta = String(a.applicableRegions?.[0] || '').localeCompare(String(b.applicableRegions?.[0] || ''), 'zh-CN');
      if (regionDelta !== 0) return regionDelta;
      return a.title.localeCompare(b.title, 'zh-CN');
    })
    .map(createResourceRecord);

  return {
    resources: records,
    skipped,
    scannedFileCount: files.length,
  };
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

  const placeholders = resourceIds.map(() => '?').join(', ');
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
        resource.published_at.slice(0, 19).replace('T', ' '),
        resource.updated_at.slice(0, 19).replace('T', ' '),
        JSON.stringify(resource.meta),
      ]
    );

    await connection.execute('DELETE FROM resource_tags WHERE resource_id = ?', [resource.id]);
    await connection.execute('DELETE FROM resource_topics WHERE resource_id = ?', [resource.id]);

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
  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        root_dir: ROOT_DIR,
        resource_count: resources.length,
        skipped_count: skipped.length,
        resources,
        skipped,
      },
      null,
      2
    )
  );
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

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
  console.log('Dry run only. Re-run with --execute to import into database.');
} else {
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
  await ensureTopicAndCategory(connection);

  const deletedCount = KEEP_EXISTING ? 0 : await clearExistingTopicResources(connection);
  const { resourceCount, tagCount } = await insertResources(connection, resources);

  await connection.commit();

  console.log(`Deleted ${deletedCount} existing gaokao-topic resources.`);
  console.log(`Imported ${resourceCount} resources with ${tagCount} tags.`);
  console.log(`Topic ensured: ${TOPIC_NAME} (${TOPIC_SLUG})`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}
