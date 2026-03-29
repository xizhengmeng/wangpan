import { GetServerSideProps } from "next";

import { getCategoryLayout } from "@/components/categoryLayouts";
import type { CategoryLayoutProps } from "@/components/categoryLayouts";
import { getContentStructure, getResourcesByCategorySlug, getResourcesByTopicId } from "@/lib/store";

const CATEGORY_PAGE_SIZE = 24;

export default function CategoryPage(props: CategoryLayoutProps) {
  const Layout = getCategoryLayout(props.slug);
  return <Layout {...props} />;
}

export const getServerSideProps: GetServerSideProps<CategoryLayoutProps> = async ({ params, query }) => {
  const slug = String(params?.slug || "");
  const [items, structure] = await Promise.all([
    getResourcesByCategorySlug(slug),
    getContentStructure(),
  ]);

  const category = structure.categories.find((c) => c.slug === slug && c.status === "active");

  // 404 only when neither the structure nor any resource knows this slug
  if (!category && items.length === 0) {
    return { notFound: true };
  }

  const channel = category ? structure.channels.find((ch) => ch.id === category.channel_id) : null;
  const rawTopics = category
    ? structure.topics.filter((t) => t.category_id === category.id && t.status === "active")
    : [];

  const topicsWithResources = await Promise.all(
    rawTopics.map(async (topic) => ({
      ...topic,
      resources: await getResourcesByTopicId(topic.id),
    }))
  );
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
  const requestedPage = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (page - 1) * CATEGORY_PAGE_SIZE;
  const pagedItems = items.slice(start, start + CATEGORY_PAGE_SIZE);

  return {
    props: {
      categoryName: category?.name || items[0].category,
      channelSlug: channel?.slug || "",
      channelName: channel?.name || "",
      slug,
      items: pagedItems,
      page,
      total,
      totalPages,
      topics: topicsWithResources,
    },
  };
};
