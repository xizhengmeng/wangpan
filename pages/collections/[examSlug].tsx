import { GetServerSideProps } from "next";
import Link from "next/link";

import { Seo } from "@/components/Seo";
import {
  getExamCollectionsByExamSlug,
  getFeaturedExamCollections,
} from "@/lib/examCollections";
import { absoluteUrl } from "@/lib/site";

interface CollectionsHubPageProps {
  examSlug: "gaokaozhenti" | "zhongkaozhenti";
  examName: string;
  total: number;
  groups: Array<{
    type: string;
    label: string;
    items: Array<{
      slug: string;
      title: string;
      summary: string;
      resource_count: number;
    }>;
  }>;
}

const TYPE_LABELS: Record<string, string> = {
  "subject-history": "科目历年合集",
  "paper-version": "卷别合集",
  "subject-paper-version": "科目 + 卷别合集",
  "year-region": "年份 + 地区合集",
  "region-subject": "地区 + 科目合集",
};

export default function CollectionsHubPage({
  examSlug,
  examName,
  total,
  groups,
}: CollectionsHubPageProps) {
  const title = `${examName}合集总览`;
  const description = `汇总 ${examName} 的高价值合集页，包括科目历年、年份地区、卷别与地区科目等组合，当前共 ${total} 个合集入口。`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: absoluteUrl(`/collections/${examSlug}`),
  };

  return (
    <>
      <Seo title={title} description={description} path={`/collections/${examSlug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="page-shell">
        <div className="container">
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            <Link href={`/topic/${examSlug}`}>{examName}</Link>
            <span className="breadcrumb__sep">›</span>
            <span>合集总览</span>
          </nav>

          <section className="panel" style={{ padding: 28 }}>
            <div className="section-head" style={{ marginBottom: 18 }}>
              <div>
                <h1 className="section-title" style={{ fontSize: 30, marginBottom: 8 }}>{title}</h1>
                <p className="section-subtitle">
                  {description}
                </p>
              </div>
              <Link className="button button-secondary" href={`/topic/${examSlug}`}>
                返回{examName}
              </Link>
            </div>

            <div className="chip-row" style={{ marginBottom: 8 }}>
              <span className="chip">已生成 {total} 个合集页</span>
              {groups.map((group) => (
                <span className="chip" key={group.type}>{group.label} {group.items.length}</span>
              ))}
            </div>
          </section>

          <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
            {groups.map((group) => (
              <section className="panel" key={group.type} style={{ padding: 24 }}>
                <div className="section-head" style={{ marginBottom: 14 }}>
                  <div>
                    <h2 className="section-title">{group.label}</h2>
                    <p className="section-subtitle">优先展示资源量更高、搜索意图更明确的合集。</p>
                  </div>
                </div>
                <div className="result-list">
                  {group.items.map((item) => (
                    <Link className="result-row" href={`/collection/${item.slug}`} key={item.slug}>
                      <div>
                        <h3>{item.title}</h3>
                        <p className="result-row__summary">{item.summary}</p>
                        <div className="result-row__meta">
                          <span className="result-row__category">{group.label}</span>
                          <span>{item.resource_count} 条真题</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<CollectionsHubPageProps> = async ({ params }) => {
  const examSlug = String(params?.examSlug || "") as "gaokaozhenti" | "zhongkaozhenti";
  if (examSlug !== "gaokaozhenti" && examSlug !== "zhongkaozhenti") {
    return { notFound: true };
  }

  const examName = examSlug === "gaokaozhenti" ? "高考真题" : "中考真题";
  const groups = getFeaturedExamCollections(examSlug, 18).map((group) => ({
    type: group.type,
    label: TYPE_LABELS[group.type] || group.type,
    items: group.items.map((item) => ({
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      resource_count: item.resource_count,
    })),
  }));
  const total = getExamCollectionsByExamSlug(examSlug).length;

  return {
    props: {
      examSlug,
      examName,
      total,
      groups,
    },
  };
};
