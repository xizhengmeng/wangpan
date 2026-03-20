import { Resource, SearchResponse, SearchResult } from "@/lib/types";

const PAGE_SIZE = 12;

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
  pageSize = PAGE_SIZE
): SearchResponse {
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

  const start = (page - 1) * pageSize;
  const paged = ranked.slice(start, start + pageSize).map((entry) => entry.item);

  return {
    items: paged,
    total: ranked.length,
    page,
    pageSize,
    query
  };
}
