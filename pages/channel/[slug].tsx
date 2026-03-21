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

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">内容频道</span>
            <h1 className="page-title">{channel.name}</h1>
            <p className="page-copy">{channel.description}</p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <span className="chip">栏目 {channel.categories.length}</span>
              <span className="chip">资源 {channel.resources.length}</span>
            </div>
          </section>

          <div className="main-grid">
            {channel.categories.map((category) => (
              <section className="section panel" key={category.id} style={{ padding: 20 }}>
                <div className="section-head">
                  <div>
                    <h2 className="section-title">{category.name}</h2>
                    <p className="section-subtitle">{category.description}</p>
                  </div>
                  <Link className="chip" href={`/search?q=${encodeURIComponent(category.name)}`}>
                    搜索该栏目
                  </Link>
                </div>

                <div className="chip-row" style={{ marginBottom: 16 }}>
                  {category.topics.map((topic) => (
                    <Link
                      className="chip"
                      href={`/topic/${topic.slug}`}
                      key={topic.id}
                    >
                      {topic.name} · {topic.resources.length}
                    </Link>
                  ))}
                </div>

                {category.topics.length > 0 ? (
                  <div className="home-v3-picks" style={{ padding: 0, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    {category.topics.slice(0, 4).map((topic) => (
                      <Link className="home-v3-pick" href={`/topic/${topic.slug}`} key={topic.id}>
                        <div className="home-v3-pick__meta">
                          <span>专题</span>
                          <span>{topic.resources.length} 条资源</span>
                        </div>
                        <h3>{topic.name}</h3>
                        <p>{topic.summary}</p>
                        <div className="home-v3-pick__stack">
                          <span>{topic.resources[0]?.title || "等待补库"}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ChannelPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const channel = getContentStructureTree().find((item) => item.slug === slug);

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
