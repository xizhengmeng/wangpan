import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const outputPath = path.join(dataDir, "exam-collections.json");

function readJson(fileName, fallback) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return fallback;
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
    subjects: sortZh(unique(resources.map((resource) => resource.meta?.subject || ""))),
    years: sortYears(unique(resources.map((resource) => resource.meta?.year || ""))),
    regions: sortZh(
      unique(
        resources.flatMap((resource) =>
          Array.isArray(resource.meta?.applicable_regions) && resource.meta.applicable_regions.length > 0
            ? resource.meta.applicable_regions
            : resource.meta?.region
              ? [resource.meta.region]
              : []
        )
      )
    ),
    paper_versions: sortZh(unique(resources.map((resource) => resource.meta?.paper_version || ""))),
    cities: sortZh(unique(resources.map((resource) => resource.meta?.city || ""))),
  };
}

function createCollection({
  examSlug,
  collectionType,
  title,
  summary,
  filters,
  resources,
}) {
  const facets = summarizeFacets(resources);
  const slugParts = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key, value]) => (typeof value === "boolean" ? key : String(value)));
  return {
    id: `${examSlug}:${collectionType}:${slugify(JSON.stringify(filters))}`,
    slug: `${examSlug}-${collectionType}-${slugify(slugParts.join("-"))}`,
    exam_slug: examSlug,
    collection_type: collectionType,
    title,
    summary,
    resource_count: resources.length,
    subject_count: facets.subjects.length,
    year_count: facets.years.length,
    lastmod: getLastmod(resources),
    filters,
    facets,
    resource_slugs: resources.map((resource) => resource.slug),
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
    const subject = resource.meta?.subject;
    if (!subject) return [];
    return [{ key: `subject:${subject}`, filters: { subject } }];
  });
  for (const { filters, resources: list } of bySubject.values()) {
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "subject-history",
        title: `${filters.subject}历年高考真题合集`,
        summary: `汇总历年${filters.subject}高考真题资源，支持按年份、地区和卷别继续筛选，适合高考复习和专题刷题。`,
        filters,
        resources: list,
      })
    );
  }

  const byPaperVersion = buildGroupedCollections(resources, (resource) => {
    const paperVersion = resource.meta?.paper_version;
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
        summary: `汇总${filters.paper_version}下的高考真题资源，可查看不同年份和科目的试卷版本，适合做卷别对照和专项整理。`,
        filters,
        resources: list,
      })
    );
  }

  const bySubjectPaperVersion = buildGroupedCollections(resources, (resource) => {
    const subject = resource.meta?.subject;
    const paperVersion = resource.meta?.paper_version;
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
        summary: `汇总${filters.subject}${filters.paper_version}的历年高考真题，适合做同卷别同科目的纵向刷题与版本对照。`,
        filters,
        resources: list,
      })
    );
  }

  const byYearRegion = buildGroupedCollections(resources, (resource) => {
    const year = resource.meta?.year;
    const regions = Array.isArray(resource.meta?.applicable_regions) && resource.meta.applicable_regions.length > 0
      ? resource.meta.applicable_regions
      : resource.meta?.region
        ? [resource.meta.region]
        : [];
    if (!year || regions.length === 0) return [];
    return regions.map((region) => ({
      key: `year-region:${year}:${region}`,
      filters: { year, region, all_subjects: true },
    }));
  });
  for (const { filters, resources: list } of byYearRegion.values()) {
    const subjectCount = new Set(list.map((item) => item.meta?.subject).filter(Boolean)).size;
    if (list.length < 8 || subjectCount < 5) continue;
    collections.push(
      createCollection({
        examSlug: "gaokaozhenti",
        collectionType: "year-region",
        title: `${filters.year}年${filters.region}高考真题合集`,
        summary: `汇总${filters.year}年${filters.region}高考所有已收录科目真题，适合按年份查看同地区语数英及选考科目资源。`,
        filters,
        resources: list,
      })
    );
  }

  const byRegionSubject = buildGroupedCollections(resources, (resource) => {
    const subject = resource.meta?.subject;
    const regions = Array.isArray(resource.meta?.applicable_regions) && resource.meta.applicable_regions.length > 0
      ? resource.meta.applicable_regions
      : resource.meta?.region
        ? [resource.meta.region]
        : [];
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
        summary: `汇总${filters.region}${filters.subject}历年高考真题，适合查看同省份同科目的命题变化和阶段复习资料。`,
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
    const subject = resource.meta?.subject;
    if (!subject) return [];
    return [{ key: `subject:${subject}`, filters: { subject } }];
  });
  for (const { filters, resources: list } of bySubject.values()) {
    collections.push(
      createCollection({
        examSlug: "zhongkaozhenti",
        collectionType: "subject-history",
        title: `${filters.subject}历年中考真题合集`,
        summary: `汇总历年${filters.subject}中考真题资源，支持继续按地区和年份筛选，适合中考总复习与专题训练。`,
        filters,
        resources: list,
      })
    );
  }

  const byYearRegion = buildGroupedCollections(resources, (resource) => {
    const year = resource.meta?.year;
    const regions = Array.isArray(resource.meta?.applicable_regions) && resource.meta.applicable_regions.length > 0
      ? resource.meta.applicable_regions
      : resource.meta?.region
        ? [resource.meta.region]
        : [];
    if (!year || regions.length === 0) return [];
    return regions.map((region) => ({
      key: `year-region:${year}:${region}`,
      filters: { year, region, all_subjects: true },
    }));
  });
  for (const { filters, resources: list } of byYearRegion.values()) {
    const subjectCount = new Set(list.map((item) => item.meta?.subject).filter(Boolean)).size;
    if (list.length < 8 || subjectCount < 5) continue;
    collections.push(
      createCollection({
        examSlug: "zhongkaozhenti",
        collectionType: "year-region",
        title: `${filters.year}年${filters.region}中考真题合集`,
        summary: `汇总${filters.year}年${filters.region}中考所有已收录科目真题，适合按年份集中查看该地区中考资源。`,
        filters,
        resources: list,
      })
    );
  }

  const byRegionSubject = buildGroupedCollections(resources, (resource) => {
    const subject = resource.meta?.subject;
    const regions = Array.isArray(resource.meta?.applicable_regions) && resource.meta.applicable_regions.length > 0
      ? resource.meta.applicable_regions
      : resource.meta?.region
        ? [resource.meta.region]
        : [];
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
        summary: `汇总${filters.region}${filters.subject}历年中考真题，适合查看同地区同科目的命题变化、解析资源和阶段刷题资料。`,
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
    ["paper-version", 2],
    ["subject-paper-version", 3],
    ["year-region", 4],
    ["region-subject", 5],
  ]);

  return [...collections].sort((a, b) => {
    if (a.exam_slug !== b.exam_slug) return a.exam_slug.localeCompare(b.exam_slug, "zh-CN");
    const typeDelta = (typeOrder.get(a.collection_type) || 99) - (typeOrder.get(b.collection_type) || 99);
    if (typeDelta !== 0) return typeDelta;
    if (b.resource_count !== a.resource_count) return b.resource_count - a.resource_count;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

const gaokaoManifest = readJson("gaokao-zhenti-manifest.json", { resources: [] });
const zhongkaoManifest = readJson("zhongkao-zhenti-manifest.json", { resources: [] });

const gaokaoCollections = buildGaokaoCollections(gaokaoManifest.resources || []);
const zhongkaoCollections = buildZhongkaoCollections(zhongkaoManifest.resources || []);
const collections = sortCollections([...gaokaoCollections, ...zhongkaoCollections]);

const payload = {
  generated_at: new Date().toISOString(),
  stats: {
    gaokaozhenti: {
      total: gaokaoCollections.length,
      by_type: gaokaoCollections.reduce((acc, item) => {
        acc[item.collection_type] = (acc[item.collection_type] || 0) + 1;
        return acc;
      }, {}),
    },
    zhongkaozhenti: {
      total: zhongkaoCollections.length,
      by_type: zhongkaoCollections.reduce((acc, item) => {
        acc[item.collection_type] = (acc[item.collection_type] || 0) + 1;
        return acc;
      }, {}),
    },
  },
  collections,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  `Generated exam collections: gaokao=${gaokaoCollections.length}, zhongkao=${zhongkaoCollections.length}, total=${collections.length}`
);
