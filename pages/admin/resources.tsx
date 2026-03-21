import { GetServerSideProps, NextPage } from "next";
import type { ReactElement } from "react";

import { AdminResourcesClient } from "@/components/AdminResourcesClient";
import { Seo } from "@/components/Seo";
import { requireAdminAuth } from "@/lib/auth";
import { AnalyticsPeriod, AnalyticsPeriodPoint } from "@/lib/analytics";
import { getAllResources, getAnalyticsSummary, getContentStructure, getFeedback } from "@/lib/store";
import { CategoryNode, Channel, Feedback, Resource, TopicNode } from "@/lib/types";

interface RankedResource {
  resourceId: string;
  title: string;
  slug: string;
  count: number;
}

interface DashboardPeriodData {
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
  points: AnalyticsPeriodPoint[];
  topQueries: Array<{ query: string; count: number }>;
  topClickedResources: RankedResource[];
  topDownloadedResources: RankedResource[];
}

interface AdminPageProps {
  resources: Resource[];
  overviewMetrics: Array<{ label: string; value: string }>;
  dashboardPeriods: Record<AnalyticsPeriod, DashboardPeriodData>;
  initialChannels: Channel[];
  initialCategories: CategoryNode[];
  initialTopics: TopicNode[];
  feedbackItems: Feedback[];
}

export default function AdminPage({
  resources,
  overviewMetrics,
  dashboardPeriods,
  initialChannels,
  initialCategories,
  initialTopics,
  feedbackItems,
}: AdminPageProps) {
  return (
    <>
      <Seo
        title="后台管理"
        description="资源管理、统计看板、失效反馈"
        path="/admin/resources"
        noindex
      />
      <AdminResourcesClient
        initialResources={resources}
        overviewMetrics={overviewMetrics}
        dashboardPeriods={dashboardPeriods}
        initialChannels={initialChannels}
        initialCategories={initialCategories}
        initialTopics={initialTopics}
        initialFeedback={feedbackItems}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (ctx) =>
  requireAdminAuth(ctx, async () => {
  const [analytics, resources, feedback, structure] = await Promise.all([
    getAnalyticsSummary(),
    getAllResources(),
    getFeedback(),
    getContentStructure(),
  ]);

  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  const mapRankedResources = (items: Array<{ resourceId: string; count: number }>): RankedResource[] =>
    items
      .map((item) => {
      const r = resourceMap.get(item.resourceId);
      if (!r) return null;
      return { resourceId: item.resourceId, title: r.title, slug: r.slug, count: item.count };
    })
      .filter(Boolean) as RankedResource[];

  const dashboardPeriods = (Object.keys(analytics.periods) as AnalyticsPeriod[]).reduce(
    (acc, period) => {
      const summary = analytics.periods[period];
      acc[period] = {
        ...summary,
        topClickedResources: mapRankedResources(summary.topClickedResources),
        topDownloadedResources: mapRankedResources(summary.topDownloadedResources),
      };
      return acc;
    },
    {} as Record<AnalyticsPeriod, DashboardPeriodData>
  );

  return {
    props: {
      resources,
      overviewMetrics: [
        { label: "资源总数", value: String(resources.length) },
        { label: "已发布", value: String(resources.filter((r) => r.publish_status === "published").length) },
        { label: "累计事件", value: String(analytics.totalEvents) },
        { label: "无结果词", value: String(analytics.noResultQueries.length) },
      ],
      dashboardPeriods,
      initialChannels: structure.channels,
      initialCategories: structure.categories,
      initialTopics: structure.topics,
      feedbackItems: feedback,
    },
  };
  });

(AdminPage as NextPage & { getLayout: (page: ReactElement) => ReactElement }).getLayout =
  (page: ReactElement) => page;
