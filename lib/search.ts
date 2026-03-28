import { Resource, SearchResponse, SearchResult } from "@/lib/types";

export const SEARCH_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
export const DEFAULT_SEARCH_PAGE_SIZE = 10;

export function normalizeSearchPageSize(pageSize?: number) {
  return SEARCH_PAGE_SIZE_OPTIONS.find((value) => value === pageSize) ?? DEFAULT_SEARCH_PAGE_SIZE;
}

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function scoreResource(resource: Resource, query: string) {
  const q = normalize(query);
  if (!q) {
    return 0;
  }

  let score = 0;
  const title = normalize(resource.title);
  const tags = resource.tags.map(normalize);
  const summary = normalize(resource.summary);

  if (title.includes(q)) {
    score += title.startsWith(q) ? 120 : 80;
  }

  if (tags.some((tag) => tag.includes(q))) {
    score += 40;
  }

  if (summary.includes(q)) {
    score += 20;
  }

  return score;
}

export function searchResources(
  resources: Resource[],
  query: string,
  page = 1,
  pageSize = DEFAULT_SEARCH_PAGE_SIZE
): SearchResponse {
  const requestedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = normalizeSearchPageSize(pageSize);
  const ranked: SearchResult[] = resources
    .map((item) => ({ item, score: scoreResource(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        new Date(b.item.updated_at).getTime() - new Date(a.item.updated_at).getTime()
      );
    });

  const totalPages = Math.max(1, Math.ceil(ranked.length / normalizedPageSize));
  const normalizedPage = Math.min(requestedPage, totalPages);
  const start = (normalizedPage - 1) * normalizedPageSize;
  const paged = ranked.slice(start, start + normalizedPageSize).map((entry) => entry.item);

  return {
    items: paged,
    total: ranked.length,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    query
  };
}
