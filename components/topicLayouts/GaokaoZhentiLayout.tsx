import { useMemo, useState } from "react";
import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import type { TopicLayoutProps } from "./types";

const REGION_ORDER = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江", "江苏", "浙江", "安徽",
  "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "海南", "四川", "贵州", "云南", "陕西",
  "甘肃", "青海", "内蒙古", "广西", "西藏", "宁夏", "新疆",
];
const REGION_INDEX = new Map(REGION_ORDER.map((region, index) => [region, index]));

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

  function getRegions(meta?: Record<string, string | string[]>) {
    const regions = meta?.applicable_regions;
    if (Array.isArray(regions)) {
      return regions.filter(Boolean);
    }
    if (typeof meta?.region === "string" && meta.region) {
      return [meta.region];
    }
    return [];
  }

  const { subjects, years, regions } = useMemo(() => {
    const s = new Set<string>();
    const y = new Set<string>();
    const r = new Set<string>();
    for (const res of resources) {
      if (typeof res.meta?.subject === "string") s.add(res.meta.subject);
      if (typeof res.meta?.year === "string") y.add(res.meta.year);
      for (const region of getRegions(res.meta)) {
        r.add(region);
      }
    }
    return {
      subjects: Array.from(s).sort(),
      years: Array.from(y).sort((a, b) => Number(b) - Number(a)),
      regions: Array.from(r).sort((a, b) => {
        const aIndex = REGION_INDEX.has(a) ? REGION_INDEX.get(a)! : Number.MAX_SAFE_INTEGER;
        const bIndex = REGION_INDEX.has(b) ? REGION_INDEX.get(b)! : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        return a.localeCompare(b, "zh-CN");
      }),
    };
  }, [resources]);

  const filtered = useMemo(() => {
    return resources.filter((res) => {
      if (selSubject && res.meta?.subject !== selSubject) return false;
      if (selYear    && res.meta?.year    !== selYear)    return false;
      if (selRegion && !getRegions(res.meta).includes(selRegion)) return false;
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
