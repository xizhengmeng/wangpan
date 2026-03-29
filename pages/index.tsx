import Link from "next/link";
import { GetServerSideProps } from "next";
import { useState } from "react";

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

interface HomeCategoryShowcaseItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  channelName: string;
  channelSlug: string;
  topics: Array<{
    id: string;
    name: string;
    slug: string;
    summary: string;
    featured?: boolean;
    show_on_home?: boolean;
    resources: Array<{
      id: string;
      title: string;
      slug: string;
      updated_at: string;
    }>;
  }>;
}

interface HomeProps {
  latestResources: Resource[];
  hotResources: Resource[];
  tags: Array<{ name: string; slug: string; count: number }>;
  featuredChannels: Channel[];
  hotSearches: string[];
  homeCategories: HomeCategoryShowcaseItem[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const homeGuideSteps = [
  {
    title: "搜索你要的夸克网盘资源",
    description:
      "在首页搜索框输入资源关键词，例如课程名称、资料名称、考试科目、软件版本或模板类型，优先查看标题和分类最匹配的结果。"
  },
  {
    title: "进入资源详情页查看说明",
    description:
      "详情页会展示资源简介、分类、标签和更新时间，方便判断是不是你要找的夸克资料，避免无效点击和重复检索。"
  },
  {
    title: "直达夸克网盘链接",
    description:
      "确认资源后可直接进入夸克网盘相关链接页面，快速完成查看、保存或后续转存操作，适合整理个人资源库。"
  }
];

const homeResourceScopes = [
  {
    title: "学习资料与课程素材",
    description:
      "适合查找考试试卷、课程讲义、同步资料、真题整理、笔记素材和各类专题学习资源。"
  },
  {
    title: "办公模板与效率工具",
    description:
      "适合搜索 PPT 模板、Excel 模板、简历模板、表格素材、工作汇报模板和常用效率资源。"
  },
  {
    title: "软件工具与电子书",
    description:
      "适合浏览软件工具合集、实用应用资源、电子书整理页和按主题聚合的资源包。"
  }
];

const homeFaqs = [
  {
    question: "这个网站主要收录哪些夸克网盘资源？",
    answer:
      "本站主要收录夸克网盘公开可访问的学习资料、课程素材、办公模板、软件工具、电子书和部分热门专题资源，方便按关键词快速搜索和浏览。"
  },
  {
    question: "如何更快找到想要的资源？",
    answer:
      "建议优先使用资源名、课程名、考试名、软件版本号或模板类型进行搜索，也可以先从热门标签、频道和搜索建议进入，再缩小范围。"
  },
  {
    question: "首页的最新资料和热门资料有什么区别？",
    answer:
      "最新资料更强调更新时间，适合追踪新入库的夸克网盘资源；热门资料则根据站内访问热度整理，适合快速查看最近更受关注的内容。"
  }
];

function HomeCategoryGroup({ item }: { item: HomeCategoryShowcaseItem }) {
  const [activeTopicId, setActiveTopicId] = useState(item.topics[0]?.id || "");
  const activeTopic = item.topics.find((topic) => topic.id === activeTopicId) || item.topics[0];

  if (!activeTopic) {
    return null;
  }

  return (
    <section className="home-v4-panel home-v4-category-section">
      <div className="home-v4-section__head home-v4-category-section__head">
        <h2>{item.name}</h2>
        <Link className="home-v4-categories__group-link" href={`/category/${item.slug}`}>查看栏目</Link>
      </div>

      <div className="home-v4-category-section__body">
        <div className="home-v4-categories__topic-tabs" role="tablist" aria-label={`${item.name} 专题切换`}>
          {item.topics.map((topic) => (
            <button
              type="button"
              role="tab"
              aria-selected={topic.id === activeTopic.id}
              className={`home-v4-categories__topic-tab${topic.id === activeTopic.id ? " home-v4-categories__topic-tab--active" : ""}`}
              key={topic.id}
              onClick={() => setActiveTopicId(topic.id)}
            >
              {topic.name}
            </button>
          ))}
        </div>

        <div className="home-v4-category-section__main">
          <div className="home-v4-categories__resource-head">
            <strong>{activeTopic.name}</strong>
            <Link href={`/topic/${activeTopic.slug}`}>进入专题</Link>
          </div>

          <div className="home-v4-categories__resource-list">
            {activeTopic.resources.slice(0, 15).map((resource) => (
              <Link className="home-v4-categories__resource-item" href={`/resource/${resource.slug}`} key={resource.id}>
                <div className="home-v4-categories__resource-main">
                  <span className="home-v4-categories__resource-badge">新</span>
                  <strong>{resource.title}</strong>
                </div>
                <time className="home-v4-categories__resource-time" dateTime={resource.updated_at}>
                  {formatDate(resource.updated_at)}
                </time>
              </Link>
            ))}

            {activeTopic.resources.length === 0 ? (
              <div className="home-v4-categories__empty">
                <strong>这个专题暂时还没有可展示的资源。</strong>
                <p>可以先进入专题页，后续有新内容会优先更新到这里。</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeCategoryShowcase({ items }: { items: HomeCategoryShowcaseItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="home-v4-categories">
      {items.map((item) => (
        <HomeCategoryGroup item={item} key={item.id} />
      ))}
    </div>
  );
}

export default function Home({
  latestResources,
  hotResources,
  tags,
  featuredChannels,
  hotSearches,
  homeCategories
}: HomeProps) {
  const seoTitle = "夸克网盘资源搜索站";
  const seoDescription =
    "夸克网盘资料搜索站，免费搜索夸克网盘资源，涵盖学习资料、课程素材、办公模板、软件工具与电子书合集，支持按分类、标签和频道快速查找。";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      url: absoluteUrl("/"),
      description: seoDescription,
      potentialAction: {
        "@type": "SearchAction",
        target: absoluteUrl("/search?q={search_term_string}"),
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seoTitle,
      url: absoluteUrl("/"),
      description: seoDescription
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${siteConfig.name}最新资源`,
      itemListElement: latestResources.slice(0, 8).map((resource, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/resource/${resource.slug}`),
        name: resource.title
      }))
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: homeFaqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }
  ];

  const freshResources = latestResources.slice(0, 12);
  const rankedResources = hotResources.slice(0, freshResources.length);
  const featuredTags = tags.slice(0, 10);
  const featuredSearches = hotSearches.slice(0, 10);

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} path="/" />
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
                  <h2>热门合集夸克网盘资料</h2>
                </div>
                <Link href="/search?q=">查看更多</Link>
              </div>
              <div className="home-v4-resource-list">
                {rankedResources.map((resource) => (
                  <Link className="home-v4-resource-item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <div className="home-v4-resource-item__main">
                      <span className="home-v4-resource-item__category">{resource.category}</span>
                      <h3>{resource.title}</h3>
                    </div>
                    <time className="home-v4-resource-item__time" dateTime={resource.updated_at}>
                      {formatDate(resource.updated_at)}
                    </time>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          <aside className="home-v4-side">
            <section className="home-v4-panel">
              <div className="home-v4-section__head">
                <div>
                  <h2>最新夸克网盘资料</h2>
                </div>
              </div>
              <div className="home-v4-resource-list">
                {freshResources.map((resource) => (
                  <Link className="home-v4-resource-item" href={`/resource/${resource.slug}`} key={resource.id}>
                    <div className="home-v4-resource-item__main">
                      <span className="home-v4-resource-item__category">{resource.category}</span>
                      <h3>{resource.title}</h3>
                    </div>
                    <time className="home-v4-resource-item__time" dateTime={resource.updated_at}>
                      {formatDate(resource.updated_at)}
                    </time>
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

        {homeCategories.length > 0 ? <HomeCategoryShowcase items={homeCategories} /> : null}

        <section className="home-v4-seo">
          <section className="home-v4-panel home-v4-seo__block">
            <div className="home-v4-section__head">
              <div>
                <h2>关于本站：夸克网盘资源搜索与整理入口</h2>
              </div>
            </div>
            <div className="home-v4-seo__content">
              <p>
                夸克网盘资料搜索站是一个面向夸克网盘资源检索与浏览的网站，重点整理学习资料、课程素材、办公模板、
                软件工具、电子书与各类专题合集，帮助你更快定位需要的夸克网盘资源。
              </p>
              <p>
                首页聚合了最新夸克网盘资料、热门夸克网盘资料、常用搜索词、热门标签与频道入口。相比只靠站内搜索，
                这种结构更适合快速浏览资源趋势，也更方便按主题继续深入查找。
              </p>
              <div className="home-v4-seo__chips">
                {featuredChannels.slice(0, 6).map((channel) => (
                  <Link className="home-v4-tag" href={`/channel/${channel.slug}`} key={channel.id}>
                    <span>{channel.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="home-v4-panel home-v4-seo__block">
            <div className="home-v4-section__head">
              <div>
                <h2>本站适合查找哪些夸克网盘资源</h2>
              </div>
            </div>
            <div className="home-v4-seo__list">
              {homeResourceScopes.map((item) => (
                <article className="home-v4-seo__list-item" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="home-v4-panel home-v4-seo__block">
            <div className="home-v4-section__head">
              <div>
                <h2>如何使用本站查找夸克资料</h2>
              </div>
            </div>
            <ol className="home-v4-seo__steps">
              {homeGuideSteps.map((step) => (
                <li className="home-v4-seo__step" key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="home-v4-panel home-v4-seo__block">
            <div className="home-v4-section__head">
              <div>
                <h2>常见问题</h2>
              </div>
            </div>
            <div className="home-v4-seo__faq">
              {homeFaqs.map((item) => (
                <article className="home-v4-seo__faq-item" key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
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

  const channelsById = new Map(structure.channels.map((channel) => [channel.id, channel]));
  const topicsByCategoryId = new Map<string, HomeCategoryShowcaseItem["topics"]>();
  const resourcesByTopicId = new Map<string, Array<HomeCategoryShowcaseItem["topics"][number]["resources"][number]>>();

  for (const resource of [...publishedResources].sort((a, b) => {
    const timeDelta = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return a.title.localeCompare(b.title, "zh-CN");
  })) {
    for (const topicId of resource.topic_ids || []) {
      const list = resourcesByTopicId.get(topicId) || [];
      list.push({
        id: resource.id,
        title: resource.title,
        slug: resource.slug,
        updated_at: resource.updated_at
      });
      resourcesByTopicId.set(topicId, list);
    }
  }

  for (const topic of structure.topics
    .filter((item) => item.status === "active" && item.show_on_home)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh-CN"))) {
    const list = topicsByCategoryId.get(topic.category_id) || [];
    list.push({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      summary: topic.summary,
      featured: topic.featured,
      show_on_home: topic.show_on_home,
      resources: (resourcesByTopicId.get(topic.id) || []).slice(0, 8)
    });
    topicsByCategoryId.set(topic.category_id, list);
  }

  const categoriesWithTopics = structure.categories
    .filter((category) => category.status === "active")
    .map((category) => {
      const channel = channelsById.get(category.channel_id);
      const topics = topicsByCategoryId.get(category.id) || [];

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        channelName: channel?.name || "未分频道",
        channelSlug: channel?.slug || "",
        sort: category.sort,
        channelSort: channel?.sort || 0,
        featured: Boolean(category.featured),
        show_on_home: Boolean(category.show_on_home),
        topics
      };
    })
    .filter((category) => category.topics.length > 0);

  const homeCategoriesSource =
    categoriesWithTopics.some((category) => category.show_on_home)
      ? categoriesWithTopics.filter((category) => category.show_on_home)
      : categoriesWithTopics.filter((category) => category.featured).slice(0, 4);

  const homeCategories = homeCategoriesSource
    .sort((a, b) => a.channelSort - b.channelSort || a.sort - b.sort || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, 6)
    .map(({ sort: _sort, channelSort: _channelSort, featured: _featured, show_on_home: _showOnHome, ...item }) => item);

  return {
    props: {
      latestResources: publishedResources.slice(0, 16),
      hotResources: hotResources.length > 0 ? (hotResources as Resource[]) : publishedResources.slice(0, 12),
      tags: resolvedTags.slice(0, 18),
      featuredChannels: resolvedFeaturedChannels.slice(0, 6),
      hotSearches,
      homeCategories
    }
  };
};
