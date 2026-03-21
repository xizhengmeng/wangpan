import { GetServerSideProps } from "next";

import { getCategoryLayout } from "@/components/categoryLayouts";
import type { CategoryLayoutProps } from "@/components/categoryLayouts";
import { getContentStructure, getResourcesByCategorySlug, getResourcesByTopicId } from "@/lib/store";

export default function CategoryPage(props: CategoryLayoutProps) {
  const Layout = getCategoryLayout(props.slug);
  return <Layout {...props} />;
}

export const getServerSideProps: GetServerSideProps<CategoryLayoutProps> = async ({ params }) => {
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

  return {
    props: {
      categoryName: category?.name || items[0].category,
      channelSlug: channel?.slug || "",
      channelName: channel?.name || "",
      slug,
      items,
      topics: topicsWithResources,
    },
  };
};
