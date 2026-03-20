import Link from "next/link";
import { GetServerSideProps } from "next";

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

const QUICK_NAVS = [
  { label: "最新更新", href: "/" },
  { label: "考试资料", href: "/search?q=考试资料" },
  { label: "办公模板", href: "/search?q=模板" },
  { label: "AI 提示词", href: "/search?q=AI" }
];

function timeAgo(dateStr: string) {
  const now = Date.now();
  const time = new Date(dateStr).getTime();
  const diff = Math.max(0, Math.floor((now - time) / 1000));

  if (diff < 3600) {
    return `${Math.max(1, Math.floor(diff / 60))} 分钟前`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)} 小时前`;
  }
  return `${Math.floor(diff / 86400)} 天前`;
}

function rankLabel(index: number) {
  if (index === 0) {
    return "热";
  }
  if (index === 1) {
    return "升";
  }
  if (index === 2) {
    return "新";
  }
  return String(index + 1).padStart(2, "0");
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
    itemListElement: latestResources.slice(0, 8).map((resource, index) => ({
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

      <div className="home-shell">
        <div className="home-grid">
          <aside className="home-left">
            <section className="home-card home-nav-card">
              <div className="home-card__title">快速频道</div>
              <div className="home-nav-list">
                {QUICK_NAVS.map((item, index) => (
                  <Link
                    className={`home-nav-item${index === 0 ? " home-nav-item--active" : ""}`}
                    href={item.href}
                    key={item.label}
                  >
                    <span className="home-nav-item__dot" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-card home-nav-card">
              <div className="home-card__title">分类导航</div>
              <div className="home-nav-list">
                {categories.map((category) => (
                  <Link className="home-nav-item" href={`/category/${category.slug}`} key={category.slug}>
                    <span className="home-nav-item__dot home-nav-item__dot--muted" />
                    <span>{category.name}</span>
                    <span className="home-nav-item__count">{category.count}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-card home-note-card">
              <div className="home-card__title">内容策略</div>
              <p className="home-note-card__text">
                首页负责承接搜索和聚合流量，详情页负责转化。高风险类目做整理页，低风险资源做下载页。
              </p>
            </section>
          </aside>

          <main className="home-main">
            <section className="home-hero-card">
              <div className="home-hero-card__meta">资料检索首页</div>
              <div className="home-hero-card__grid">
                <div>
                  <h1>先搜关键词，再从整理页进入下载。</h1>
                  <p>
                    参考你给的资源站首页结构，这一版保留了三栏布局、顶部搜索和高密度资源流，
                    但把内容重心改成更适合 SEO 的资料站，而不是论坛帖子站。
                  </p>
                </div>
                <div className="home-hero-card__stats">
                  <div className="home-mini-stat">
                    <strong>{stats.resourceCount}</strong>
                    <span>已发布资源</span>
                  </div>
                  <div className="home-mini-stat">
                    <strong>{stats.categoryCount}</strong>
                    <span>核心分类</span>
                  </div>
                  <div className="home-mini-stat">
                    <strong>{stats.queryCount}</strong>
                    <span>搜索热词</span>
                  </div>
                </div>
              </div>

              <div className="home-hero-card__search">
                <SearchBox />
              </div>

              <div className="home-hot-row">
                <span className="home-hot-row__label">热门搜索</span>
                {["考研", "PPT 模板", "Excel", "英语四六级", "Python", "简历模板"].map((keyword) => (
                  <Link
                    className="home-hot-row__chip"
                    href={`/search?q=${encodeURIComponent(keyword)}`}
                    key={keyword}
                  >
                    {keyword}
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-notice-bar">
              <span className="home-notice-bar__badge">公告</span>
              <p>本站优先收录整理型资料和低风险可分发资源。搜索词和点击行为会直接进入后台统计。</p>
            </section>

            <section className="home-card home-feed-card">
              <div className="home-feed-card__toolbar">
                <div className="home-feed-card__tabs">
                  <button className="home-feed-card__tab home-feed-card__tab--active" type="button">
                    最新资源
                  </button>
                  <button className="home-feed-card__tab" type="button">
                    推荐合集
                  </button>
                  <button className="home-feed-card__tab" type="button">
                    补库方向
                  </button>
                </div>
                <div className="home-feed-card__hint">搜索驱动更新</div>
              </div>

              <div className="home-feed-list">
                {latestResources.map((resource) => (
                  <Link className="home-feed-item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <div className="home-feed-item__thumb">
                      <img src={resource.cover} alt={resource.title} loading="lazy" />
                    </div>

                    <div className="home-feed-item__body">
                      <div className="home-feed-item__tags">
                        <span className="home-feed-item__category">{resource.category}</span>
                        {resource.tags.slice(0, 2).map((tag) => (
                          <span className="home-feed-item__tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3>{resource.title}</h3>
                      <p>{resource.summary}</p>
                      <div className="home-feed-item__meta">
                        <span>最近更新 {timeAgo(resource.updated_at)}</span>
                        <span>标签 {resource.tags.length}</span>
                        <span>适合做详情转化页</span>
                      </div>
                    </div>

                    <div className="home-feed-item__side">
                      <strong>查看</strong>
                      <span>{resource.tags[0] || "资料"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-card home-tag-card">
              <div className="home-card__title">热门标签入口</div>
              <div className="home-tag-cloud">
                {tags.map((tag) => (
                  <Link className="home-tag-cloud__item" href={`/tag/${tag.slug}`} key={tag.slug}>
                    <span>{tag.name}</span>
                    <em>{tag.count}</em>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          <aside className="home-right">
            <section className="home-card home-brand-card">
              <div className="home-brand-card__cover" />
              <div className="home-brand-card__body">
                <div className="home-brand-card__logo">夸</div>
                <h2>夸克资料搜索站</h2>
                <p>
                  面向资料检索、模板下载和备考整理的内容站。不是纯搬运站，而是先整理、再转化。
                </p>
              </div>
            </section>

            <section className="home-card">
              <div className="home-card__title">站点统计</div>
              <div className="home-stats-grid">
                <div className="home-stats-grid__item">
                  <strong>{stats.resourceCount}</strong>
                  <span>资源总数</span>
                </div>
                <div className="home-stats-grid__item">
                  <strong>{stats.eventCount}</strong>
                  <span>事件记录</span>
                </div>
                <div className="home-stats-grid__item">
                  <strong>{stats.categoryCount}</strong>
                  <span>分类数</span>
                </div>
                <div className="home-stats-grid__item">
                  <strong>{stats.queryCount}</strong>
                  <span>搜索热词</span>
                </div>
              </div>
            </section>

            <section className="home-card">
              <div className="home-card__title">热门资源排行</div>
              <div className="home-rank-list">
                {hotResources.map((resource, index) => (
                  <Link className="home-rank-item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <span className="home-rank-item__index">{rankLabel(index)}</span>
                    <span className="home-rank-item__title">{resource.title}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-card">
              <div className="home-card__title">本周重点方向</div>
              <div className="home-check-list">
                <div className="home-check-list__item">优先补高频无结果词</div>
                <div className="home-check-list__item">模板类资源保持每周上新</div>
                <div className="home-check-list__item">高风险内容只做整理和导航</div>
              </div>
            </section>
          </aside>
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
      .slice(0, 6) || [];

  const categoryMap = getCategoryMap(publishedResources);
  const tagMap = getTagMap(publishedResources);

  return {
    props: {
      latestResources: publishedResources.slice(0, 12),
      hotResources: hotResources.length > 0 ? (hotResources as Resource[]) : publishedResources.slice(0, 6),
      categories: categoryMap.slice(0, 12),
      tags: tagMap.slice(0, 18),
      stats: {
        resourceCount: publishedResources.length,
        queryCount: analytics.topQueries.reduce((total, item) => total + item.count, 0),
        eventCount: analytics.totalEvents,
        categoryCount: categoryMap.length
      }
    }
  };
};
