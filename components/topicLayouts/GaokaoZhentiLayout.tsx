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

          {/* Hero */}
          <section className="page-hero panel">
            <span className="eyebrow">资料专题</span>
            <h1 className="page-title">{topic.name}</h1>
            <p className="page-copy">{topic.summary}</p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <span className="chip">{resources.length} 条资源</span>
              <Link
                className="chip"
                href={categorySlug ? `/category/${categorySlug}` : `/search?q=${encodeURIComponent(categoryName)}`}
              >
                {categoryName}
              </Link>
            </div>
          </section>

          {/* Filter panel */}
          <div className="tf-panel">
            {subjects.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">科目</span>
                <div className="tf-chips">
                  {subjects.map((s) => (
                    <button
                      key={s}
                      className={`tf-chip${selSubject === s ? " tf-chip--active" : ""}`}
                      onClick={() => toggle(selSubject, s, setSubject)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {years.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">年份</span>
                <div className="tf-chips">
                  {years.map((y) => (
                    <button
                      key={y}
                      className={`tf-chip${selYear === y ? " tf-chip--active" : ""}`}
                      onClick={() => toggle(selYear, y, setYear)}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {regions.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">地区</span>
                <div className="tf-chips">
                  {regions.map((r) => (
                    <button
                      key={r}
                      className={`tf-chip${selRegion === r ? " tf-chip--active" : ""}`}
                      onClick={() => toggle(selRegion, r, setRegion)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {subjects.length === 0 && years.length === 0 && regions.length === 0 && (
              <p className="tf-hint">资源的标签暂不包含可筛选的科目、年份或地区信息。</p>
            )}
          </div>

          {/* Results section */}
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
    </>
  );
}
