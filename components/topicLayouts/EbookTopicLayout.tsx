import Link from "next/link";
import { useMemo, useState } from "react";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import { Resource } from "@/lib/types";
import type { TopicLayoutProps } from "./types";

const FORMAT_ORDER = ["PDF", "EPUB", "MOBI", "AZW3"];

function sortByPreset(values: string[], preset: string[]) {
  return [...values].sort((a, b) => {
    const ai = preset.indexOf(a);
    const bi = preset.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.localeCompare(b, "zh-CN");
  });
}

function getFormats(resource: Resource) {
  const metaFormats = resource.meta?.formats;
  if (Array.isArray(metaFormats)) {
    return metaFormats.map((item) => String(item)).filter(Boolean);
  }
  return resource.tags.filter((tag) => FORMAT_ORDER.includes(tag));
}

function hasSet(resource: Resource) {
  return resource.tags.includes("套装");
}

function hasPublisher(resource: Resource) {
  return resource.tags.includes("出版社");
}

function isDouban(resource: Resource) {
  return resource.tags.includes("豆瓣推荐");
}

export default function EbookTopicLayout({
  topic,
  categoryName,
  categorySlug,
  channelName,
  channelSlug,
  resources,
}: TopicLayoutProps) {
  const [formatFilter, setFormatFilter] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [doubanFilter, setDoubanFilter] = useState("");

  const formatOptions = useMemo(
    () => sortByPreset(Array.from(new Set(resources.flatMap(getFormats))), FORMAT_ORDER),
    [resources]
  );

  const filteredResources = useMemo(
    () =>
      resources.filter((resource) => {
        const formats = getFormats(resource);
        if (formatFilter && !formats.includes(formatFilter)) return false;
        if (setFilter === "only" && !hasSet(resource)) return false;
        if (publisherFilter === "only" && !hasPublisher(resource)) return false;
        if (doubanFilter === "only" && !isDouban(resource)) return false;
        return true;
      }),
    [doubanFilter, formatFilter, publisherFilter, resources, setFilter]
  );

  const activeFilters = [
    formatFilter ? { label: `格式: ${formatFilter}`, onClear: () => setFormatFilter("") } : null,
    setFilter === "only" ? { label: "仅看套装", onClear: () => setSetFilter("") } : null,
    publisherFilter === "only" ? { label: "仅看出版社", onClear: () => setPublisherFilter("") } : null,
    doubanFilter === "only" ? { label: "仅看豆瓣推荐", onClear: () => setDoubanFilter("") } : null,
  ].filter(Boolean) as Array<{ label: string; onClear: () => void }>;

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
                max-width: 720px;
                line-height: 1.6;
              }
              .elegant-meta {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
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
                width: 64px;
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
              }
              .ef-tag-clear {
                font-size: 13px;
                color: var(--text-secondary);
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px 8px;
              }
              @media (max-width: 768px) {
                .elegant-hero { padding: 24px 20px 20px; }
                .elegant-title { font-size: 24px; }
                .elegant-filters { padding: 20px; gap: 14px; }
                .ef-row { flex-direction: column; gap: 8px; }
                .ef-label { width: auto; padding-top: 0; }
                .ef-active-tags { padding: 16px 20px; }
              }
            `}</style>

            <div className="elegant-header-card">
              <div className="elegant-hero">
                <span className="elegant-eyebrow">电子书专题</span>
                <h1 className="elegant-title">{topic.name}</h1>
                <p className="elegant-desc">{topic.summary}</p>
                <div className="elegant-meta">
                  {channelName && <span className="elegant-meta-badge">{channelName}</span>}
                  {categoryName && <span className="elegant-meta-badge">{categoryName}</span>}
                  <span className="elegant-meta-badge">总计 {resources.length} 条</span>
                  <span className="elegant-meta-badge">当前 {filteredResources.length} 条</span>
                </div>
              </div>

              <div className="elegant-filters">
                <div className="ef-row">
                  <div className="ef-label">格式</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!formatFilter ? " active" : ""}`} onClick={() => setFormatFilter("")}>
                      全部
                    </button>
                    {formatOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`ef-btn${formatFilter === option ? " active" : ""}`}
                        onClick={() => setFormatFilter(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ef-row">
                  <div className="ef-label">套装</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!setFilter ? " active" : ""}`} onClick={() => setSetFilter("")}>
                      全部
                    </button>
                    <button type="button" className={`ef-btn${setFilter === "only" ? " active" : ""}`} onClick={() => setSetFilter("only")}>
                      仅看套装
                    </button>
                  </div>
                </div>

                <div className="ef-row">
                  <div className="ef-label">出版社</div>
                  <div className="ef-options">
                    <button
                      type="button"
                      className={`ef-btn${!publisherFilter ? " active" : ""}`}
                      onClick={() => setPublisherFilter("")}
                    >
                      全部
                    </button>
                    <button
                      type="button"
                      className={`ef-btn${publisherFilter === "only" ? " active" : ""}`}
                      onClick={() => setPublisherFilter("only")}
                    >
                      仅看出版社
                    </button>
                  </div>
                </div>

                <div className="ef-row">
                  <div className="ef-label">豆瓣</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!doubanFilter ? " active" : ""}`} onClick={() => setDoubanFilter("")}>
                      全部
                    </button>
                    <button type="button" className={`ef-btn${doubanFilter === "only" ? " active" : ""}`} onClick={() => setDoubanFilter("only")}>
                      豆瓣推荐
                    </button>
                  </div>
                </div>
              </div>

              {activeFilters.length > 0 ? (
                <div className="ef-active-tags">
                  {activeFilters.map((filter) => (
                    <button key={filter.label} type="button" className="ef-tag" onClick={filter.onClear}>
                      {filter.label} ×
                    </button>
                  ))}
                  <button
                    type="button"
                    className="ef-tag-clear"
                    onClick={() => {
                      setFormatFilter("");
                      setSetFilter("");
                      setPublisherFilter("");
                      setDoubanFilter("");
                    }}
                  >
                    清空筛选
                  </button>
                </div>
              ) : null}
            </div>

            <section className="section">
              {filteredResources.length > 0 ? (
                <ResourceListCompact items={filteredResources} />
              ) : (
                <div className="panel empty-state">
                  <strong>当前筛选条件下没有匹配资源。</strong>
                  <p className="muted">可以放宽格式或特征条件后再试。</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
