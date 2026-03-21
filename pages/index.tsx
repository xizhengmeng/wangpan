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

  const spotlight = hotResources[0] || latestResources[0];
  const editorPicks = latestResources.slice(1, 4);
  const freshResources = latestResources.slice(0, 6);
  const featuredCategories = categories.slice(0, 6);
  const featuredTags = tags.slice(0, 10);

  return (
    <>
      <Seo title="首页" description={siteConfig.description} path="/" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="home-v3">
        <section className="home-v3-hero">
          <div className="home-v3-hero__main">
            <span className="home-v3-hero__eyebrow">编辑型资料门户</span>
            <h1>不是资源站壳子，是一个有方向感的资料首页。</h1>
            <p>
              用更强的首屏、明确的内容分区和更有张力的视觉层次，把“搜索资料、进入详情、完成下载”
              这条路径做得更直觉。
            </p>

            <div className="home-v3-hero__search">
              <SearchBox />
            </div>

            <div className="home-v3-hero__keywords">
              {["考研", "PPT 模板", "Python", "英语四六级", "Excel", "简历模板"].map((keyword) => (
                <Link
                  className="home-v3-hero__keyword"
                  href={`/search?q=${encodeURIComponent(keyword)}`}
                  key={keyword}
                >
                  {keyword}
                </Link>
              ))}
            </div>
          </div>

          {spotlight ? (
            <Link className="home-v3-spotlight" href={`/resource/${spotlight.slug}`}>
              <div className="home-v3-spotlight__media">
                <img src={spotlight.cover} alt={spotlight.title} loading="lazy" />
              </div>
              <div className="home-v3-spotlight__content">
                <span className="home-v3-spotlight__badge">本周重点</span>
                <h2>{spotlight.title}</h2>
                <p>{spotlight.summary}</p>
                <div className="home-v3-spotlight__meta">
                  <span>{spotlight.category}</span>
                  <span>更新于 {timeAgo(spotlight.updated_at)}</span>
                </div>
              </div>
            </Link>
          ) : null}
        </section>

        <section className="home-v3-rail">
          <div className="home-v3-stats">
            <div className="home-v3-stat">
              <strong>{stats.resourceCount}</strong>
              <span>资源库</span>
            </div>
            <div className="home-v3-stat">
              <strong>{stats.categoryCount}</strong>
              <span>主题分类</span>
            </div>
            <div className="home-v3-stat">
              <strong>{stats.queryCount}</strong>
              <span>热搜词</span>
            </div>
            <div className="home-v3-stat">
              <strong>{stats.eventCount}</strong>
              <span>行为事件</span>
            </div>
          </div>

          <div className="home-v3-categories">
            {featuredCategories.map((category, index) => (
              <Link className="home-v3-category" href={`/category/${category.slug}`} key={category.slug}>
                <span className="home-v3-category__index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{category.name}</strong>
                <em>{category.count} 条资源</em>
              </Link>
            ))}
          </div>
        </section>

        <div className="home-v3-layout">
          <main className="home-v3-main">
            <section className="home-v3-panel">
              <div className="home-v3-panel__head">
                <div>
                  <span className="home-v3-panel__label">Editor Picks</span>
                  <h2>精选入口</h2>
                </div>
              </div>
              <div className="home-v3-picks">
                {editorPicks.map((resource) => (
                  <Link className="home-v3-pick" href={`/resource/${resource.slug}`} key={resource.id}>
                    <div className="home-v3-pick__meta">
                      <span>{resource.category}</span>
                      <span>{timeAgo(resource.updated_at)}</span>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.summary}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-v3-panel">
              <div className="home-v3-panel__head">
                <div>
                  <span className="home-v3-panel__label">Fresh Stack</span>
                  <h2>最新资源流</h2>
                </div>
                <Link href="/search?q=">查看更多</Link>
              </div>
              <div className="home-v3-list">
                {freshResources.map((resource) => (
                  <Link className="home-v3-item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <div className="home-v3-item__thumb">
                      <img src={resource.cover} alt={resource.title} loading="lazy" />
                    </div>
                    <div className="home-v3-item__body">
                      <div className="home-v3-item__tags">
                        <span className="home-v3-item__category">{resource.category}</span>
                        {resource.tags.slice(0, 2).map((tag) => (
                          <span className="home-v3-item__tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3>{resource.title}</h3>
                      <p>{resource.summary}</p>
                    </div>
                    <div className="home-v3-item__meta">
                      <span>{timeAgo(resource.updated_at)}</span>
                      <strong>详情</strong>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          <aside className="home-v3-side">
            <section className="home-v3-panel home-v3-manifesto">
              <span className="home-v3-manifesto__mark">夸</span>
              <h2>先整理，再下载。</h2>
              <p>
                首页用搜索和精选建立第一印象，分类负责分流，详情页负责转化。整个站不再像传统资源论坛。
              </p>
            </section>

            <section className="home-v3-panel">
              <div className="home-v3-panel__head">
                <div>
                  <span className="home-v3-panel__label">Hot Now</span>
                  <h2>热门资源榜</h2>
                </div>
              </div>
              <div className="home-v3-rank">
                {hotResources.slice(0, 5).map((resource, index) => (
                  <Link className="home-v3-rank__item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <span className="home-v3-rank__index">{rankLabel(index)}</span>
                    <span className="home-v3-rank__title">{resource.title}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-v3-panel">
              <div className="home-v3-panel__head">
                <div>
                  <span className="home-v3-panel__label">Long Tail</span>
                  <h2>热门标签</h2>
                </div>
              </div>
              <div className="home-v3-tags">
                {featuredTags.map((tag) => (
                  <Link className="home-v3-tag" href={`/tag/${tag.slug}`} key={tag.slug}>
                    <span>{tag.name}</span>
                    <em>{tag.count}</em>
                  </Link>
                ))}
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
