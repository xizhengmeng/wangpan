import { GetServerSideProps } from "next";
import Link from "next/link";

import { ResourceCard } from "@/components/ResourceCard";
import { Seo } from "@/components/Seo";
import { getContentStructure, getResourcesByCategorySlug, getResourcesByTopicId } from "@/lib/store";
import { Resource, TopicNode } from "@/lib/types";

interface CategoryPageProps {
  categoryName: string;
  channelSlug: string;
  channelName: string;
  slug: string;
  items: Resource[];
  topics: Array<TopicNode & { resources: Resource[] }>;
}

export default function CategoryPage({ categoryName, channelSlug, channelName, slug, items, topics }: CategoryPageProps) {
  const description = `${categoryName} 相关夸克资料合集，持续更新资源。`;

  return (
    <>
      <Seo
        title={`${categoryName} 资源合集`}
        description={description}
        path={`/category/${slug}`}
      />

      <div className="page-shell">
        <div className="container">
          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            <Link href={`/channel/${channelSlug}`}>{channelName}</Link>
            <span className="breadcrumb__sep">›</span>
            <span>{categoryName}</span>
          </nav>

          <section className="page-hero panel">
            <span className="eyebrow">标目分类</span>
            <h1 className="page-title">{categoryName}</h1>
            <p className="page-copy">{description}</p>
            {topics.length > 0 && (
              <div className="chip-row" style={{ marginTop: 14 }}>
                {topics.map((topic) => (
                  <Link className="chip" href={`/topic/${topic.slug}`} key={topic.id}>
                    {topic.name} · {topic.resources.length}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {topics.length > 0 && (
            <section className="section" style={{ marginBottom: 12 }}>
              <div className="section-head">
                <div>
                  <h2 className="section-title">专题浏览</h2>
                  <p className="section-subtitle">点入专题查看明细分类的资料合集</p>
                </div>
              </div>
              <div className="ch-topic-grid" style={{ padding: 0 }}>
                {topics.map((topic) => (
                  <Link className="ch-topic-card" href={`/topic/${topic.slug}`} key={topic.id}>
                    <div className="ch-topic-card__top">
                      <h3 className="ch-topic-card__title">{topic.name}</h3>
                      <span className="ch-topic-card__count">{topic.resources.length} 个资源</span>
                    </div>
                    {topic.summary && (
                      <p className="ch-topic-card__summary">{topic.summary}</p>
                    )}
                    {topic.resources[0] && (
                      <div className="ch-topic-card__preview">{topic.resources[0].title}</div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">全部资源</h2>
                <p className="section-subtitle">共 {items.length} 条</p>
              </div>
            </div>
            <div className="card-grid">
              {items.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<CategoryPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const [items, structure] = await Promise.all([
    getResourcesByCategorySlug(slug),
    getContentStructure(),
  ]);

  if (items.length === 0) {
    return {
      notFound: true
    };
  }

  const category = structure.categories.find((c) => c.slug === slug && c.status === "active");
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
    }
  };
};
