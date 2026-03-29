import { GetStaticPaths, GetStaticProps } from "next";
import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import {
  ExamCollectionDefinition,
  getExamCollectionBySlug,
  getExamCollectionResources,
  getExamCollectionsByExamSlug,
} from "@/lib/examCollections";
import { absoluteUrl } from "@/lib/site";
import type { Resource } from "@/lib/types";

interface ExamCollectionPageProps {
  collection: ExamCollectionDefinition;
  resources: Resource[];
  relatedCollections: Array<Pick<ExamCollectionDefinition, "slug" | "title" | "resource_count">>;
}

const FILTER_LABELS: Record<string, string> = {
  subject: "科目",
  year: "年份",
  region: "地区",
  paper_version: "卷别",
  all_subjects: "覆盖范围",
};

export default function ExamCollectionPage({
  collection,
  resources,
  relatedCollections,
}: ExamCollectionPageProps) {
  const examName = collection.exam_slug === "gaokaozhenti" ? "高考真题" : "中考真题";
  const description = `${collection.summary} 当前收录 ${collection.resource_count} 条真题资源。`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.title,
    description,
    url: absoluteUrl(`/collection/${collection.slug}`),
  };

  return (
    <>
      <Seo title={collection.title} description={description} path={`/collection/${collection.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="page-shell">
        <div className="container">
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            <Link href={`/topic/${collection.exam_slug}`}>{examName}</Link>
            <span className="breadcrumb__sep">›</span>
            <Link href={`/collections/${collection.exam_slug}`}>合集总览</Link>
            <span className="breadcrumb__sep">›</span>
            <span>{collection.title}</span>
          </nav>

          <section className="panel" style={{ padding: 28, marginBottom: 18 }}>
            <span className="eyebrow">真题合集页</span>
            <h1 className="page-title" style={{ marginTop: 12 }}>{collection.title}</h1>
            <p className="page-copy">{description}</p>

            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip">{examName}</span>
              <span className="chip">{collection.resource_count} 条真题</span>
              <span className="chip">{collection.subject_count} 个科目</span>
              {collection.lastmod ? <span className="chip">最近更新 {String(collection.lastmod).slice(0, 10)}</span> : null}
            </div>

            <div className="resource-info-list" style={{ marginTop: 20 }}>
              {Object.entries(collection.filters).map(([key, value]) => (
                <div className="resource-info-row" key={key}>
                  <dt className="resource-info-row__label">{FILTER_LABELS[key] || key}</dt>
                  <dd className="resource-info-row__value">{value === true ? "所有科目" : String(value)}</dd>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ padding: 24, marginBottom: 18 }}>
            <div className="section-head" style={{ marginBottom: 14 }}>
              <div>
                <h2 className="section-title">合集内真题</h2>
                <p className="section-subtitle">当前合集内的真题资源按更新时间倒序展示。</p>
              </div>
            </div>
            <ResourceListCompact items={resources} />
          </section>

          {relatedCollections.length > 0 ? (
            <section className="panel" style={{ padding: 24 }}>
              <div className="section-head" style={{ marginBottom: 14 }}>
                <div>
                  <h2 className="section-title">相关合集</h2>
                  <p className="section-subtitle">同考试类型下的相邻合集，可继续按地区、科目或卷别浏览。</p>
                </div>
              </div>
              <div className="result-list">
                {relatedCollections.map((item) => (
                  <Link className="result-row" href={`/collection/${item.slug}`} key={item.slug}>
                    <div>
                      <h3>{item.title}</h3>
                      <div className="result-row__meta">
                        <span className="result-row__category">真题合集</span>
                        <span>{item.resource_count} 条真题</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<ExamCollectionPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const collection = await getExamCollectionBySlug(slug);
  if (!collection) {
    return { notFound: true };
  }

  const resources = (await getExamCollectionResources(collection))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const relatedCollections = (await getExamCollectionsByExamSlug(collection.exam_slug))
    .filter((item) => item.slug !== collection.slug)
    .filter((item) => {
      if (collection.filters.subject && item.filters.subject === collection.filters.subject) return true;
      if (collection.filters.region && item.filters.region === collection.filters.region) return true;
      if (collection.filters.paper_version && item.filters.paper_version === collection.filters.paper_version) return true;
      if (collection.filters.year && item.filters.year === collection.filters.year) return true;
      return false;
    })
    .sort((a, b) => b.resource_count - a.resource_count)
    .slice(0, 8)
    .map((item) => ({
      slug: item.slug,
      title: item.title,
      resource_count: item.resource_count,
    }));

  return {
    props: {
      collection,
      resources,
      relatedCollections,
    },
    revalidate: 1800,
  };
};
