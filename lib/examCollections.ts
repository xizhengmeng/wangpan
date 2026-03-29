import fs from "node:fs";
import path from "node:path";

import type { Resource } from "@/lib/types";

export interface ExamCollectionDefinition {
  id: string;
  slug: string;
  exam_slug: "gaokaozhenti" | "zhongkaozhenti";
  collection_type: "subject-history" | "paper-version" | "subject-paper-version" | "year-region" | "region-subject";
  title: string;
  summary: string;
  resource_count: number;
  subject_count: number;
  year_count: number;
  lastmod?: string;
  filters: Record<string, string | boolean>;
  facets: {
    subjects: string[];
    years: string[];
    regions: string[];
    paper_versions: string[];
    cities: string[];
  };
  resource_slugs: string[];
}

interface ExamCollectionsData {
  generated_at: string;
  stats: Record<string, { total: number; by_type: Record<string, number> }>;
  collections: ExamCollectionDefinition[];
}

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(process.cwd(), "data", fileName);
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

function normalizeResource(resource: Record<string, unknown>): Resource {
  return resource as unknown as Resource;
}

export function getExamCollectionsData(): ExamCollectionsData {
  return readJson<ExamCollectionsData>("exam-collections.json", {
    generated_at: "",
    stats: {},
    collections: [],
  });
}

export function getExamCollectionsByExamSlug(examSlug: "gaokaozhenti" | "zhongkaozhenti") {
  return getExamCollectionsData().collections.filter((collection) => collection.exam_slug === examSlug);
}

export function getExamCollectionBySlug(slug: string) {
  return getExamCollectionsData().collections.find((collection) => collection.slug === slug) || null;
}

export function getExamManifestResources(examSlug: "gaokaozhenti" | "zhongkaozhenti") {
  const fileName = examSlug === "gaokaozhenti" ? "gaokao-zhenti-manifest.json" : "zhongkao-zhenti-manifest.json";
  const data = readJson<{ resources?: Record<string, unknown>[] }>(fileName, { resources: [] });
  return (data.resources || []).map(normalizeResource);
}

export function getExamCollectionResources(collection: ExamCollectionDefinition) {
  const allResources = getExamManifestResources(collection.exam_slug);
  const slugSet = new Set(collection.resource_slugs);
  return allResources.filter((resource) => slugSet.has(resource.slug));
}

export function getFeaturedExamCollections(
  examSlug: "gaokaozhenti" | "zhongkaozhenti",
  limitPerType = 6
) {
  const collections = getExamCollectionsByExamSlug(examSlug);
  const groups = new Map<string, ExamCollectionDefinition[]>();

  for (const collection of collections) {
    const list = groups.get(collection.collection_type) || [];
    list.push(collection);
    groups.set(collection.collection_type, list);
  }

  return Array.from(groups.entries()).map(([type, items]) => ({
    type,
    items: [...items]
      .sort((a, b) => {
        if (b.resource_count !== a.resource_count) return b.resource_count - a.resource_count;
        return a.title.localeCompare(b.title, "zh-CN");
      })
      .slice(0, limitPerType),
  }));
}
