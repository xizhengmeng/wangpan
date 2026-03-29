import Link from "next/link";
import { useMemo, useState } from "react";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import { Resource } from "@/lib/types";
import type { TopicLayoutProps } from "./types";

const GRADE_ORDER = ["七年级", "八年级", "九年级"];
const TYPE_ORDER = ["一课一练", "单元测试", "月考", "期中", "期末", "知识总结", "综合测试", "专项提升", "预习导学"];
const SUBJECT_ORDER = ["语文", "数学", "英语", "物理", "化学", "生物", "道法", "政治", "历史", "地理", "科学", "道德与法治", "综合", "信息技术", "体育", "音乐", "美术"];
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

function getResourceSubject(resource: Resource) {
  if (typeof resource.meta?.subject === "string" && resource.meta.subject) {
    return resource.meta.subject;
  }
  return resource.tags.find((tag) => SUBJECT_ORDER.includes(tag)) || "";
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
  const [subjectFilter, setSubjectFilter] = useState("");
  const [editionFilter, setEditionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const gradeOptions = useMemo(
    () => sortByPreset(Array.from(new Set(resources.map(getResourceGrade).filter(Boolean))), GRADE_ORDER),
    [resources]
  );
  const subjectOptions = useMemo(
    () => sortByPreset(Array.from(new Set(resources.map(getResourceSubject).filter(Boolean))), SUBJECT_ORDER),
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
        const subj = getResourceSubject(resource);
        const editions = getResourceEditions(resource);
        const types = getResourceTypes(resource);

        if (gradeFilter && grade !== gradeFilter) return false;
        if (subjectFilter && subj !== subjectFilter) return false;
        if (editionFilter && !editions.includes(editionFilter)) return false;
        if (typeFilter && !types.includes(typeFilter)) return false;
        return true;
      }),
    [editionFilter, gradeFilter, subjectFilter, resources, typeFilter]
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
                  {filteredResources.length !== resources.length && (
                    <span className="elegant-meta-badge" style={{ background: "#e0f2fe", color: "#1d4ed8" }}>
                      筛选结果 {filteredResources.length} 份
                    </span>
                  )}
                </div>
              </div>

              <div className="elegant-filters">
                <div className="ef-row">
                  <div className="ef-label">年级</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!gradeFilter ? " active" : ""}`} onClick={() => setGradeFilter("")}>全部</button>
                    {gradeOptions.map(option => (
                      <button type="button" className={`ef-btn${gradeFilter === option ? " active" : ""}`} key={option} onClick={() => setGradeFilter(option)}>{option}</button>
                    ))}
                  </div>
                </div>

                <div className="ef-row">
                  <div className="ef-label">科目</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!subjectFilter ? " active" : ""}`} onClick={() => setSubjectFilter("")}>全部</button>
                    {subjectOptions.map(option => (
                      <button type="button" className={`ef-btn${subjectFilter === option ? " active" : ""}`} key={option} onClick={() => setSubjectFilter(option)}>{option}</button>
                    ))}
                  </div>
                </div>

                <div className="ef-row">
                  <div className="ef-label">版本</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!editionFilter ? " active" : ""}`} onClick={() => setEditionFilter("")}>全部</button>
                    {editionOptions.map(option => (
                      <button type="button" className={`ef-btn${editionFilter === option ? " active" : ""}`} key={option} onClick={() => setEditionFilter(option)}>{option}</button>
                    ))}
                  </div>
                </div>

                <div className="ef-row">
                  <div className="ef-label">类型</div>
                  <div className="ef-options">
                    <button type="button" className={`ef-btn${!typeFilter ? " active" : ""}`} onClick={() => setTypeFilter("")}>全部</button>
                    {typeOptions.map(option => (
                      <button type="button" className={`ef-btn${typeFilter === option ? " active" : ""}`} key={option} onClick={() => setTypeFilter(option)}>{option}</button>
                    ))}
                  </div>
                </div>
              </div>

              {(gradeFilter || subjectFilter || editionFilter || typeFilter) && (
                <div className="ef-active-tags">
                  {gradeFilter && <button type="button" className="ef-tag" onClick={() => setGradeFilter("")}>年级：{gradeFilter} ✕</button>}
                  {subjectFilter && <button type="button" className="ef-tag" onClick={() => setSubjectFilter("")}>科目：{subjectFilter} ✕</button>}
                  {editionFilter && <button type="button" className="ef-tag" onClick={() => setEditionFilter("")}>版本：{editionFilter} ✕</button>}
                  {typeFilter && <button type="button" className="ef-tag" onClick={() => setTypeFilter("")}>类型：{typeFilter} ✕</button>}
                  <button
                    type="button"
                    className="ef-tag-clear"
                    onClick={() => {
                      setGradeFilter("");
                      setSubjectFilter("");
                      setEditionFilter("");
                      setTypeFilter("");
                    }}
                  >
                    清空筛选
                  </button>
                </div>
              )}
            </div>

            <section className="section">
              {filteredResources.length > 0 ? (
                <ResourceListCompact items={filteredResources} />
              ) : (
                <div className="panel empty-state" style={{ padding: "60px 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
                  <strong style={{ fontSize: 16 }}>当前筛选条件下没有找到资源</strong>
                  <p className="muted" style={{ marginTop: 8 }}>请尝试放宽筛选条件，或清空筛选</p>
                  <button type="button" className="button" style={{ marginTop: 20 }} onClick={() => { setGradeFilter(""); setSubjectFilter(""); setEditionFilter(""); setTypeFilter(""); }}>
                    清空筛选
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
