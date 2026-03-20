import { GetServerSideProps } from "next";

import { AdminResourcesClient } from "@/components/AdminResourcesClient";
import { Seo } from "@/components/Seo";
import { getAllResources, getAnalyticsSummary } from "@/lib/store";
import { Resource } from "@/lib/types";

interface AdminPageProps {
  resources: Resource[];
  metrics: Array<{ label: string; value: string }>;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
}

export default function AdminPage({
  resources,
  metrics,
  topQueries,
  noResultQueries
}: AdminPageProps) {
  return (
    <>
      <Seo
        title="后台资源管理"
        description="管理资源、导入 CSV 并查看搜索和点击统计。"
        path="/admin/resources"
        noindex
      />
      <AdminResourcesClient
        initialResources={resources}
        metrics={metrics}
        topQueries={topQueries}
        noResultQueries={noResultQueries}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async () => {
  const analytics = getAnalyticsSummary();
  const resources = getAllResources();

  return {
    props: {
      resources,
      metrics: [
        { label: "资源总数", value: String(resources.length) },
        { label: "累计事件", value: String(analytics.totalEvents) },
        { label: "高频搜索词", value: String(analytics.topQueries.length) },
        { label: "无结果搜索词", value: String(analytics.noResultQueries.length) }
      ],
      topQueries: analytics.topQueries,
      noResultQueries: analytics.noResultQueries
    }
  };
};
