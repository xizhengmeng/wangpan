import { GetServerSideProps } from "next";
import Link from "next/link";

import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import { getContentStructureTree } from "@/lib/store";
import { Resource } from "@/lib/types";

interface ChannelPageProps {
  channel: {
    id: string;
    name: string;
    slug: string;
    description: string;
    resources: Resource[];
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      description: string;
      resources: Resource[];
      topics: Array<{
        id: string;
        name: string;
        slug: string;
        summary: string;
        resources: Resource[];
      }>;
    }>;
  };
}

export default function ChannelPage({ channel }: ChannelPageProps) {
  const totalResources = channel.categories.reduce(
    (sum, cat) => sum + cat.resources.length,
    channel.resources.length
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: channel.name,
    description: channel.description,
    url: absoluteUrl(`/channel/${channel.slug}`)
  };

  return (
    <>
      <Seo
        title={`${channel.name} 频道`}
        description={channel.description}
        path={`/channel/${channel.slug}`}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="ch-shell">
        {/* ── Page header ── */}
        <header className="ch-header">
          <div className="ch-header__inner">
            <div className="ch-header__text">
              <p className="ch-header__eyebrow">内容频道</p>
              <h1 className="ch-header__title">{channel.name}</h1>
              <p className="ch-header__desc">{channel.description}</p>
            </div>
            <div className="ch-header__stats">
              <div className="ch-stat">
                <span className="ch-stat__num">{channel.categories.length}</span>
                <span className="ch-stat__label">栏目</span>
              </div>
              <div className="ch-stat">
                <span className="ch-stat__num">{totalResources}</span>
                <span className="ch-stat__label">资源</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Category sections ── */}
        <div className="ch-body">
          {channel.categories.map((category) => (
            <section className="ch-category" key={category.id}>
              {/* Category header */}
              <div className="ch-category__head">
                <div className="ch-category__meta">
                  <h2 className="ch-category__name">{category.name}</h2>
                  {category.description && (
                    <p className="ch-category__desc">{category.description}</p>
                  )}
                </div>
                <Link
                  className="ch-category__search"
                  href={`/search?q=${encodeURIComponent(category.name)}`}
                >
                  搜此栏目 →
                </Link>
              </div>

              {/* Topic chips */}
              {category.topics.length > 0 && (
                <div className="ch-topic-chips">
                  {category.topics.map((topic) => (
                    <Link className="ch-topic-chip" href={`/topic/${topic.slug}`} key={topic.id}>
                      {topic.name}
                      <span className="ch-topic-chip__count">{topic.resources.length}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Topic cards */}
              {category.topics.length > 0 && (
                <div className="ch-topic-grid">
                  {category.topics.slice(0, 6).map((topic) => (
                    <Link className="ch-topic-card" href={`/topic/${topic.slug}`} key={topic.id}>
                      <div className="ch-topic-card__top">
                        <h3 className="ch-topic-card__title">{topic.name}</h3>
                        <span className="ch-topic-card__count">{topic.resources.length} 个资源</span>
                      </div>
                      {topic.summary && (
                        <p className="ch-topic-card__summary">{topic.summary}</p>
                      )}
                      {topic.resources[0] && (
                        <div className="ch-topic-card__preview">
                          {topic.resources[0].title}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* Direct resources (no topics) */}
              {category.topics.length === 0 && category.resources.length > 0 && (
                <div className="ch-resource-list">
                  {category.resources.slice(0, 8).map((res) => (
                    <Link className="ch-resource-row" href={`/resource/${res.slug}`} key={res.id}>
                      <span className="ch-resource-row__title">{res.title}</span>
                      <span className="ch-resource-row__arrow">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ChannelPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const channel = (await getContentStructureTree()).find((item) => item.slug === slug);

  if (!channel) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      channel
    }
  };
};
