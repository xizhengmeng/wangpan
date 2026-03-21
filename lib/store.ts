import fs from "node:fs";
import path from "node:path";

import { summarizeEvents } from "@/lib/analytics";
import { slugify } from "@/lib/format";
import { searchResources } from "@/lib/search";
import {
  CategoryNode,
  Channel,
  ContentStructure,
  CsvImportResult,
  Feedback,
  FeedbackReason,
  PublishStatus,
  Resource,
  SearchResponse,
  TrackEvent
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const resourceFile = path.join(dataDir, "resources.json");
const eventsFile = path.join(dataDir, "events.jsonl");
const feedbackFile = path.join(dataDir, "feedback.jsonl");
const contentStructureFile = path.join(dataDir, "content-structure.json");

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(resourceFile)) {
    fs.writeFileSync(resourceFile, "[]\n");
  }

  if (!fs.existsSync(eventsFile)) {
    fs.writeFileSync(eventsFile, "");
  }

  if (!fs.existsSync(feedbackFile)) {
    fs.writeFileSync(feedbackFile, "");
  }

  if (!fs.existsSync(contentStructureFile)) {
    fs.writeFileSync(
      contentStructureFile,
      JSON.stringify(
        {
          site_profile: {
            name: "",
            tagline: "",
            short_link: "",
            positioning: ""
          },
          channels: [],
          categories: [],
          topics: []
        },
        null,
        2
      ) + "\n"
    );
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureDataFiles();
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDataFiles();
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function getAllResources() {
  return readJsonFile<Resource[]>(resourceFile, []);
}

export function getPublishedResources() {
  return getAllResources()
    .filter((resource) => resource.publish_status === "published")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
}

export function getResourceBySlug(slug: string) {
  return getAllResources().find((resource) => resource.slug === slug) || null;
}

export function getResourceById(id: string) {
  return getAllResources().find((resource) => resource.id === id) || null;
}

export function saveResource(
  input: Omit<Resource, "id" | "updated_at"> & { id?: string }
) {
  const resources = getAllResources();
  const now = new Date().toISOString();
  const slug = slugify(input.slug || input.title);

  const duplicate = resources.find(
    (item) => item.slug === slug && item.id !== input.id
  );
  if (duplicate) {
    throw new Error("slug 已存在");
  }

  if (input.id) {
    const index = resources.findIndex((item) => item.id === input.id);
    if (index === -1) {
      throw new Error("资源不存在");
    }

    const nextResource: Resource = {
      ...resources[index],
      ...input,
      slug,
      updated_at: now
    };
    resources[index] = nextResource;
    writeJsonFile(resourceFile, resources);
    return nextResource;
  }

  const resource: Resource = {
    ...input,
    id: `res_${Date.now().toString(36)}`,
    slug,
    updated_at: now
  };
  resources.unshift(resource);
  writeJsonFile(resourceFile, resources);
  return resource;
}

export function deleteResource(id: string) {
  const resources = getAllResources();
  const nextResources = resources.filter((item) => item.id !== id);
  writeJsonFile(resourceFile, nextResources);
}

export function markResourceStatus(id: string, status: PublishStatus) {
  const resource = getResourceById(id);
  if (!resource) {
    throw new Error("资源不存在");
  }

  return saveResource({
    ...resource,
    id,
    publish_status: status
  });
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isValidHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function importResourcesFromCsv(
  csv: string,
  mode: "insert" | "upsert"
): CsvImportResult {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    throw new Error("CSV 内容为空");
  }

  const header = parseCsvLine(rows[0]);
  const requiredHeaders = [
    "title",
    "slug",
    "summary",
    "category",
    "tags",
    "quark_url",
    "extract_code",
    "publish_status",
    "published_at"
  ];

  const missingHeaders = requiredHeaders.filter((name) => !header.includes(name));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 缺少字段: ${missingHeaders.join(", ")}`);
  }

  let successCount = 0;
  const failures: CsvImportResult["failures"] = [];
  const resources = getAllResources();

  for (let i = 1; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    const values = parseCsvLine(rows[i]);
    const record = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));

    try {
      if (!record.title || !record.slug || !record.summary || !record.category || !record.quark_url) {
        throw new Error("必填字段不能为空");
      }
      if (!isValidHttpUrl(record.quark_url)) {
        throw new Error("夸克链接格式不正确");
      }

      const normalizedTags = record.tags
        .split(/[|,，]/)
        .map((tag: string) => tag.trim())
        .filter(Boolean);

      const existing = resources.find((item) => item.slug === slugify(record.slug));
      if (existing && mode === "insert") {
        throw new Error("slug 已存在");
      }

      const payload = {
        id: existing?.id,
        title: record.title,
        slug: record.slug,
        summary: record.summary,
        category: record.category,
        tags: normalizedTags,
        cover:
          existing?.cover ||
          "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
        quark_url: record.quark_url,
        extract_code: record.extract_code,
        publish_status: (record.publish_status || "draft") as PublishStatus,
        published_at: record.published_at || new Date().toISOString()
      };

      saveResource(payload);
      successCount += 1;
    } catch (error) {
      failures.push({
        row: rowNumber,
        reason: error instanceof Error ? error.message : "导入失败"
      });
    }
  }

  return {
    successCount,
    failureCount: failures.length,
    failures
  };
}

export function recordEvent(event: Omit<TrackEvent, "event_time"> & { event_time?: string }) {
  ensureDataFiles();
  const completeEvent: TrackEvent = {
    ...event,
    event_time: event.event_time || new Date().toISOString()
  };
  fs.appendFileSync(eventsFile, `${JSON.stringify(completeEvent)}\n`, "utf8");
  return completeEvent;
}

export function getEvents() {
  ensureDataFiles();
  const raw = fs.readFileSync(eventsFile, "utf8").trim();
  if (!raw) {
    return [] as TrackEvent[];
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrackEvent);
}

export function getAnalyticsSummary() {
  return summarizeEvents(getEvents());
}

export function getCategoryMap(resources = getPublishedResources()) {
  const map = new Map<string, number>();
  for (const resource of resources) {
    map.set(resource.category, (map.get(resource.category) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, slug: slugify(name), count }));
}

export function getTagMap(resources = getPublishedResources()) {
  const map = new Map<string, number>();
  for (const resource of resources) {
    for (const tag of resource.tags) {
      map.set(tag, (map.get(tag) || 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, slug: slugify(name), count }));
}

export function getResourcesByCategorySlug(slug: string) {
  return getPublishedResources().filter((resource) => slugify(resource.category) === slug);
}

export function getResourcesByTagSlug(slug: string) {
  return getPublishedResources().filter((resource) =>
    resource.tags.some((tag) => slugify(tag) === slug)
  );
}

export function runSearch(query: string, page = 1): SearchResponse {
  return searchResources(getPublishedResources(), query, page);
}

export function getContentStructure() {
  return readJsonFile<ContentStructure>(contentStructureFile, {
    site_profile: {
      name: "",
      tagline: "",
      short_link: "",
      positioning: ""
    },
    channels: [],
    categories: [],
    topics: []
  });
}

export function getFeaturedChannels() {
  return getContentStructure()
    .channels.filter((channel) => channel.status === "active" && channel.featured)
    .sort((a, b) => a.sort - b.sort);
}

export function getCategoriesByChannel(channelId: string) {
  return getContentStructure()
    .categories.filter((category) => category.channel_id === channelId && category.status === "active")
    .sort((a, b) => a.sort - b.sort);
}

export function getFeaturedTopics() {
  return getContentStructure()
    .topics.filter((topic) => topic.status === "active" && topic.featured)
    .sort((a, b) => a.sort - b.sort);
}

export function getTopicBySlug(slug: string) {
  return (
    getContentStructure().topics.find((topic) => topic.slug === slug && topic.status === "active") ||
    null
  );
}

export function getResourcesByChannelId(channelId: string) {
  return getPublishedResources().filter((resource) => resource.channel_id === channelId);
}

export function getResourcesByCategoryId(categoryId: string) {
  return getPublishedResources().filter((resource) => resource.category_id === categoryId);
}

export function getResourcesByTopicId(topicId: string) {
  return getPublishedResources().filter((resource) => resource.topic_ids?.includes(topicId));
}

export function getContentStructureTree() {
  const structure = getContentStructure();
  const categoryMap = new Map<string, CategoryNode[]>();

  for (const category of structure.categories.filter((item) => item.status === "active")) {
    const existing = categoryMap.get(category.channel_id) || [];
    existing.push(category);
    categoryMap.set(category.channel_id, existing);
  }

  return structure.channels
    .filter((channel) => channel.status === "active")
    .sort((a, b) => a.sort - b.sort)
    .map((channel: Channel) => {
      const categories = (categoryMap.get(channel.id) || []).sort((a, b) => a.sort - b.sort);
      return {
        ...channel,
        resources: getResourcesByChannelId(channel.id),
        categories: categories.map((category) => ({
          ...category,
          resources: getResourcesByCategoryId(category.id),
          topics: structure.topics
            .filter((topic) => topic.category_id === category.id && topic.status === "active")
            .sort((a, b) => a.sort - b.sort)
            .map((topic) => ({
              ...topic,
              resources: getResourcesByTopicId(topic.id)
            }))
        }))
      };
    });
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export function getFeedback(): Feedback[] {
  ensureDataFiles();
  const raw = fs.readFileSync(feedbackFile, "utf8").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Feedback);
}

export function recordFeedback(
  input: Pick<Feedback, "resource_id" | "resource_title" | "resource_slug" | "reason" | "note">
): Feedback {
  ensureDataFiles();
  const feedback: Feedback = {
    ...input,
    id: `fb_${Date.now().toString(36)}`,
    created_at: new Date().toISOString(),
    resolved: false,
  };
  fs.appendFileSync(feedbackFile, `${JSON.stringify(feedback)}\n`, "utf8");
  return feedback;
}

export function resolveFeedback(id: string): void {
  ensureDataFiles();
  const items = getFeedback().map((item) =>
    item.id === id ? { ...item, resolved: true } : item
  );
  fs.writeFileSync(feedbackFile, items.map((i) => JSON.stringify(i)).join("\n") + "\n", "utf8");
}
