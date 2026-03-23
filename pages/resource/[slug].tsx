import { GetServerSideProps } from "next";
import Link from "next/link";

import { FeedbackButton } from "@/components/FeedbackButton";
import { Seo } from "@/components/Seo";
import { TrackView } from "@/components/TrackView";
import { getExamTopicConfig } from "@/lib/examTopics";
import { formatDate, slugify } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { getGaokaoMetaString } from "@/lib/gaokao";
import { getContentStructure, getPublishedResources, getResolvedDownloadUrlForResource, getResourceBySlug } from "@/lib/store";
import { Resource } from "@/lib/types";
import { getZhongkaoCity, getZhongkaoMetaString } from "@/lib/zhongkao";

interface ResourcePageProps {
  resource: Resource | null;
  related: Resource[];
  offline: boolean;
  downloadUrl: string | null;
}

/** 将 resource.meta 渲染成可读的 label，无法映射的 key 做 title-case */
const META_LABELS: Record<string, string> = {
  year: "年份", subject: "科目", grade: "年级", region: "地区",
  province: "省份", volume: "卷册", edition: "版本", publisher: "出版社",
  difficulty: "难度", type: "类型", semester: "学期", course: "课程",
  city: "城市", paper_variant: "卷型", paper_version: "卷别", content_kinds: "内容类型",
};
function metaLabel(key: string) {
  return META_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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

export default function ResourcePage({ resource, related, offline, downloadUrl }: ResourcePageProps) {
  if (!resource) return null;

  const description = resource.summary;
  const metaEntries = resource.meta ? Object.entries(resource.meta).filter(([, v]) => v) : [];
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

  return (
    <>
      <Seo
        title={offline ? `${resource.title} 已下线` : resource.title}
        description={description}
        path={`/resource/${resource.slug}`}
        image={resource.cover}
        noindex={offline}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {!offline && <TrackView name="resource_detail_view" payload={{ resource_id: resource.id }} />}

      <div className="page-shell">
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

          {/* Hero — title + meta pills only, no duplicate summary */}
          <section className="page-hero panel">
            <span className="eyebrow">{offline ? "资源已下线" : "夸克网盘资料"}</span>
            <h1 className="page-title">{resource.title}</h1>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <span className="meta-pill">{resource.category}</span>
              {metaEntries.slice(0, 4).map(([k, v]) => (
                <span className="meta-pill" key={k}>{metaLabel(k)}：{v}</span>
              ))}
              <span className="meta-pill">更新 {formatDate(resource.updated_at)}</span>
            </div>
          </section>

          {/* Two-column main layout */}
          <div className="resource-layout">

            {/* ── 左侧主内容 ── */}
            <article className="resource-main panel">

              {/* 资源摘要 */}
              <h2 className="resource-section-title">资源简介</h2>
              <p className="resource-desc">
                {offline
                  ? "该资源已被下线或需要重新校验。页面返回 410，利于搜索引擎清理失效内容。"
                  : resource.summary}
              </p>

              {/* 结构化元数据 表格 */}
              {metaEntries.length > 0 && (
                <>
                  <h2 className="resource-section-title">详细信息</h2>
                  <div className="resource-info-grid">
                    {metaEntries.map(([k, v]) => (
                      <div className="resource-info-item" key={k}>
                        <span className="resource-info-item__label">{metaLabel(k)}</span>
                        <span className="resource-info-item__value">{v}</span>
                      </div>
                    ))}
                    <div className="resource-info-item">
                      <span className="resource-info-item__label">分类</span>
                      <span className="resource-info-item__value">
                        <Link href={`/search?q=${encodeURIComponent(resource.category)}`}>{resource.category}</Link>
                      </span>
                    </div>
                    <div className="resource-info-item">
                      <span className="resource-info-item__label">发布时间</span>
                      <span className="resource-info-item__value">{formatDate(resource.published_at)}</span>
                    </div>
                    <div className="resource-info-item">
                      <span className="resource-info-item__label">最近更新</span>
                      <span className="resource-info-item__value">{formatDate(resource.updated_at)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* 标签云 */}
              {resource.tags.length > 0 && (
                <div className="resource-tags-wrap">
                  <h2 className="resource-section-title">相关标签</h2>
                  <div className="tag-cloud">
                    {resource.tags.map((tag) => (
                      <Link className="tag" href={`/tag/${slugify(tag)}`} key={tag}>{tag}</Link>
                    ))}
                  </div>
                </div>
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
                    ? "点击下方按钮跳转到夸克网盘即可下载。"
                    : "暂无下载链接，如有需要请通过反馈联系站长。"}
              </p>

              {!offline && downloadUrl && (
                <Link className="button-link resource-dl-btn" href={`/go/${resource.id}`}>
                  进入夸克下载
                </Link>
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
                  <strong>{offline ? "已下线" : downloadUrl ? "✅ 可下载" : "⏳ 待补链接"}</strong>
                </div>
                {metaEntries.slice(0, 6).map(([k, v]) => (
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
                  <p className="section-subtitle">同分类或同标签的其他资料</p>
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
    }
  };
};
