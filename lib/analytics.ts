import { TrackEvent } from "@/lib/types";

export interface AnalyticsSummary {
  totalEvents: number;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
  topResources: Array<{ resourceId: string; count: number }>;
  lowConversionResources: Array<{ resourceId: string; detailViews: number; downloads: number }>;
}

function topEntries(map: Map<string, number>, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ query: key, count }));
}

export function summarizeEvents(events: TrackEvent[]): AnalyticsSummary {
  const queryCounts = new Map<string, number>();
  const noResultCounts = new Map<string, number>();
  const resourceClicks = new Map<string, number>();
  const detailViews = new Map<string, number>();
  const downloads = new Map<string, number>();

  for (const event of events) {
    if (event.name === "search_submit" && event.query) {
      queryCounts.set(event.query, (queryCounts.get(event.query) || 0) + 1);
      if (event.result_count === 0) {
        noResultCounts.set(event.query, (noResultCounts.get(event.query) || 0) + 1);
      }
    }

    if (event.name === "search_result_click" && event.resource_id) {
      resourceClicks.set(
        event.resource_id,
        (resourceClicks.get(event.resource_id) || 0) + 1
      );
    }

    if (event.name === "resource_detail_view" && event.resource_id) {
      detailViews.set(event.resource_id, (detailViews.get(event.resource_id) || 0) + 1);
    }

    if (event.name === "outbound_quark_click" && event.resource_id) {
      downloads.set(event.resource_id, (downloads.get(event.resource_id) || 0) + 1);
    }
  }

  const lowConversionResources = [...detailViews.entries()]
    .map(([resourceId, views]) => ({
      resourceId,
      detailViews: views,
      downloads: downloads.get(resourceId) || 0
    }))
    .sort((a, b) => {
      const ratioA = a.downloads / a.detailViews;
      const ratioB = b.downloads / b.detailViews;
      if (ratioA !== ratioB) {
        return ratioA - ratioB;
      }

      return b.detailViews - a.detailViews;
    })
    .slice(0, 5);

  return {
    totalEvents: events.length,
    topQueries: topEntries(queryCounts),
    noResultQueries: topEntries(noResultCounts),
    topResources: [...resourceClicks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([resourceId, count]) => ({ resourceId, count })),
    lowConversionResources
  };
}
