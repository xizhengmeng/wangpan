import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import type { TopicLayoutProps } from "./types";

export default function DefaultTopicLayout({
  topic,
  categoryName,
  categorySlug,
  channelName,
  channelSlug,
  resources,
}: TopicLayoutProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: topic.name,
    description: topic.summary,
    url: absoluteUrl(`/topic/${topic.slug}`),
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
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            {channelName && channelSlug && (
              <>
                <Link href={`/channel/${channelSlug}`}>{channelName}</Link>
                <span className="breadcrumb__sep">›</span>
              </>
            )}
            {categoryName && categorySlug && (
              <>
                <Link href={`/category/${categorySlug}`}>{categoryName}</Link>
                <span className="breadcrumb__sep">›</span>
              </>
            )}
            <span>{topic.name}</span>
          </nav>

          <section className="page-hero panel">
            <span className="eyebrow">资料专题</span>
            <h1 className="page-title">{topic.name}</h1>
            <p className="page-copy">{topic.summary}</p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <Link
                className="chip"
                href={channelSlug ? `/channel/${channelSlug}` : `/search?q=${encodeURIComponent(channelName)}`}
              >
                {channelName}
              </Link>
              <Link
                className="chip"
                href={categorySlug ? `/category/${categorySlug}` : `/search?q=${encodeURIComponent(categoryName)}`}
              >
                {categoryName}
              </Link>
              <span className="chip">{resources.length} 条资源</span>
            </div>
          </section>

          <section className="section">
            {resources.length > 0 ? (
              <ResourceListCompact items={resources} />
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
