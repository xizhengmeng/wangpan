import { GetServerSideProps } from "next";
import Link from "next/link";

import { FeedbackButton } from "@/components/FeedbackButton";
import { ResourceDownloadEntry } from "@/components/ResourceDownloadEntry";
import { Seo } from "@/components/Seo";
import { TrackView } from "@/components/TrackView";
import { getExamTopicConfig } from "@/lib/examTopics";
import { formatDate, slugify } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { getGaokaoMetaString } from "@/lib/gaokao";
import { getContentStructure, getPublishedResources, getResolvedDownloadUrlForResource, getResourceBySlug } from "@/lib/store";
import { Resource, ResourceItem } from "@/lib/types";
import { getZhongkaoCity, getZhongkaoMetaString } from "@/lib/zhongkao";

interface ResourcePageProps {
  resource: Resource | null;
  related: Resource[];
  offline: boolean;
  downloadUrl: string | null;
  examTopic: {
    slug: "gaokaozhenti" | "zhongkaozhenti";
    name: string;
  } | null;
}

const META_FIELDS: Record<
  string,
  {
    label: string;
    visible?: boolean;
    format?: (value: string | number | boolean | Array<string | number | boolean>) => string;
  }
> = {
  year: { label: "年份" },
  subject: { label: "科目" },
  grade: { label: "年级" },
  region: { label: "地区" },
  province: { label: "省份" },
  volume: { label: "卷册" },
  edition: { label: "版本" },
  publisher: { label: "出版社" },
  difficulty: { label: "难度" },
  type: { label: "类型" },
  semester: { label: "学期" },
  course: { label: "课程" },
  city: { label: "城市" },
  paper_variant: { label: "卷型" },
  paper_version: { label: "卷别" },
  content_kinds: { label: "内容类型" },
  file_count: { label: "文件数" },
  item_count: { label: "资料数" },
  file_formats: { label: "文件格式" },
  formats: { label: "格式" },
  has_answer: { label: "包含答案" },
  has_analysis: { label: "包含解析" },
  has_audio: { label: "包含音频" },
  subjects: { label: "科目覆盖" },
  editions: { label: "教材版本" },
  years: { label: "年份" },
  source: {
    label: "来源",
    visible: false,
    format: (value) => String(value),
  },
  source_type: { label: "来源类型", visible: false },
  raw_title: { label: "原始标题", visible: false },
  normalized_title: { label: "规范标题", visible: false },
  link_owner: { label: "链接归属", visible: false },
  inferred_topic_slug: { label: "专题映射", visible: false },
  inferred_channel_slug: { label: "频道映射", visible: false },
  inferred_category_slug: { label: "分类映射", visible: false },
};

function metaLabel(key: string) {
  return META_FIELDS[key]?.label ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetaValue(value: string | number | boolean | Array<string | number | boolean>) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("、");
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return String(value);
}

function getVisibleMetaEntries(resource: Resource) {
  if (!resource.meta) {
    return [];
  }

  return Object.entries(resource.meta)
    .filter(([key, value]) => {
      if (!value || key === "tags" || key.startsWith("source_")) {
        return false;
      }
      return META_FIELDS[key]?.visible !== false;
    })
    .map(([key, value]) => {
      const formatter = META_FIELDS[key]?.format;
      return [key, formatter ? formatter(value) : formatMetaValue(value)] as const;
    });
}

function getResourceItemMeta(item: ResourceItem) {
  return [item.subject, item.edition, item.year ? `${item.year}` : null, item.has_answer ? "含答案" : null]
    .filter(Boolean)
    .join(" / ");
}

function getMetaStringArray(resource: Resource, key: string) {
  const value = resource.meta?.[key];
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function getExamHeadline(resource: Resource, examSlug: "gaokaozhenti" | "zhongkaozhenti") {
  const year = examSlug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "year") : getGaokaoMetaString(resource, "year");
  const subject = examSlug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "subject") : getGaokaoMetaString(resource, "subject");
  const region = examSlug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "region") : getGaokaoMetaString(resource, "region");
  const city = examSlug === "zhongkaozhenti" ? getZhongkaoCity(resource) : null;
  const kinds = getMetaStringArray(resource, "content_kinds");
  const kindLabel = kinds.length > 0 ? kinds.join("、") : null;
  const examName = examSlug === "zhongkaozhenti" ? "中考" : "高考";
  const area = [region, city].filter(Boolean).join("");
  const base = [year ? `${year}年` : null, area, examName, subject].filter(Boolean).join("");

  return kindLabel
    ? `${base}资料页，当前收录 ${kindLabel}，可用于${examName}复习、真题训练和考前查漏补缺。`
    : `${base}资料页，适合用于${examName}复习、真题练习和同地区试卷对照。`;
}

function getExamScenarios(resource: Resource, examSlug: "gaokaozhenti" | "zhongkaozhenti") {
  const kinds = getMetaStringArray(resource, "content_kinds");
  const examName = examSlug === "zhongkaozhenti" ? "中考" : "高考";
  const scenarios = new Set<string>([
    `用于${examName}历年真题训练与阶段复习`,
    "按年份和地区对照题型变化",
    "结合同科目真题做专项刷题",
  ]);

  if (kinds.some((item) => item.includes("答案"))) {
    scenarios.add("适合课后核对答案与自我订正");
  }
  if (kinds.some((item) => item.includes("解析"))) {
    scenarios.add("适合讲评课或错题复盘时参考解析");
  }
  if (kinds.some((item) => item.includes("听力"))) {
    scenarios.add("适合英语听力专项训练");
  }

  return Array.from(scenarios).slice(0, 4);
}

function getExamHubLinks(resource: Resource, examTopic: { slug: "gaokaozhenti" | "zhongkaozhenti"; name: string }) {
  const year = examTopic.slug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "year") : getGaokaoMetaString(resource, "year");
  const subject = examTopic.slug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "subject") : getGaokaoMetaString(resource, "subject");
  const region = examTopic.slug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "region") : getGaokaoMetaString(resource, "region");
  const examName = examTopic.slug === "zhongkaozhenti" ? "中考" : "高考";

  return [
    { href: `/topic/${examTopic.slug}`, label: `${examTopic.name}汇总` },
    subject ? { href: `/topic/${examTopic.slug}/subject/${encodeURIComponent(subject)}`, label: `${subject}${examName}真题` } : null,
    region ? { href: `/topic/${examTopic.slug}/region/${encodeURIComponent(region)}`, label: `${region}${examName}真题` } : null,
    year && region ? { href: `/topic/${examTopic.slug}/${year}/${encodeURIComponent(region)}`, label: `${year}年${region}${examName}真题` } : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;
}

function getExamFaqs(resource: Resource, examSlug: "gaokaozhenti" | "zhongkaozhenti") {
  const year = examSlug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "year") : getGaokaoMetaString(resource, "year");
  const subject = examSlug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "subject") : getGaokaoMetaString(resource, "subject");
  const region = examSlug === "zhongkaozhenti" ? getZhongkaoMetaString(resource, "region") : getGaokaoMetaString(resource, "region");
  const city = examSlug === "zhongkaozhenti" ? getZhongkaoCity(resource) : null;
  const examName = examSlug === "zhongkaozhenti" ? "中考" : "高考";
  const kinds = getMetaStringArray(resource, "content_kinds");
  const area = [region, city].filter(Boolean).join("");

  return [
    {
      q: `这份资料对应哪一年的${examName}真题？`,
      a: year ? `这份资料对应 ${year} 年${area}${subject ? `${subject}` : ""}${examName}真题。` : `这是一份${area}${subject ? `${subject}` : ""}${examName}真题资料。`,
    },
    {
      q: "这份资料包含哪些内容？",
      a: kinds.length > 0 ? `当前收录内容类型包括：${kinds.join("、")}。` : "当前页面已整理基础真题信息，下载内容以后续补链结果为准。",
    },
    {
      q: `如何继续查看同地区或同科目的${examName}真题？`,
      a: `可以通过页面下方的聚合入口继续浏览同地区、同科目或同年份的${examName}真题汇总。`,
    },
  ];
}

function rankDefaultRelated(resource: Resource, items: Resource[]) {
  return items
    .filter(
      (item) =>
        item.id !== resource.id &&
        (item.category === resource.category ||
          item.tags.some((tag) => resource.tags.includes(tag)))
    )
    .slice(0, 6);
}

function rankExamRelated(resource: Resource, items: Resource[], examSlug: "gaokaozhenti" | "zhongkaozhenti") {
  const config = getExamTopicConfig(examSlug);
  if (!config) {
    return rankDefaultRelated(resource, items);
  }

  const year = config.getYear(resource);
  const subject = config.getSubject(resource);
  const regions = new Set(config.getApplicableRegions(resource));
  const city = examSlug === "zhongkaozhenti" ? getZhongkaoCity(resource) : null;
  const paperVariant =
    examSlug === "zhongkaozhenti"
      ? getZhongkaoMetaString(resource, "paper_variant")
      : getGaokaoMetaString(resource, "paper_version");

  return items
    .filter((item) => item.id !== resource.id && item.topic_ids?.some((topicId) => resource.topic_ids?.includes(topicId)))
    .map((item) => {
      let score = 0;
      const itemRegions = new Set(config.getApplicableRegions(item));

      score += 100;
      if (config.getSubject(item) === subject) score += 35;
      if (config.getYear(item) === year) score += 28;
      if ([...itemRegions].some((region) => regions.has(region))) score += 24;
      if (examSlug === "zhongkaozhenti" && city && getZhongkaoCity(item) === city) score += 30;

      const itemVariant =
        examSlug === "zhongkaozhenti"
          ? getZhongkaoMetaString(item, "paper_variant")
          : getGaokaoMetaString(item, "paper_version");
      if (paperVariant && itemVariant === paperVariant) score += 12;

      if (item.tags.some((tag) => resource.tags.includes(tag))) score += 6;

      return { item, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.item.updated_at).getTime() - new Date(a.item.updated_at).getTime();
    })
    .slice(0, 6)
    .map((entry) => entry.item);
}

export default function ResourcePage({ resource, related, offline, downloadUrl, examTopic }: ResourcePageProps) {
  if (!resource) return null;

  const visibleTags = resource.tags.filter((tag) => slugify(tag) !== "52wei");
  const description = resource.summary;
  const metaDisplayEntries = getVisibleMetaEntries(resource);
  const resourceItems = resource.items || [];
  const isExamResource = Boolean(examTopic);
  const examIntro = examTopic ? getExamHeadline(resource, examTopic.slug) : null;
  const examScenarios = examTopic ? getExamScenarios(resource, examTopic.slug) : [];
  const examHubLinks = examTopic ? getExamHubLinks(resource, examTopic) : [];
  const examFaqs = examTopic ? getExamFaqs(resource, examTopic.slug) : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: resource.title,
    description,
    datePublished: resource.published_at,
    dateModified: resource.updated_at,
    image: resource.cover,
    url: absoluteUrl(`/resource/${resource.slug}`)
  };

  const seoKeywords = [...visibleTags, resource.category, "夸克网盘下载", "网盘资源"].filter(Boolean).join(",");
  const seoDescription = description ? `${description}。该资源属于${resource.category}分类，包含标签：${visibleTags.join("、")}。` : `${resource.title}夸克网盘下载。`;
  const title = offline ? `${resource.title} 已下线` : `${resource.title} - 免费下载`;

  return (
    <>
      <Seo
        title={title}
        description={seoDescription}
        path={`/resource/${resource.slug}`}
        image={resource.cover}
        noindex={offline}
        keywords={seoKeywords}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {!offline && <TrackView name="resource_detail_view" payload={{ resource_id: resource.id }} />}

      <div className="page-shell resource-page-shell">
        <div className="container">
          {/* Breadcrumb */}
          {!offline && resource.channel_id && (
            <nav className="breadcrumb">
              <Link href="/">首页</Link>
              <span className="breadcrumb__sep">›</span>
              <Link href={`/search?q=${encodeURIComponent(resource.category)}`}>{resource.category}</Link>
              <span className="breadcrumb__sep">›</span>
              <span>{resource.title}</span>
            </nav>
          )}

          <section className="elegant-res-hero">
            <span className="elegant-res-eyebrow">{offline ? "资源已下线" : "夸克网盘资料"}</span>
            <h1 className="elegant-res-title">{resource.title}</h1>
            <div className="elegant-res-pills">
              <span className="elegant-res-pill">🗂️ {resource.category}</span>
              {metaDisplayEntries.slice(0, 4).map(([k, v]) => (
                <span className="elegant-res-pill" key={k}>{metaLabel(k)}：{v}</span>
              ))}
              <span className="elegant-res-pill">⏱️ 更新 {formatDate(resource.updated_at)}</span>
            </div>
          </section>

          {/* Two-column main layout */}
          <div className="resource-layout">

            {/* ── 左侧主内容 ── */}
            <article className="resource-main panel">

              {/* 资源摘要 */}
              <h2 className="elegant-res-section-title">资源简介</h2>
              <p className="resource-desc">
                {offline
                  ? "该资源已被下线或需要重新校验。页面返回 410，利于搜索引擎清理失效内容。"
                  : resource.summary}
              </p>

              {isExamResource && examIntro && (
                <>
                  <h2 className="elegant-res-section-title">资料说明</h2>
                  <div className="resource-copy-block">
                    <p>{examIntro}</p>
                    <p>
                      页面已整理这份资料的年份、科目、地区、城市和内容类型等结构化信息，
                      方便继续查看同地区、同科目和同年份的考试真题汇总。
                    </p>
                  </div>
                </>
              )}

              {/* 结构化元数据 表格 */}
              {metaDisplayEntries.length > 0 && (
                <>
                  <h2 className="elegant-res-section-title">详细信息</h2>
                  <dl className="resource-info-list">
                    {metaDisplayEntries.map(([k, v]) => (
                      <div className="resource-info-row" key={k}>
                        <dt className="resource-info-row__label">{metaLabel(k)}</dt>
                        <dd className="resource-info-row__value">{v}</dd>
                      </div>
                    ))}
                    <div className="resource-info-row">
                      <dt className="resource-info-row__label">分类</dt>
                      <dd className="resource-info-row__value">
                        <Link href={`/search?q=${encodeURIComponent(resource.category)}`}>{resource.category}</Link>
                      </dd>
                    </div>
                    <div className="resource-info-row">
                      <dt className="resource-info-row__label">发布时间</dt>
                      <dd className="resource-info-row__value">{formatDate(resource.published_at)}</dd>
                    </div>
                    <div className="resource-info-row">
                      <dt className="resource-info-row__label">最近更新</dt>
                      <dd className="resource-info-row__value">{formatDate(resource.updated_at)}</dd>
                    </div>
                  </dl>
                </>
              )}

              {isExamResource && examScenarios.length > 0 && (
                <>
                  <h2 className="elegant-res-section-title">适用场景</h2>
                  <ul className="resource-bullet-list">
                    {examScenarios.map((scenario) => (
                      <li key={scenario}>{scenario}</li>
                    ))}
                  </ul>
                </>
              )}

              {resourceItems.length > 0 && (
                <>
                  <h2 className="elegant-res-section-title">包含内容</h2>
                  <div className="resource-items-summary">
                    当前资料包共整理 <strong>{resourceItems.length}</strong> 份内容，可先浏览清单再决定是否转存到夸克网盘。
                  </div>
                  <ul className="resource-item-list">
                    {resourceItems.map((item) => (
                      <li className="resource-item-row" key={item.id}>
                        <div className="resource-item-row__body">
                          <strong className="resource-item-row__title">{item.title}</strong>
                          {(item.description || getResourceItemMeta(item)) && (
                            <p className="resource-item-row__meta">
                              {item.description || getResourceItemMeta(item)}
                            </p>
                          )}
                        </div>
                        <span className="resource-item-row__badge">
                          {item.file_ext ? item.file_ext.toUpperCase() : "资料"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {isExamResource && examHubLinks.length > 0 && (
                <div className="resource-tags-wrap">
                  <h2 className="elegant-res-section-title">继续浏览</h2>
                  <div className="tag-cloud">
                    {examHubLinks.map((item) => (
                      <Link className="tag" href={item.href} key={item.href}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 标签云 */}
              {visibleTags.length > 0 && (
                <div className="resource-tags-wrap">
                  <h2 className="elegant-res-section-title">相关标签</h2>
                  <div className="tag-cloud">
                    {visibleTags.map((tag) => (
                      <Link className="tag" href={`/tag/${slugify(tag)}`} key={tag}>{tag}</Link>
                    ))}
                  </div>
                </div>
              )}

              {isExamResource && examFaqs.length > 0 && (
                <>
                  <h2 className="elegant-res-section-title">常见问题</h2>
                  <div className="resource-faq-list">
                    {examFaqs.map((item) => (
                      <div className="resource-faq-item" key={item.q}>
                        <strong>{item.q}</strong>
                        <p>{item.a}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>

            {/* ── 右侧下载卡 ── */}
            <aside className="sticky-card">
              {/* 封面预览 */}
              {resource.cover && (
                <div className="resource-cover resource-cover--sidebar">
                  <img src={resource.cover} alt={resource.title} />
                </div>
              )}

              <strong className="sticky-card__title">
                {offline ? "资源状态" : "夸克网盘下载"}
              </strong>
              <p className="muted">
                {offline
                  ? "该资源当前不可用，请联系站长补充。"
                  : downloadUrl
                    ? "电脑端点击按钮会弹出二维码，使用手机夸克扫码即可下载；移动端点击会直接跳转。"
                    : "点击下方按钮后，系统会尝试搜索当前资源的可用下载链接，最多等待 10 秒。"}
              </p>

              {!offline && (
                <ResourceDownloadEntry
                  initialDownloadUrl={downloadUrl}
                  resourceId={resource.id}
                />
              )}

              {resource.extract_code && (
                <div className="code-block" style={{ marginTop: 10 }}>
                  提取码：{resource.extract_code}
                </div>
              )}

              {/* 状态 */}
              <div className="info-list" style={{ marginTop: 14 }}>
                <div className="info-item">
                  <span>状态</span>
                  <strong>{offline ? "已下线" : downloadUrl ? "✅ 可下载" : "🔄 搜索入口中"}</strong>
                </div>
                {metaDisplayEntries.slice(0, 6).map(([k, v]) => (
                  <div className="info-item" key={k}>
                    <span>{metaLabel(k)}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>

              {!offline && <FeedbackButton resourceId={resource.id} />}
            </aside>
          </div>

          {/* ── 相关资源：全宽紧凑列表，置于主布局之外 ── */}
          {related.length > 0 && (
            <section className="related-section panel">
              <div className="section-head">
                <div>
                  <h2 className="section-title">相关资源</h2>
                  <p className="section-subtitle">
                    {examTopic ? "同地区、同科目或同年份的相关真题资料" : "同分类或同标签的其他资料"}
                  </p>
                </div>
                <Link href={`/search?q=${encodeURIComponent(resource.category)}`} className="related-more">
                  更多 {resource.category} →
                </Link>
              </div>
              <ul className="related-list">
                {related.map((item) => (
                  <li key={item.id} className="related-list__item">
                    <Link href={`/resource/${item.slug}`} className="related-list__link">
                      <span className="related-list__title">{item.title}</span>
                      <span className="related-list__meta">
                        <span className="meta-pill meta-pill--xs">{item.category}</span>
                        <span className="meta-pill meta-pill--xs">更新 {formatDate(item.updated_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <style jsx>{`
        .elegant-res-hero {
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          padding: 40px 32px;
          margin-bottom: 28px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
          position: relative;
          overflow: hidden;
        }
        .elegant-res-hero::before {
          content: "";
          position: absolute;
          top: 0; right: 0; width: 300px; height: 100%;
          background: radial-gradient(circle at top right, rgba(37, 99, 235, 0.05), transparent 70%);
        }
        .elegant-res-eyebrow {
          color: #2563eb;
          background: #eff6ff;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          display: inline-block;
          margin-bottom: 16px;
        }
        .elegant-res-title {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.3;
          margin: 0 0 16px 0;
          letter-spacing: -0.5px;
        }
        .elegant-res-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .elegant-res-pill {
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          color: #475569;
          display: inline-flex;
          align-items: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .elegant-res-section-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin: 32px 0 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .elegant-res-section-title::before {
          content: "";
          display: block;
          width: 4px;
          height: 16px;
          background: #3b82f6;
          border-radius: 2px;
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ResourcePageProps> = async ({ params, res }) => {
  const slug = String(params?.slug || "");
  const resource = await getResourceBySlug(slug);

  if (!resource) return { notFound: true };

  const offline = resource.publish_status === "offline";
  if (offline) {
    res.statusCode = 410;
  } else if (resource.publish_status !== "published") {
    return { notFound: true };
  }

  const [publishedResources, structure] = await Promise.all([
    getPublishedResources(),
    getContentStructure(),
  ]);
  const examTopic = structure.topics
    .filter((topic) => resource.topic_ids?.includes(topic.id))
    .find((topic) => topic.slug === "gaokaozhenti" || topic.slug === "zhongkaozhenti");

  const related = examTopic
    ? rankExamRelated(resource, publishedResources, examTopic.slug as "gaokaozhenti" | "zhongkaozhenti")
    : rankDefaultRelated(resource, publishedResources);

  return {
    props: {
      resource,
      related,
      offline,
      downloadUrl: await getResolvedDownloadUrlForResource(resource),
      examTopic: examTopic ? { slug: examTopic.slug as "gaokaozhenti" | "zhongkaozhenti", name: examTopic.name } : null,
    }
  };
};
