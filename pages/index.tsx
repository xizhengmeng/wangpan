import Link from "next/link";
import { GetServerSideProps } from "next";

import { ResourceCard } from "@/components/ResourceCard";
import { SearchBox } from "@/components/SearchBox";
import { Seo } from "@/components/Seo";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { getAnalyticsSummary, getCategoryMap, getPublishedResources, getTagMap } from "@/lib/store";
import { Resource } from "@/lib/types";

interface HomeProps {
  latestResources: Resource[];
  hotResources: Resource[];
  categories: Array<{ name: string; slug: string; count: number }>;
  tags: Array<{ name: string; slug: string; count: number }>;
  stats: {
    resourceCount: number;
    queryCount: number;
    eventCount: number;
    categoryCount: number;
  };
}

export default function Home({
  latestResources,
  hotResources,
  categories,
  tags,
  stats
}: HomeProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: siteConfig.name,
    itemListElement: latestResources.slice(0, 5).map((resource, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/resource/${resource.slug}`),
      name: resource.title
    }))
  };

  return (
    <>
      <Seo title="首页" description={siteConfig.description} path="/" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container">
        <section className="hero">
          <div className="hero-panel hero-copy">
            <span className="eyebrow">SEO 资料站 / 夸克二跳 / 搜索驱动更新</span>
            <h1>把用户搜索词，直接变成你的资源增长引擎。</h1>
            <p>
              首页承担搜索入口，分类和标签页承担收录，详情页负责转化，后台把“搜了什么、点了什么”转成下一轮补库清单。
            </p>
            <SearchBox />
            <div className="chip-row" style={{ marginTop: 18 }}>
              {["考研", "PPT 模板", "Python", "英语四六级", "Excel"].map((keyword) => (
                <Link className="chip" href={`/search?q=${encodeURIComponent(keyword)}`} key={keyword}>
                  {keyword}
                </Link>
              ))}
            </div>
          </div>

          <div className="hero-side">
            <div className="hero-panel hero-metrics">
              <h2>站点核心指标</h2>
              <div className="hero-metrics__grid">
                <div className="stat-card">
                  <strong>{stats.resourceCount}</strong>
                  <span>已发布资源</span>
                </div>
                <div className="stat-card">
                  <strong>{stats.categoryCount}</strong>
                  <span>聚合分类</span>
                </div>
                <div className="stat-card">
                  <strong>{stats.queryCount}</strong>
                  <span>高频搜索词</span>
                </div>
                <div className="stat-card">
                  <strong>{stats.eventCount}</strong>
                  <span>累计行为事件</span>
                </div>
              </div>
            </div>

            <div className="hero-panel hero-metrics">
              <h2>推荐内容结构</h2>
              <div className="info-list">
                <div className="info-item">
                  <span>首页</span>
                  <strong>搜索主入口</strong>
                </div>
                <div className="info-item">
                  <span>分类 / 标签页</span>
                  <strong>长尾流量收录</strong>
                </div>
                <div className="info-item">
                  <span>详情页</span>
                  <strong>下载转化</strong>
                </div>
                <div className="info-item">
                  <span>后台</span>
                  <strong>按搜索词补资源</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="main-grid">
          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">热门分类</h2>
                <p className="section-subtitle">聚合页是 SEO 收录的主骨架，首页负责把权重传过去。</p>
              </div>
            </div>
            <div className="chip-row">
              {categories.map((category) => (
                <Link className="chip" href={`/category/${category.slug}`} key={category.slug}>
                  {category.name} · {category.count}
                </Link>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">最新资源</h2>
                <p className="section-subtitle">用于承接站内点击和外部抓取。</p>
              </div>
            </div>
            <div className="card-grid">
              {latestResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">热门资源</h2>
                <p className="section-subtitle">后续会由点击和下载数据驱动。</p>
              </div>
            </div>
            <div className="card-grid">
              {hotResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">热门标签</h2>
                <p className="section-subtitle">这部分负责扩展长尾词入口。</p>
              </div>
            </div>
            <div className="chip-row">
              {tags.map((tag) => (
                <Link className="chip" href={`/tag/${tag.slug}`} key={tag.slug}>
                  {tag.name} · {tag.count}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  const publishedResources = getPublishedResources();
  const analytics = getAnalyticsSummary();
  const hotResourceMap = new Map(publishedResources.map((resource) => [resource.id, resource]));
  const hotResources =
    analytics.topResources
      .map((item) => hotResourceMap.get(item.resourceId))
      .filter(Boolean)
      .slice(0, 3) || [];

  return {
    props: {
      latestResources: publishedResources.slice(0, 6),
      hotResources: hotResources.length > 0 ? (hotResources as Resource[]) : publishedResources.slice(0, 3),
      categories: getCategoryMap(publishedResources).slice(0, 8),
      tags: getTagMap(publishedResources).slice(0, 14),
      stats: {
        resourceCount: publishedResources.length,
        queryCount: analytics.topQueries.reduce((total, item) => total + item.count, 0),
        eventCount: analytics.totalEvents,
        categoryCount: getCategoryMap(publishedResources).length
      }
    }
  };
};
