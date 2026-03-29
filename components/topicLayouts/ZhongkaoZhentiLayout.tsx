import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import { getZhongkaoApplicableRegions, getZhongkaoCity, sortZhongkaoRegions } from "@/lib/zhongkao";
import type { TopicLayoutProps } from "./types";

export default function ZhongkaoZhentiLayout({
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
  const [selCity, setCity] = useState<string | null>(null);

  const { subjects, years, regions } = useMemo(() => {
    const subjectSet = new Set<string>();
    const yearSet = new Set<string>();
    const regionSet = new Set<string>();

    for (const resource of resources) {
      if (typeof resource.meta?.subject === "string" && resource.meta.subject) {
        subjectSet.add(resource.meta.subject);
      }
      if (typeof resource.meta?.year === "string" && resource.meta.year) {
        yearSet.add(resource.meta.year);
      }
      for (const region of getZhongkaoApplicableRegions(resource)) {
        regionSet.add(region);
      }
    }

    return {
      subjects: Array.from(subjectSet).sort((a, b) => a.localeCompare(b, "zh-CN")),
      years: Array.from(yearSet).sort((a, b) => Number(b) - Number(a)),
      regions: sortZhongkaoRegions(Array.from(regionSet)),
    };
  }, [resources]);

  const defaultRegion = regions[0] ?? null;

  useEffect(() => {
    if (!defaultRegion) {
      if (selRegion !== null) {
        setRegion(null);
      }
      return;
    }

    if (!selRegion || !regions.includes(selRegion)) {
      setRegion(defaultRegion);
    }
  }, [defaultRegion, regions, selRegion]);

  const cities = useMemo(() => {
    if (!selRegion) {
      return [];
    }

    const citySet = new Set<string>();

    for (const resource of resources) {
      if (selSubject && resource.meta?.subject !== selSubject) continue;
      if (selYear && resource.meta?.year !== selYear) continue;
      if (!getZhongkaoApplicableRegions(resource).includes(selRegion)) continue;

      const city = getZhongkaoCity(resource);
      if (city) {
        citySet.add(city);
      }
    }

    return Array.from(citySet).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [resources, selRegion, selSubject, selYear]);

  useEffect(() => {
    if (selCity && !cities.includes(selCity)) {
      setCity(null);
    }
  }, [cities, selCity]);

  const filtered = useMemo(() => {
    return resources.filter((resource) => {
      if (selSubject && resource.meta?.subject !== selSubject) return false;
      if (selYear && resource.meta?.year !== selYear) return false;
      if (selRegion && !getZhongkaoApplicableRegions(resource).includes(selRegion)) return false;
      if (selCity && getZhongkaoCity(resource) !== selCity) return false;
      return true;
    });
  }, [resources, selCity, selRegion, selSubject, selYear]);

  const hasFilters =
    Boolean(selSubject) ||
    Boolean(selYear) ||
    Boolean(selCity) ||
    (Boolean(selRegion) && selRegion !== defaultRegion);

  function toggle<T>(current: T | null, value: T, setter: (next: T | null) => void) {
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
              .elegant-meta-badge--link {
                color: #2563eb;
                text-decoration: none;
                background: #eff6ff;
                border: 1px solid rgba(37, 99, 235, 0.12);
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
                  <Link className="elegant-meta-badge elegant-meta-badge--link" href={`/collections/${topic.slug}`}>
                    查看合集
                  </Link>
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
                      {subjects.map((subject) => (
                        <button type="button" className={`ef-btn${selSubject === subject ? " active" : ""}`} key={subject} onClick={() => toggle(selSubject, subject, setSubject)}>{subject}</button>
                      ))}
                    </div>
                  </div>
                )}
                {years.length > 0 && (
                  <div className="ef-row">
                    <div className="ef-label">年份</div>
                    <div className="ef-options">
                      <button type="button" className={`ef-btn${!selYear ? " active" : ""}`} onClick={() => setYear(null)}>全部</button>
                      {years.map((year) => (
                        <button type="button" className={`ef-btn${selYear === year ? " active" : ""}`} key={year} onClick={() => toggle(selYear, year, setYear)}>{year}</button>
                      ))}
                    </div>
                  </div>
                )}
                {regions.length > 0 && (
                  <div className="ef-row">
                    <div className="ef-label">省份</div>
                    <div className="ef-options">
                      <button type="button" className={`ef-btn${!selRegion ? " active" : ""}`} onClick={() => { setRegion(null); setCity(null); }}>全部</button>
                      {regions.map((region) => (
                        <button type="button" className={`ef-btn${selRegion === region ? " active" : ""}`} key={region} onClick={() => { setRegion(region); setCity(null); }}>{region}</button>
                      ))}
                    </div>
                  </div>
                )}
                {cities.length > 0 && (
                  <div className="ef-row">
                    <div className="ef-label">城市</div>
                    <div className="ef-options">
                      <button type="button" className={`ef-btn${!selCity ? " active" : ""}`} onClick={() => setCity(null)}>全部</button>
                      {cities.map((city) => (
                        <button type="button" className={`ef-btn${selCity === city ? " active" : ""}`} key={city} onClick={() => toggle(selCity, city, setCity)}>{city}</button>
                      ))}
                    </div>
                  </div>
                )}
                {selRegion && cities.length === 0 && (
                  <div className="ef-row">
                    <div className="ef-label">城市</div>
                    <p className="tf-hint" style={{margin:0,paddingTop:4,fontSize:14}}>当前省份下暂无可继续细分的城市数据。</p>
                  </div>
                )}
                {subjects.length === 0 && years.length === 0 && regions.length === 0 && cities.length === 0 && (
                  <div className="ef-row">
                    <p className="tf-hint" style={{margin:0,fontSize:14}}>资源的标签暂不包含可筛选的科目、年份、地区或城市信息。</p>
                  </div>
                )}
              </div>

              {hasFilters && (
                <div className="ef-active-tags">
                  {selSubject && <button type="button" className="ef-tag" onClick={() => setSubject(null)}>科目：{selSubject} ✕</button>}
                  {selYear && <button type="button" className="ef-tag" onClick={() => setYear(null)}>年份：{selYear} ✕</button>}
                  {selRegion && (selRegion !== defaultRegion) && <button type="button" className="ef-tag" onClick={() => { setRegion(defaultRegion); setCity(null); }}>省份：{selRegion} ✕</button>}
                  {selCity && <button type="button" className="ef-tag" onClick={() => setCity(null)}>城市：{selCity} ✕</button>}
                  <button
                    type="button"
                    className="ef-tag-clear"
                    onClick={() => {
                        setSubject(null);
                        setYear(null);
                        setRegion(defaultRegion);
                        setCity(null);
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
                  onClick={() => {
                    setSubject(null);
                    setYear(null);
                    setRegion(defaultRegion);
                    setCity(null);
                  }}
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
