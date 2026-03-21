import { TrackEvent } from "@/lib/types";

export type AnalyticsPeriod = "day" | "week" | "month";

export interface AnalyticsPeriodPoint {
  key: string;
  label: string;
  shortLabel: string;
  visits: number;
  searches: number;
  clicks: number;
  downloads: number;
}

export interface AnalyticsPeriodSummary {
  label: string;
  rangeLabel: string;
  granularityLabel: string;
  visits: number;
  searches: number;
  clicks: number;
  downloads: number;
  visitChange: number;
  searchChange: number;
  clickChange: number;
  downloadChange: number;
  topQueries: Array<{ query: string; count: number }>;
  topClickedResources: Array<{ resourceId: string; count: number }>;
  topDownloadedResources: Array<{ resourceId: string; count: number }>;
  points: AnalyticsPeriodPoint[];
}

export interface AnalyticsSummary {
  totalEvents: number;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
  topResources: Array<{ resourceId: string; count: number }>;
  lowConversionResources: Array<{ resourceId: string; detailViews: number; downloads: number }>;
  periods: Record<AnalyticsPeriod, AnalyticsPeriodSummary>;
}

interface PeriodConfig {
  period: AnalyticsPeriod;
  label: string;
  rangeLabel: string;
  granularityLabel: string;
  bucketCount: number;
  bucketSizeMs: number;
  currentStartMs: number;
  currentEndMs: number;
  previousStartMs: number;
  previousEndMs: number;
  toKey: (ms: number) => string;
  toLabel: (ms: number) => string;
  toShortLabel: (ms: number) => string;
}

interface PeriodAccumulator {
  points: AnalyticsPeriodPoint[];
  indexByKey: Map<string, number>;
  current: {
    visits: number;
    searches: number;
    clicks: number;
    downloads: number;
  };
  previous: {
    visits: number;
    searches: number;
    clicks: number;
    downloads: number;
  };
  queryCounts: Map<string, number>;
  clickedResources: Map<string, number>;
  downloadedResources: Map<string, number>;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOCAL_OFFSET_MS = 8 * HOUR_MS;

function sortCountEntries<T extends string>(map: Map<T, number>, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "zh-CN"))
    .slice(0, limit);
}

function topEntries(map: Map<string, number>, limit = 5) {
  return sortCountEntries(map, limit).map(([query, count]) => ({ query, count }));
}

function topResourceEntries(map: Map<string, number>, limit = 5) {
  return sortCountEntries(map, limit).map(([resourceId, count]) => ({ resourceId, count }));
}

function toShiftedMs(value: string | Date) {
  return new Date(value).getTime() + LOCAL_OFFSET_MS;
}

function fromUtcParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
) {
  return Date.UTC(year, month, day, hour, minute, second, millisecond);
}

function startOfHourMs(ms: number) {
  const date = new Date(ms);
  return fromUtcParts(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours()
  );
}

function startOfDayMs(ms: number) {
  const date = new Date(ms);
  return fromUtcParts(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function hourKey(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}`;
}

function dayKey(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function hourLabel(ms: number) {
  const date = new Date(ms);
  return `${pad(date.getUTCHours())}:00`;
}

function dayLabel(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function dayShortLabel(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function computeChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function buildPeriodConfigs(now = new Date()): Record<AnalyticsPeriod, PeriodConfig> {
  const nowMs = now.getTime() + LOCAL_OFFSET_MS;
  const startOfCurrentHour = startOfHourMs(nowMs);
  const startOfToday = startOfDayMs(nowMs);

  return {
    day: {
      period: "day",
      label: "今日",
      rangeLabel: "近 24 小时",
      granularityLabel: "按小时",
      bucketCount: 24,
      bucketSizeMs: HOUR_MS,
      currentStartMs: startOfCurrentHour - 23 * HOUR_MS,
      currentEndMs: startOfCurrentHour + HOUR_MS,
      previousStartMs: startOfCurrentHour - 47 * HOUR_MS,
      previousEndMs: startOfCurrentHour - 23 * HOUR_MS,
      toKey: hourKey,
      toLabel: hourLabel,
      toShortLabel: hourLabel,
    },
    week: {
      period: "week",
      label: "本周",
      rangeLabel: "近 7 天",
      granularityLabel: "按天",
      bucketCount: 7,
      bucketSizeMs: DAY_MS,
      currentStartMs: startOfToday - 6 * DAY_MS,
      currentEndMs: startOfToday + DAY_MS,
      previousStartMs: startOfToday - 13 * DAY_MS,
      previousEndMs: startOfToday - 6 * DAY_MS,
      toKey: dayKey,
      toLabel: dayLabel,
      toShortLabel: dayShortLabel,
    },
    month: {
      period: "month",
      label: "本月",
      rangeLabel: "近 30 天",
      granularityLabel: "按天",
      bucketCount: 30,
      bucketSizeMs: DAY_MS,
      currentStartMs: startOfToday - 29 * DAY_MS,
      currentEndMs: startOfToday + DAY_MS,
      previousStartMs: startOfToday - 59 * DAY_MS,
      previousEndMs: startOfToday - 29 * DAY_MS,
      toKey: dayKey,
      toLabel: dayLabel,
      toShortLabel: dayShortLabel,
    },
  };
}

function buildAccumulator(config: PeriodConfig): PeriodAccumulator {
  const points: AnalyticsPeriodPoint[] = [];
  const indexByKey = new Map<string, number>();

  for (let index = 0; index < config.bucketCount; index += 1) {
    const bucketMs = config.currentStartMs + index * config.bucketSizeMs;
    const key = config.toKey(bucketMs);
    indexByKey.set(key, index);
    points.push({
      key,
      label: config.toLabel(bucketMs),
      shortLabel: config.toShortLabel(bucketMs),
      visits: 0,
      searches: 0,
      clicks: 0,
      downloads: 0,
    });
  }

  return {
    points,
    indexByKey,
    current: { visits: 0, searches: 0, clicks: 0, downloads: 0 },
    previous: { visits: 0, searches: 0, clicks: 0, downloads: 0 },
    queryCounts: new Map(),
    clickedResources: new Map(),
    downloadedResources: new Map(),
  };
}

function applyEventToBucket(point: AnalyticsPeriodPoint, event: TrackEvent) {
  if (event.name === "resource_detail_view") {
    point.visits += 1;
  }

  if (event.name === "search_submit") {
    point.searches += 1;
  }

  if (event.name === "search_result_click") {
    point.clicks += 1;
  }

  if (event.name === "outbound_quark_click") {
    point.downloads += 1;
  }
}

function applyEventToTotals(
  target: PeriodAccumulator["current"] | PeriodAccumulator["previous"],
  event: TrackEvent
) {
  if (event.name === "resource_detail_view") {
    target.visits += 1;
  }

  if (event.name === "search_submit") {
    target.searches += 1;
  }

  if (event.name === "search_result_click") {
    target.clicks += 1;
  }

  if (event.name === "outbound_quark_click") {
    target.downloads += 1;
  }
}

export function summarizeEvents(events: TrackEvent[]): AnalyticsSummary {
  const queryCounts = new Map<string, number>();
  const noResultCounts = new Map<string, number>();
  const resourceClicks = new Map<string, number>();
  const detailViews = new Map<string, number>();
  const downloads = new Map<string, number>();

  const periodConfigs = buildPeriodConfigs();
  const periodAccumulators: Record<AnalyticsPeriod, PeriodAccumulator> = {
    day: buildAccumulator(periodConfigs.day),
    week: buildAccumulator(periodConfigs.week),
    month: buildAccumulator(periodConfigs.month),
  };

  for (const event of events) {
    if (event.name === "search_submit" && event.query) {
      queryCounts.set(event.query, (queryCounts.get(event.query) || 0) + 1);
      if (event.result_count === 0) {
        noResultCounts.set(event.query, (noResultCounts.get(event.query) || 0) + 1);
      }
    }

    if (event.name === "search_result_click" && event.resource_id) {
      resourceClicks.set(event.resource_id, (resourceClicks.get(event.resource_id) || 0) + 1);
    }

    if (event.name === "resource_detail_view" && event.resource_id) {
      detailViews.set(event.resource_id, (detailViews.get(event.resource_id) || 0) + 1);
    }

    if (event.name === "outbound_quark_click" && event.resource_id) {
      downloads.set(event.resource_id, (downloads.get(event.resource_id) || 0) + 1);
    }

    const shiftedMs = toShiftedMs(event.event_time);

    for (const period of Object.keys(periodConfigs) as AnalyticsPeriod[]) {
      const config = periodConfigs[period];
      const acc = periodAccumulators[period];

      if (shiftedMs >= config.currentStartMs && shiftedMs < config.currentEndMs) {
        applyEventToTotals(acc.current, event);
        const key = config.toKey(shiftedMs);
        const pointIndex = acc.indexByKey.get(key);
        if (pointIndex !== undefined) {
          applyEventToBucket(acc.points[pointIndex], event);
        }

        if (event.name === "search_submit" && event.query) {
          acc.queryCounts.set(event.query, (acc.queryCounts.get(event.query) || 0) + 1);
        }

        if (event.name === "search_result_click" && event.resource_id) {
          acc.clickedResources.set(
            event.resource_id,
            (acc.clickedResources.get(event.resource_id) || 0) + 1
          );
        }

        if (event.name === "outbound_quark_click" && event.resource_id) {
          acc.downloadedResources.set(
            event.resource_id,
            (acc.downloadedResources.get(event.resource_id) || 0) + 1
          );
        }
      } else if (shiftedMs >= config.previousStartMs && shiftedMs < config.previousEndMs) {
        applyEventToTotals(acc.previous, event);
      }
    }
  }

  const lowConversionResources = [...detailViews.entries()]
    .map(([resourceId, views]) => ({
      resourceId,
      detailViews: views,
      downloads: downloads.get(resourceId) || 0,
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

  const periods = (Object.keys(periodConfigs) as AnalyticsPeriod[]).reduce(
    (result, period) => {
      const config = periodConfigs[period];
      const acc = periodAccumulators[period];

      result[period] = {
        label: config.label,
        rangeLabel: config.rangeLabel,
        granularityLabel: config.granularityLabel,
        visits: acc.current.visits,
        searches: acc.current.searches,
        clicks: acc.current.clicks,
        downloads: acc.current.downloads,
        visitChange: computeChange(acc.current.visits, acc.previous.visits),
        searchChange: computeChange(acc.current.searches, acc.previous.searches),
        clickChange: computeChange(acc.current.clicks, acc.previous.clicks),
        downloadChange: computeChange(acc.current.downloads, acc.previous.downloads),
        topQueries: topEntries(acc.queryCounts, 8),
        topClickedResources: topResourceEntries(acc.clickedResources, 8),
        topDownloadedResources: topResourceEntries(acc.downloadedResources, 8),
        points: acc.points,
      };

      return result;
    },
    {} as Record<AnalyticsPeriod, AnalyticsPeriodSummary>
  );

  return {
    totalEvents: events.length,
    topQueries: topEntries(queryCounts),
    noResultQueries: topEntries(noResultCounts),
    topResources: topResourceEntries(resourceClicks),
    lowConversionResources,
    periods,
  };
}
