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

          <div className="tf-panel">
            {subjects.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">科目</span>
                <div className="tf-chips">
                  {subjects.map((subject) => (
                    <button
                      key={subject}
                      className={`tf-chip${selSubject === subject ? " tf-chip--active" : ""}`}
                      onClick={() => toggle(selSubject, subject, setSubject)}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {years.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">年份</span>
                <div className="tf-chips">
                  {years.map((year) => (
                    <button
                      key={year}
                      className={`tf-chip${selYear === year ? " tf-chip--active" : ""}`}
                      onClick={() => toggle(selYear, year, setYear)}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {regions.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">省份</span>
                <div className="tf-chips">
                  {regions.map((region) => (
                    <button
                      key={region}
                      className={`tf-chip${selRegion === region ? " tf-chip--active" : ""}`}
                      onClick={() => {
                        setRegion(region);
                        setCity(null);
                      }}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cities.length > 0 && (
              <div className="tf-row">
                <span className="tf-label">城市</span>
                <div className="tf-chips">
                  {cities.map((city) => (
                    <button
                      key={city}
                      className={`tf-chip${selCity === city ? " tf-chip--active" : ""}`}
                      onClick={() => toggle(selCity, city, setCity)}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selRegion && cities.length === 0 && (
              <div className="tf-row">
                <span className="tf-label">城市</span>
                <p className="tf-hint">当前省份下暂无可继续细分的城市数据。</p>
              </div>
            )}

            {subjects.length === 0 && years.length === 0 && regions.length === 0 && cities.length === 0 && (
              <p className="tf-hint">资源的标签暂不包含可筛选的科目、年份、地区或城市信息。</p>
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
    </>
  );
}
