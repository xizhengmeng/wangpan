import { useMemo, useState } from "react";
import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { getGaokaoApplicableRegions, sortGaokaoRegions } from "@/lib/gaokao";
import { absoluteUrl } from "@/lib/site";
import type { TopicLayoutProps } from "./types";

// ── Component ─────────────────────────────────────────────────────────────────

export default function GaokaoZhentiLayout({
  topic,
  categoryName,
  categorySlug,
  channelName,
  channelSlug,
  resources,
}: TopicLayoutProps) {
  const [selSubject, setSubject] = useState<string | null>(null);
  const [selYear, setYear] = useState<string | null>(null);
  const [selRegion, setRegion] = useState<string | null>(null);

  const { subjects, years, regions } = useMemo(() => {
    const s = new Set<string>();
    const y = new Set<string>();
    const r = new Set<string>();
    for (const res of resources) {
      if (typeof res.meta?.subject === "string") s.add(res.meta.subject);
      if (typeof res.meta?.year === "string") y.add(res.meta.year);
      for (const region of getGaokaoApplicableRegions(res)) {
        r.add(region);
      }
    }
    return {
      subjects: Array.from(s).sort(),
      years: Array.from(y).sort((a, b) => Number(b) - Number(a)),
      regions: sortGaokaoRegions(Array.from(r)),
    };
  }, [resources]);

  const filtered = useMemo(() => {
    return resources.filter((res) => {
      if (selSubject && res.meta?.subject !== selSubject) return false;
      if (selYear    && res.meta?.year    !== selYear)    return false;
      if (selRegion && !getGaokaoApplicableRegions(res).includes(selRegion)) return false;
      return true;
    });
  }, [resources, selRegion, selSubject, selYear]);

  const hasFilters = selSubject || selYear || selRegion;

  function toggle<T>(current: T | null, value: T, setter: (v: T | null) => void) {
    setter(current === value ? null : value);
  }

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
          {/* Breadcrumb */}
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
                  {filtered.length !== resources.length && (
                    <span className="elegant-meta-badge" style={{ background: "#e0f2fe", color: "#1d4ed8" }}>
                      筛选结果 {filtered.length} 份
                    </span>
                  )}
                </div>
              </div>

              <div className="elegant-filters">
                {subjects.length > 0 && (
                  <div className="ef-row">
                    <div className="ef-label">科目</div>
                    <div className="ef-options">
                      <button type="button" className={`ef-btn${!selSubject ? " active" : ""}`} onClick={() => setSubject(null)}>全部</button>
                      {subjects.map(s => (
                        <button type="button" className={`ef-btn${selSubject === s ? " active" : ""}`} key={s} onClick={() => toggle(selSubject, s, setSubject)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {years.length > 0 && (
                  <div className="ef-row">
                    <div className="ef-label">年份</div>
                    <div className="ef-options">
                      <button type="button" className={`ef-btn${!selYear ? " active" : ""}`} onClick={() => setYear(null)}>全部</button>
                      {years.map(y => (
                        <button type="button" className={`ef-btn${selYear === y ? " active" : ""}`} key={y} onClick={() => toggle(selYear, y, setYear)}>{y}</button>
                      ))}
                    </div>
                  </div>
                )}
                {regions.length > 0 && (
                  <div className="ef-row">
                    <div className="ef-label">地区</div>
                    <div className="ef-options">
                      <button type="button" className={`ef-btn${!selRegion ? " active" : ""}`} onClick={() => setRegion(null)}>全部</button>
                      {regions.map(r => (
                        <button type="button" className={`ef-btn${selRegion === r ? " active" : ""}`} key={r} onClick={() => toggle(selRegion, r, setRegion)}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}
                {subjects.length === 0 && years.length === 0 && regions.length === 0 && (
                  <div className="ef-row">
                    <p className="tf-hint" style={{margin:0,fontSize:14}}>资源的标签暂不包含可筛选的科目、年份或地区信息。</p>
                  </div>
                )}
              </div>

              {hasFilters && (
                <div className="ef-active-tags">
                  {selSubject && <button type="button" className="ef-tag" onClick={() => setSubject(null)}>科目：{selSubject} ✕</button>}
                  {selYear && <button type="button" className="ef-tag" onClick={() => setYear(null)}>年份：{selYear} ✕</button>}
                  {selRegion && <button type="button" className="ef-tag" onClick={() => setRegion(null)}>地区：{selRegion} ✕</button>}
                  <button
                    type="button"
                    className="ef-tag-clear"
                    onClick={() => {
                        setSubject(null);
                        setYear(null);
                        setRegion(null);
                    }}
                  >
                    清空筛选
                  </button>
                </div>
              )}
            </div>

            <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">全部资源</h2>
                <p className="section-subtitle">
                  {hasFilters
                    ? `筛选结果 ${filtered.length} 条（共 ${resources.length} 条）`
                    : `共 ${resources.length} 条`}
                </p>
              </div>
              {hasFilters && (
                <button
                  className="btn-ghost"
                  onClick={() => { setSubject(null); setYear(null); setRegion(null); }}
                >
                  清除筛选
                </button>
              )}
            </div>

            {filtered.length > 0 ? (
              <ResourceListCompact items={filtered} />
            ) : (
              <div className="panel empty-state">
                <strong>没有符合条件的资源。</strong>
                <p className="muted">尝试更换筛选条件，或清除筛选查看全部资源。</p>
              </div>
            )}
          </section>
          </div>
        </div>
      </div>
    </>

  );
}
