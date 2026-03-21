import { GetServerSideProps } from "next";

import { getTopicLayout } from "@/components/topicLayouts";
import type { TopicLayoutProps } from "@/components/topicLayouts";
import { getContentStructure, getResourcesByTopicId, getTopicBySlug } from "@/lib/store";

export default function TopicPage(props: TopicLayoutProps) {
  const Layout = getTopicLayout(props.topic.slug);
  return <Layout {...props} />;
}

export const getServerSideProps: GetServerSideProps<TopicLayoutProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const topic = await getTopicBySlug(slug);

  if (!topic) {
    return { notFound: true };
  }

  const structure = await getContentStructure();
  const category = structure.categories.find((item) => item.id === topic.category_id);
  const channel = category
    ? structure.channels.find((item) => item.id === category.channel_id)
    : null;

  return {
    props: {
      topic: {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        summary: topic.summary
      },
      categoryName: category?.name || "未分类",
      categorySlug: category?.slug || "",
      channelName: channel?.name || "未分频道",
      channelSlug: channel?.slug || "",
      resources: await getResourcesByTopicId(topic.id)
    }
  };
};
