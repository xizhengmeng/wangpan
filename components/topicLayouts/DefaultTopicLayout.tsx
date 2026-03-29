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

          <div className="elegant-zone-container">

            <style jsx>{`
              .elegant-zone-container {
                margin-bottom: 24px;
              }
              .elegant-header-card {
                background: var(--bg-card);
                border-radius: 12px;
                box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
                border: 1px solid var(--border);
                overflow: hidden;
                margin-bottom: 24px;
              }
              .elegant-hero {
                padding: 32px 32px 28px;
                background: linear-gradient(180deg, rgba(248,250,252,0.6) 0%, rgba(255,255,255,0) 100%);
                border-bottom: 1px solid rgba(0,0,0,0.04);
                position: relative;
              }
              .elegant-eyebrow {
                font-size: 13px;
                font-weight: 600;
                color: #2563eb;
                margin-bottom: 12px;
                display: inline-block;
                background: #eff6ff;
                padding: 4px 10px;
                border-radius: 6px;
              }
              .elegant-title {
                font-size: 32px;
                font-weight: 800;
                color: var(--text-primary);
                margin: 0 0 12px 0;
                letter-spacing: -0.5px;
              }
              .elegant-desc {
                font-size: 15px;
                color: var(--text-secondary);
                margin: 0;
                max-width: 680px;
                line-height: 1.6;
              }
              .elegant-meta {
                display: flex;
                gap: 12px;
                margin-top: 20px;
              }
              .elegant-meta-badge {
                font-size: 13px;
                color: var(--text-secondary);
                background: var(--bg-page);
                padding: 4px 12px;
                border-radius: 20px;
                display: inline-flex;
                align-items: center;
              }
              .elegant-filters {
                padding: 24px 32px;
                display: flex;
                flex-direction: column;
                gap: 18px;
                background: var(--bg-card);
              }
              .ef-row {
                display: flex;
                align-items: flex-start;
              }
              .ef-label {
                flex-shrink: 0;
                width: 48px;
                padding-top: 4px;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-secondary);
              }
              .ef-options {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
              }
              .ef-btn {
                padding: 4px 14px;
                font-size: 14px;
                border-radius: 6px;
                border: 1px solid transparent;
                color: var(--text-primary);
                background: transparent;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .ef-btn:hover {
                background: rgba(0,0,0,0.04);
              }
              .ef-btn.active {
                background: var(--text-primary);
                color: #fff;
                font-weight: 500;
              }
              .ef-active-tags {
                padding: 16px 32px;
                background: rgba(248,250,252,0.4);
                border-top: 1px dashed rgba(0,0,0,0.06);
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
              }
              .ef-tag {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                font-size: 13px;
                background: #fff;
                border: 1px solid rgba(0,0,0,0.08);
                border-radius: 6px;
                color: var(--text-primary);
                cursor: pointer;
                transition: border-color 0.2s;
              }
              .ef-tag:hover {
                border-color: #94a3b8;
              }
              .ef-tag-clear {
                font-size: 13px;
                color: var(--text-secondary);
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px 8px;
                transition: color 0.2s;
              }
              .ef-tag-clear:hover {
                color: #ef4444;
              }
              @media (max-width: 768px) {
                .elegant-hero { padding: 24px 20px 20px; }
                .elegant-title { font-size: 24px; }
                .elegant-filters { padding: 20px; gap: 14px; }
                .ef-row { flex-direction: column; gap: 8px; }
                .ef-label { padding-top: 0; }
                .ef-active-tags { padding: 16px 20px; }
              }
            `}</style>

            <div className="elegant-header-card">
              <div className="elegant-hero">
                <span className="elegant-eyebrow">精选专题</span>
                <h1 className="elegant-title">{topic.name}</h1>
                <p className="elegant-desc">{topic.summary}</p>
                <div className="elegant-meta">
                  {channelName && <span className="elegant-meta-badge">{channelName}</span>}
                  {categoryName && <span className="elegant-meta-badge">{categoryName}</span>}
                  <span className="elegant-meta-badge">收录 {resources.length} 份</span>
                </div>
              </div>
            </div>

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
      </div>
    </>

  );
}
