import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { CategoryPagination } from "./CategoryPagination";
import type { CategoryLayoutProps } from "./types";

export default function DefaultCategoryLayout({
  categoryName,
  channelSlug,
  channelName,
  slug,
  items,
  page,
  total,
  totalPages,
  topics,
}: CategoryLayoutProps) {
  const description = `${categoryName} 相关夸克资料合集，持续更新资源。`;
  const path = page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`;

  return (
    <>
      <Seo
        title={`${categoryName} 资源合集`}
        description={description}
        path={path}
      />

      <div className="page-shell">
        <div className="container">
          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            <Link href={`/channel/${channelSlug}`}>{channelName}</Link>
            <span className="breadcrumb__sep">›</span>
            <span>{categoryName}</span>
          </nav>

          <section className="page-hero panel">
            <span className="eyebrow">标目分类</span>
            <h1 className="page-title">{categoryName}</h1>
            <p className="page-copy">{description}</p>
            {topics.length > 0 && (
              <div className="chip-row ch-topic-links">
                {topics.map((topic) => (
                  <Link className="chip" href={`/topic/${topic.slug}`} key={topic.id}>
                    {topic.name}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {topics.length > 0 && (
            <section className="section panel ch-topic-section">
              <div className="section-head">
                <div>
                  <h2 className="section-title">专题浏览</h2>
                  <p className="section-subtitle">按专题继续缩小范围</p>
                </div>
              </div>
              <div className="ch-topic-grid ch-topic-grid--simple">
                {topics.map((topic) => (
                  <Link className="ch-topic-card" href={`/topic/${topic.slug}`} key={topic.id}>
                    <div className="ch-topic-card__top">
                      <h3 className="ch-topic-card__title">{topic.name}</h3>
                      <span className="ch-topic-card__count">{topic.resources.length}</span>
                    </div>
                    {topic.summary ? <p className="ch-topic-card__summary">{topic.summary}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">全部资源</h2>
                <p className="section-subtitle">
                  共 {total} 条，当前第 {page} / {totalPages} 页
                </p>
              </div>
            </div>
            <ResourceListCompact items={items} />
            <CategoryPagination page={page} slug={slug} total={total} totalPages={totalPages} />
          </section>
        </div>
      </div>
    </>
  );
}
