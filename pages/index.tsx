import Link from "next/link";
import { GetServerSideProps } from "next";

import { SearchBox } from "@/components/SearchBox";
import { Seo } from "@/components/Seo";
import { absoluteUrl, siteConfig } from "@/lib/site";
import {
  getAnalyticsSummary,
  getContentStructure,
  getFeaturedChannels,
  getPublishedResources,
  getTagMap
} from "@/lib/store";
import { Channel, ContentStructure, Resource } from "@/lib/types";

interface HomeProps {
  latestResources: Resource[];
  hotResources: Resource[];
  tags: Array<{ name: string; slug: string; count: number }>;
  featuredChannels: Channel[];
  hotSearches: string[];
  structure: ContentStructure;
  stats: {
    resourceCount: number;
    queryCount: number;
    eventCount: number;
    categoryCount: number;
  };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  tags,
  featuredChannels,
  hotSearches,
  structure,
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

  const freshResources = latestResources.slice(0, 12);
  const featuredTags = tags.slice(0, 10);

  return (
    <>
      <Seo title="夸克网盘资料搜索站" description={siteConfig.description} path="/" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="home-v4">
        <section className="home-v4-search">
          <div className="home-v4-search__top">
            <span className="home-v4-search__eyebrow">免费夸克网盘资料</span>
            <h1>夸克网盘资料搜索站</h1>
            <p>
              收录海量夸克网盘资料，涵盖考试试卷、课程视频、办公模板与编程素材。
              输入关键词即可搜索全站夸克网盘资料，支持分类浏览与专题整理，快速直达夸克网盘下载链接。
            </p>
          </div>

          <div className="home-v4-search__form">
            <SearchBox />
          </div>

          <div className="home-v4-search__bottom">
            <div className="home-v4-search__group">
              <span className="home-v4-search__label">热门搜索</span>
              <div className="home-v4-search__keywords">
                {hotSearches.map((keyword) => (
                  <Link
                    className="home-v4-search__keyword"
                    href={`/search?q=${encodeURIComponent(keyword)}`}
                    key={keyword}
                  >
                    {keyword}
                  </Link>
                ))}
              </div>
            </div>

            <div className="home-v4-search__group">
              <span className="home-v4-search__label">热门频道</span>
              <div className="home-v4-search__browse">
                {featuredChannels.slice(0, 4).map((channel) => (
                  <Link
                    className="home-v4-search__browse-item"
                    href={`/channel/${channel.slug}`}
                    key={channel.id}
                  >
                    <strong>{channel.name}</strong>
                    <span>进入热门频道</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="home-v4-layout">
          <main className="home-v4-main">
            <section className="home-v4-section home-v4-panel">
              <div className="home-v4-section__head">
                <div>
                  <span className="home-v4-section__eyebrow">资料更新</span>
                  <h2>最新夸克网盘资料</h2>
                </div>
                <Link href="/search?q=">查看更多</Link>
              </div>
              <div className="home-v4-resource-list">
                {freshResources.map((resource) => (
                  <Link className="home-v4-resource-item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <div className="home-v4-resource-item__meta">
                      <span className="home-v4-resource-item__category">{resource.category}</span>
                      <span>{formatDate(resource.updated_at)}</span>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          <aside className="home-v4-side">
            <section className="home-v4-panel home-v4-card">
              <div className="home-v4-card__head">
                <span className="home-v4-card__mark">夸</span>
                <div>
                  <h2>关于夸克网盘资料站</h2>
                  <p>{structure.site_profile.positioning || "专注整理与分享夸克网盘资料"}</p>
                </div>
              </div>
              <div className="home-v4-overview">
                <div className="home-v4-overview__item">
                  <strong>{stats.resourceCount}</strong>
                  <span>夸克网盘资料</span>
                </div>
                <div className="home-v4-overview__item">
                  <strong>{featuredChannels.length}</strong>
                  <span>热门频道</span>
                </div>
                <div className="home-v4-overview__item">
                  <strong>{stats.categoryCount}</strong>
                  <span>资料分类</span>
                </div>
                <div className="home-v4-overview__item">
                  <strong>{hotSearches.length}</strong>
                  <span>热门搜索词</span>
                </div>
              </div>
              <p className="home-v4-card__desc">
                本站专注整理夸克网盘资料，所有夸克网盘资料均可直达下载，
                无需注册即可免费获取夸克网盘资料。
              </p>
            </section>

            <section className="home-v4-panel">
              <div className="home-v4-section__head">
                <div>
                  <span className="home-v4-section__eyebrow">热门资料</span>
                  <h2>热门夸克网盘资料</h2>
                </div>
              </div>
              <div className="home-v4-rank">
                {hotResources.slice(0, 5).map((resource, index) => (
                  <Link className="home-v4-rank__item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <span className="home-v4-rank__index">{rankLabel(index)}</span>
                    <span className="home-v4-rank__title">{resource.title}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="home-v4-panel">
              <div className="home-v4-section__head">
                <div>
                  <span className="home-v4-section__eyebrow">资料分类</span>
                  <h2>夸克资料热门标签</h2>
                </div>
              </div>
              <div className="home-v4-tags">
                {featuredTags.map((tag) => (
                  <Link className="home-v4-tag" href={`/tag/${tag.slug}`} key={tag.slug}>
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
  const [publishedResources, analytics, structure, featuredChannels] = await Promise.all([
    getPublishedResources(),
    getAnalyticsSummary(),
    getContentStructure(),
    getFeaturedChannels(),
  ]);
  const hotResourceMap = new Map(publishedResources.map((resource) => [resource.id, resource]));
  const hotResources =
    analytics.topResources
      .map((item) => hotResourceMap.get(item.resourceId))
      .filter(Boolean)
      .slice(0, 6) || [];

  const tagMap = await getTagMap(publishedResources);
  const hotSearches =
    structure.site_profile.hot_searches && structure.site_profile.hot_searches.length > 0
      ? structure.site_profile.hot_searches.slice(0, 8)
      : analytics.topQueries.map((item) => item.query).slice(0, 8);

  return {
    props: {
      latestResources: publishedResources.slice(0, 16),
      hotResources: hotResources.length > 0 ? (hotResources as Resource[]) : publishedResources.slice(0, 6),
      tags: tagMap.slice(0, 18),
      featuredChannels: featuredChannels.slice(0, 6),
      hotSearches,
      structure,
      stats: {
        resourceCount: publishedResources.length,
        queryCount: analytics.topQueries.reduce((total, item) => total + item.count, 0),
        eventCount: analytics.totalEvents,
        categoryCount: structure.categories.filter((item) => item.status === "active").length
      }
    }
  };
};
