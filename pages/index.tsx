import Link from "next/link";
import { GetServerSideProps } from "next";

import { SearchBox } from "@/components/SearchBox";
import { Seo } from "@/components/Seo";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { slugify } from "@/lib/format";
import {
  getAnalyticsSummary,
  getContentStructure,
  getFeaturedChannels,
  getPublishedResources,
  getTagMap
} from "@/lib/store";
import { Channel, Resource } from "@/lib/types";

interface HomeProps {
  latestResources: Resource[];
  hotResources: Resource[];
  tags: Array<{ name: string; slug: string; count: number }>;
  featuredChannels: Channel[];
  hotSearches: string[];
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
  hotSearches
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
  const rankedResources = hotResources.slice(0, freshResources.length);
  const featuredTags = tags.slice(0, 10);
  const featuredSearches = hotSearches.slice(0, 10);

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
        </section>

        <div className="home-v4-layout">
          <main className="home-v4-main">
            <section className="home-v4-section home-v4-panel">
              <div className="home-v4-section__head">
                <div>
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
            <section className="home-v4-panel">
              <div className="home-v4-section__head">
                <div>
                  <span className="home-v4-section__eyebrow">热门资料</span>
                  <h2>热门夸克网盘资料</h2>
                </div>
              </div>
              <div className="home-v4-rank">
                {rankedResources.map((resource, index) => (
                  <Link className="home-v4-rank__item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <span className="home-v4-rank__index">{rankLabel(index)}</span>
                    <span className="home-v4-rank__title">{resource.title}</span>
                  </Link>
                ))}
              </div>
            </section>

          </aside>
        </div>

        <section className="home-v4-discovery home-v4-discovery--standalone">
          <section className="home-v4-panel">
            <div className="home-v4-section__head">
              <div>
                <h2>大家都在搜什么</h2>
              </div>
            </div>
            <div className="home-v4-tags">
              {featuredSearches.map((keyword) => (
                <Link
                  className="home-v4-tag"
                  href={`/search?q=${encodeURIComponent(keyword)}`}
                  key={keyword}
                >
                  <span>{keyword}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="home-v4-panel">
            <div className="home-v4-section__head">
              <div>
                <h2>夸克资料热门标签</h2>
              </div>
            </div>
            <div className="home-v4-tags">
              {featuredTags.map((tag) => (
                <Link className="home-v4-tag" href={`/tag/${tag.slug}`} key={tag.slug}>
                  <span>{tag.name}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="home-v4-panel">
            <div className="home-v4-section__head">
              <div>
                <h2>优先浏览这些频道</h2>
              </div>
            </div>
            <div className="home-v4-search__browse home-v4-discovery__browse">
              {featuredChannels.slice(0, 6).map((channel) => (
                <Link
                  className="home-v4-search__browse-item home-v4-discovery__channel"
                  href={`/channel/${channel.slug}`}
                  key={channel.id}
                >
                  <strong>{channel.name}</strong>
                </Link>
              ))}
            </div>
          </section>
        </section>

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

  // 如果后台配置了 featured_channels，按指定 slug 顺序筛选频道；否则取 featured=1 的频道
  const allChannels = structure.channels.filter((c) => c.status === "active");
  const resolvedFeaturedChannels: Channel[] = (() => {
    const slugList = structure.site_profile.featured_channels;
    if (slugList && slugList.length > 0) {
      return slugList
        .map((slug) => allChannels.find((c) => c.slug === slug))
        .filter(Boolean) as Channel[];
    }
    return featuredChannels;
  })();

  // 如果后台配置了 hot_tags，直接使用；否则取自动计算的 top tags
  const resolvedTags: Array<{ name: string; slug: string; count: number }> = (() => {
    const tagNames = structure.site_profile.hot_tags;
    if (tagNames && tagNames.length > 0) {
      return tagNames.map((name) => {
        const slug = slugify(name);
        const existing = tagMap.find((t) => t.slug === slug || t.name === name);
        return existing ?? { name, slug, count: 0 };
      });
    }
    return tagMap;
  })();

  const hotSearches =
    structure.site_profile.hot_searches && structure.site_profile.hot_searches.length > 0
      ? structure.site_profile.hot_searches.slice(0, 8)
      : analytics.topQueries.map((item) => item.query).slice(0, 8);

  return {
    props: {
      latestResources: publishedResources.slice(0, 16),
      hotResources: hotResources.length > 0 ? (hotResources as Resource[]) : publishedResources.slice(0, 12),
      tags: resolvedTags.slice(0, 18),
      featuredChannels: resolvedFeaturedChannels.slice(0, 6),
      hotSearches
    }
  };
};
