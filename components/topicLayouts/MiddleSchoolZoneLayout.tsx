import Link from "next/link";
import { useMemo, useState } from "react";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import { Resource } from "@/lib/types";
import type { TopicLayoutProps } from "./types";

const GRADE_ORDER = ["七年级", "八年级", "九年级"];
const TYPE_ORDER = ["一课一练", "单元测试", "月考", "期中", "期末", "知识总结", "综合测试", "专项提升", "预习导学"];
const EDITION_LABELS: Record<string, string> = {
  renjiao: "人教版",
  pep: "人教PEP",
  jijiao: "冀教版",
  beishi: "北师版",
  beijing: "北京版",
  huashi: "华师版",
  lujiao: "鲁教版",
  waiyan: "外研版",
  yilin: "译林版",
  qingdao: "青岛版",
  shanghai: "上海版",
  hujiao: "沪教版",
  sujiao: "苏教版",
  ludiao54: "鲁教54制",
  qingdao63: "青岛63制",
  xiangjiaoban: "湘教版",
  xiangjiao: "湘教版",
  zhejiao: "浙教版",
  kexue: "科学版",
  shanghaijiaoyu: "上海教育版",
};

function getResourceGrade(resource: Resource) {
  return resource.tags.find((tag) => GRADE_ORDER.includes(tag)) || "";
}

function normalizeEditionLabel(value: string) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  return EDITION_LABELS[key] || value;
}

function getResourceEditions(resource: Resource) {
  const editions = resource.meta?.editions;
  if (Array.isArray(editions)) {
    return editions.map((item) => normalizeEditionLabel(String(item))).filter(Boolean);
  }
  return resource.tags
    .filter((tag) => /版$/.test(tag) || /教$/.test(tag) || /PEP/i.test(tag))
    .map((tag) => normalizeEditionLabel(tag));
}

function getResourceTypes(resource: Resource) {
  const kinds = resource.meta?.content_kinds;
  if (Array.isArray(kinds)) {
    return kinds.map((item) => String(item)).filter(Boolean);
  }
  return resource.tags.filter((tag) => TYPE_ORDER.includes(tag));
}

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

export default function MiddleSchoolZoneLayout({
  topic,
  categoryName,
  categorySlug,
  channelName,
  channelSlug,
  resources,
}: TopicLayoutProps) {
  const [gradeFilter, setGradeFilter] = useState("");
  const [editionFilter, setEditionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const gradeOptions = useMemo(
    () => sortByPreset(Array.from(new Set(resources.map(getResourceGrade).filter(Boolean))), GRADE_ORDER),
    [resources]
  );
  const editionOptions = useMemo(
    () => sortByPreset(Array.from(new Set(resources.flatMap(getResourceEditions))), []),
    [resources]
  );
  const typeOptions = useMemo(
    () => sortByPreset(Array.from(new Set(resources.flatMap(getResourceTypes))), TYPE_ORDER),
    [resources]
  );

  const filteredResources = useMemo(
    () =>
      resources.filter((resource) => {
        const grade = getResourceGrade(resource);
        const editions = getResourceEditions(resource);
        const types = getResourceTypes(resource);

        if (gradeFilter && grade !== gradeFilter) return false;
        if (editionFilter && !editions.includes(editionFilter)) return false;
        if (typeFilter && !types.includes(typeFilter)) return false;
        return true;
      }),
    [editionFilter, gradeFilter, resources, typeFilter]
  );

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
            <span className="eyebrow">初中资料专题</span>
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
              <span className="chip">{filteredResources.length} 条筛选结果</span>
            </div>
          </section>

          <section className="panel topic-filter-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">按条件筛选</h2>
                <p className="section-subtitle">支持按年级、版本和资料类型快速缩小范围。</p>
              </div>
            </div>

            <div className="topic-filter-grid">
              <div className="topic-filter-field">
                <span>年级</span>
                <div className="topic-filter-options">
                  <button type="button" className={`topic-filter-chip${!gradeFilter ? " topic-filter-chip--active" : ""}`} onClick={() => setGradeFilter("")}>
                    全部
                  </button>
                  {gradeOptions.map((option) => (
                    <button
                      type="button"
                      className={`topic-filter-chip${gradeFilter === option ? " topic-filter-chip--active" : ""}`}
                      key={option}
                      onClick={() => setGradeFilter(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="topic-filter-field">
                <span>版本</span>
                <div className="topic-filter-options">
                  <button type="button" className={`topic-filter-chip${!editionFilter ? " topic-filter-chip--active" : ""}`} onClick={() => setEditionFilter("")}>
                    全部
                  </button>
                  {editionOptions.map((option) => (
                    <button
                      type="button"
                      className={`topic-filter-chip${editionFilter === option ? " topic-filter-chip--active" : ""}`}
                      key={option}
                      onClick={() => setEditionFilter(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="topic-filter-field">
                <span>类型</span>
                <div className="topic-filter-options">
                  <button type="button" className={`topic-filter-chip${!typeFilter ? " topic-filter-chip--active" : ""}`} onClick={() => setTypeFilter("")}>
                    全部
                  </button>
                  {typeOptions.map((option) => (
                    <button
                      type="button"
                      className={`topic-filter-chip${typeFilter === option ? " topic-filter-chip--active" : ""}`}
                      key={option}
                      onClick={() => setTypeFilter(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(gradeFilter || editionFilter || typeFilter) && (
              <div className="chip-row topic-filter-tags">
                {gradeFilter && <button type="button" className="chip chip--button" onClick={() => setGradeFilter("")}>年级：{gradeFilter} ×</button>}
                {editionFilter && <button type="button" className="chip chip--button" onClick={() => setEditionFilter("")}>版本：{editionFilter} ×</button>}
                {typeFilter && <button type="button" className="chip chip--button" onClick={() => setTypeFilter("")}>类型：{typeFilter} ×</button>}
                <button
                  type="button"
                  className="chip chip--button"
                  onClick={() => {
                    setGradeFilter("");
                    setEditionFilter("");
                    setTypeFilter("");
                  }}
                >
                  清空筛选
                </button>
              </div>
            )}
          </section>

          <section className="section">
            {filteredResources.length > 0 ? (
              <ResourceListCompact items={filteredResources} />
            ) : (
              <div className="panel empty-state">
                <strong>当前筛选条件下没有匹配资源。</strong>
                <p className="muted">可以调整年级、版本或资料类型后再试。</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
