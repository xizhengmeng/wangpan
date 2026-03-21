import { GetServerSideProps } from "next";
import Link from "next/link";

import { FeedbackButton } from "@/components/FeedbackButton";
import { ResourceCard } from "@/components/ResourceCard";
import { Seo } from "@/components/Seo";
import { TrackView } from "@/components/TrackView";
import { formatDate, slugify } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { getPublishedResources, getResourceBySlug } from "@/lib/store";
import { Resource } from "@/lib/types";

interface ResourcePageProps {
  resource: Resource | null;
  related: Resource[];
  offline: boolean;
}

export default function ResourcePage({ resource, related, offline }: ResourcePageProps) {
  if (!resource) {
    return null;
  }

  const description = resource.summary;
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {!offline ? <TrackView name="resource_detail_view" payload={{ resource_id: resource.id }} /> : null}

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">{offline ? "资源已下线" : "资源详情页"}</span>
            <h1 className="page-title">{resource.title}</h1>
            <p className="page-copy">
              {offline
                ? "该资源已被下线或需要重新校验。页面返回 410，利于搜索引擎清理失效内容。"
                : resource.summary}
            </p>
          </section>

          <div className="resource-layout">
            <article className="resource-main panel">
              <div className="resource-cover">
                <img src={resource.cover} alt={resource.title} />
              </div>
              <div className="meta-row">
                <span className="meta-pill">{resource.category}</span>
                <span className="meta-pill">发布时间 {formatDate(resource.published_at)}</span>
                <span className="meta-pill">更新于 {formatDate(resource.updated_at)}</span>
              </div>
              <h2 className="resource-title">资源说明</h2>
              <p>
                {resource.summary}
                这类详情页承担 SEO 收录和转化双重职责，因此正文、标签和相关资源都会保留在页面内，帮助抓取和提升二次点击。
              </p>

              <div className="tag-cloud">
                {resource.tags.map((tag) => (
                  <Link className="tag" href={`/tag/${slugify(tag)}`} key={tag}>
                    {tag}
                  </Link>
                ))}
              </div>

              {related.length > 0 ? (
                <section className="section">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">相关资源</h2>
                      <p className="section-subtitle">详情页继续把权重分发给同类内容。</p>
                    </div>
                  </div>
                  <div className="card-grid">
                    {related.map((item) => (
                      <ResourceCard key={item.id} resource={item} />
                    ))}
                  </div>
                </section>
              ) : null}
            </article>

            <aside className="sticky-card">
              <strong>{offline ? "资源状态" : "夸克下载"}</strong>
              <p className="muted">
                {offline ? "该资源当前不可用，请在后台修复链接或重新发布。" : "先记录点击，再跳转到夸克网盘。"}
              </p>
              {!offline ? (
                <Link className="button-link" href={`/go/${resource.id}`}>
                  进入夸克下载
                </Link>
              ) : null}
              {resource.extract_code ? (
                <div className="section">
                  <div className="code-block">提取码：{resource.extract_code}</div>
                </div>
              ) : null}
              <div className="info-list">
                <div className="info-item">
                  <span>分类</span>
                  <strong>{resource.category}</strong>
                </div>
                <div className="info-item">
                  <span>状态</span>
                  <strong>{offline ? "已下线" : "可下载"}</strong>
                </div>
              </div>
              {!offline && <FeedbackButton resourceId={resource.id} />}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ResourcePageProps> = async ({
  params,
  res
}) => {
  const slug = String(params?.slug || "");
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    return {
      notFound: true
    };
  }

  const offline = resource.publish_status === "offline";
  if (offline) {
    res.statusCode = 410;
  } else if (resource.publish_status !== "published") {
    return {
      notFound: true
    };
  }

  const related = (await getPublishedResources())
    .filter(
      (item) =>
        item.id !== resource.id &&
        (item.category === resource.category ||
          item.tags.some((tag) => resource.tags.includes(tag)))
    )
    .slice(0, 3);

  return {
    props: {
      resource,
      related,
      offline
    }
  };
};
