import { GetServerSideProps, NextPage } from "next";
import type { ReactElement } from "react";

import { AdminResourcesClient } from "@/components/AdminResourcesClient";
import { Seo } from "@/components/Seo";
import { requireAdminAuth } from "@/lib/auth";
import { getAllResources, getAnalyticsSummary, getFeedback } from "@/lib/store";
import { Feedback, Resource } from "@/lib/types";

interface TopResource {
  resourceId: string;
  title: string;
  slug: string;
  count: number;
}

interface LowConversionResource {
  resourceId: string;
  title: string;
  slug: string;
  detailViews: number;
  downloads: number;
}

interface AdminPageProps {
  resources: Resource[];
  metrics: Array<{ label: string; value: string }>;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
  topResources: TopResource[];
  lowConversionResources: LowConversionResource[];
  feedbackItems: Feedback[];
}

export default function AdminPage({
  resources,
  metrics,
  topQueries,
  noResultQueries,
  topResources,
  lowConversionResources,
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
        metrics={metrics}
        topQueries={topQueries}
        noResultQueries={noResultQueries}
        topResources={topResources}
        lowConversionResources={lowConversionResources}
        initialFeedback={feedbackItems}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (ctx) =>
  requireAdminAuth(ctx, async () => {
  const [analytics, resources, feedback] = await Promise.all([
    getAnalyticsSummary(),
    getAllResources(),
    getFeedback(),
  ]);

  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  const topResources: TopResource[] = analytics.topResources
    .map((item) => {
      const r = resourceMap.get(item.resourceId);
      if (!r) return null;
      return { resourceId: item.resourceId, title: r.title, slug: r.slug, count: item.count };
    })
    .filter(Boolean) as TopResource[];

  const lowConversionResources: LowConversionResource[] = analytics.lowConversionResources
    .map((item) => {
      const r = resourceMap.get(item.resourceId);
      if (!r) return null;
      return {
        resourceId: item.resourceId,
        title: r.title,
        slug: r.slug,
        detailViews: item.detailViews,
        downloads: item.downloads,
      };
    })
    .filter(Boolean) as LowConversionResource[];

  return {
    props: {
      resources,
      metrics: [
        { label: "资源总数", value: String(resources.length) },
        { label: "已发布", value: String(resources.filter((r) => r.publish_status === "published").length) },
        { label: "累计事件", value: String(analytics.totalEvents) },
        { label: "无结果词", value: String(analytics.noResultQueries.length) },
      ],
      topQueries: analytics.topQueries,
      noResultQueries: analytics.noResultQueries,
      topResources,
      lowConversionResources,
      feedbackItems: feedback,
    },
  };
  });

(AdminPage as NextPage & { getLayout: (page: ReactElement) => ReactElement }).getLayout =
  (page: ReactElement) => page;
