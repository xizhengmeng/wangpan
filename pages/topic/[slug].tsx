import { GetServerSideProps } from "next";
import Link from "next/link";

import { Seo } from "@/components/Seo";
import { ResourceCard } from "@/components/ResourceCard";
import { absoluteUrl } from "@/lib/site";
import { getContentStructure, getResourcesByTopicId, getTopicBySlug } from "@/lib/store";
import { Resource } from "@/lib/types";

interface TopicPageProps {
  topic: {
    id: string;
    name: string;
    slug: string;
    summary: string;
  };
  categoryName: string;
  channelName: string;
  resources: Resource[];
}

export default function TopicPage({ topic, categoryName, channelName, resources }: TopicPageProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: topic.name,
    description: topic.summary,
    url: absoluteUrl(`/topic/${topic.slug}`)
  };

  return (
    <>
      <Seo title={`${topic.name} 专题`} description={topic.summary} path={`/topic/${topic.slug}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">专题页</span>
            <h1 className="page-title">{topic.name}</h1>
            <p className="page-copy">{topic.summary}</p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <Link className="chip" href={`/search?q=${encodeURIComponent(channelName)}`}>{channelName}</Link>
              <Link className="chip" href={`/search?q=${encodeURIComponent(categoryName)}`}>{categoryName}</Link>
              <span className="chip">{resources.length} 条资源</span>
            </div>
          </section>

          <section className="section">
            {resources.length > 0 ? (
              <div className="card-grid">
                {resources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            ) : (
              <div className="panel empty-state">
                <strong>这个专题结构已经建好，但资源还没补齐。</strong>
                <p className="muted">后续可以直接在后台把资源挂到这个专题下面。</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<TopicPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const topic = getTopicBySlug(slug);

  if (!topic) {
    return { notFound: true };
  }

  const structure = getContentStructure();
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
      channelName: channel?.name || "未分频道",
      resources: getResourcesByTopicId(topic.id)
    }
  };
};
