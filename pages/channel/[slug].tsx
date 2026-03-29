import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { absoluteUrl } from "@/lib/site";
import { getContentStructureTree } from "@/lib/store";
import { Resource } from "@/lib/types";

interface ChannelPageProps {
  channel: {
    id: string;
    name: string;
    slug: string;
    description: string;
    resources: Resource[];
    categories: Array<{
      id: string;
      parent_id?: string | null;
      name: string;
      slug: string;
      description: string;
      resources: Resource[];
      topics: Array<{
        id: string;
        name: string;
        slug: string;
        summary: string;
        resources: Resource[];
      }>;
    }>;
  };
}

type ChannelCategory = ChannelPageProps["channel"]["categories"][number];

function resolveTabSlug(rootCategories: ChannelCategory[], allCategories: ChannelCategory[], value: string | string[] | undefined) {
  const slug = typeof value === "string" ? value : "";
  if (slug && rootCategories.some((category) => category.slug === slug)) {
    return slug;
  }

  if (slug) {
    const matchedChild = allCategories.find((category) => category.slug === slug);
    if (matchedChild?.parent_id) {
      const parent = allCategories.find((category) => category.id === matchedChild.parent_id);
      if (parent) {
        return parent.slug;
      }
    }
  }

  return rootCategories.find((category) => category.topics.length > 0 || category.resources.length > 0)?.slug || rootCategories[0]?.slug || "";
}

export default function ChannelPage({ channel }: ChannelPageProps) {
  const router = useRouter();
  const categoryCount = channel.categories.length;
  const totalResources = channel.resources.length;
  const totalTopics = channel.categories.reduce((sum, category) => sum + category.topics.length, 0);

  const allCategories = useMemo(
    () =>
      channel.categories.map((category) => ({
        ...category,
        resourceCount: category.resources.length,
        topicCount: category.topics.length,
      })),
    [channel.categories]
  );
  const rootCategories = useMemo(
    () => allCategories.filter((category) => !category.parent_id),
    [allCategories]
  );
  const [activeCategorySlug, setActiveCategorySlug] = useState(() =>
    resolveTabSlug(rootCategories, allCategories, undefined)
  );

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const nextSlug = resolveTabSlug(rootCategories, allCategories, router.query.tab);
    setActiveCategorySlug((current) => (current === nextSlug ? current : nextSlug));
  }, [allCategories, rootCategories, router.isReady, router.query.tab]);

  useEffect(() => {
    if (!router.isReady || !activeCategorySlug) {
      return;
    }

    const currentTab = typeof router.query.tab === "string" ? router.query.tab : "";
    if (currentTab === activeCategorySlug) {
      return;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          tab: activeCategorySlug,
        },
      },
      undefined,
      {
        shallow: true,
        scroll: false,
      }
    );
  }, [activeCategorySlug, router]);

  const activeCategory = rootCategories.find((category) => category.slug === activeCategorySlug) || rootCategories[0];
  const activeChildCategories = useMemo(
    () => allCategories.filter((category) => category.parent_id === activeCategory?.id),
    [activeCategory?.id, allCategories]
  );
  const descendantCategoryIds = useMemo(() => {
    if (!activeCategory) {
      return new Set<string>();
    }
    const ids = new Set<string>([activeCategory.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of allCategories) {
        if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
          ids.add(category.id);
          changed = true;
        }
      }
    }
    return ids;
  }, [activeCategory, allCategories]);
  const aggregatedTopics = useMemo(
    () => allCategories
      .filter((category) => descendantCategoryIds.has(category.id))
      .flatMap((category) => category.topics),
    [allCategories, descendantCategoryIds]
  );
  const aggregatedResources = useMemo(
    () => allCategories
      .filter((category) => descendantCategoryIds.has(category.id))
      .flatMap((category) => category.resources)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [allCategories, descendantCategoryIds]
  );
  const featuredTopics = aggregatedTopics.slice(0, 4);
  const moreTopics = aggregatedTopics.slice(4);
  const visibleResources = aggregatedResources.slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: channel.name,
    description: channel.description,
    url: absoluteUrl(`/channel/${channel.slug}`),
  };

  return (
    <>
      <Seo
        title={`${channel.name} 频道`}
        description={channel.description}
        path={`/channel/${channel.slug}`}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="page-shell channel-page">
        <nav className="breadcrumb">
          <Link href="/">首页</Link>
          <span className="breadcrumb__sep">›</span>
          <span>{channel.name}</span>
        </nav>

        <section className="page-hero panel channel-page__hero">
          <div className="channel-page__hero-main">
            <span className="eyebrow">教育考试频道</span>
            <h1 className="page-title">{channel.name}</h1>
            <p className="page-copy">{channel.description}</p>
            <div className="channel-page__actions">
              <Link className="channel-page__action channel-page__action--primary" href="/search?q=">
                全站搜索资料
              </Link>
              <Link
                className="channel-page__action"
                href={`/search?q=${encodeURIComponent(channel.name)}`}
              >
                搜索本频道
              </Link>
            </div>
          </div>

          <div className="channel-page__stats" aria-label="频道概览">
            <div className="channel-page__stat">
              <strong>{categoryCount}</strong>
              <span>栏目</span>
            </div>
            <div className="channel-page__stat">
              <strong>{totalTopics}</strong>
              <span>专题入口</span>
            </div>
            <div className="channel-page__stat">
              <strong>{totalResources}</strong>
              <span>资源</span>
            </div>
          </div>
        </section>

        {activeCategory ? (
          <section className="panel channel-tabs-panel">
            <div className="section-head channel-tabs-panel__head">
              <div>
                <h2 className="section-title">按学习阶段切换</h2>
                <p className="section-subtitle">移动端可左右滑动，先选栏目，再继续收窄到专题或资源。</p>
              </div>
            </div>

            <div className="channel-tabs" role="tablist" aria-label={`${channel.name} 栏目切换`}>
              {rootCategories.map((category) => {
                const isActive = category.slug === activeCategory.slug;
                const tabId = `channel-tab-${category.id}`;
                const panelId = `channel-panel-${category.id}`;

                return (
                  <button
                    className={`channel-tab${isActive ? " channel-tab--active" : ""}`}
                    id={tabId}
                    key={category.id}
                    role="tab"
                    type="button"
                    aria-selected={isActive}
                    aria-controls={panelId}
                    onClick={() => {
                      setActiveCategorySlug(category.slug);
                    }}
                  >
                    <span className="channel-tab__title">{category.name}</span>
                    <span className="channel-tab__meta">
                      {category.topicCount} 个专题 · {category.resourceCount} 条资源
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className="channel-tab-panel"
              id={`channel-panel-${activeCategory.id}`}
              role="tabpanel"
              aria-labelledby={`channel-tab-${activeCategory.id}`}
            >
              <section className="channel-category-hero">
                <div className="channel-category-hero__copy">
                  <span className="channel-category-hero__eyebrow">当前栏目</span>
                  <h2>{activeCategory.name}</h2>
                  <p>{activeCategory.description}</p>
                  {activeChildCategories.length > 0 ? (
                    <div className="chip-row" style={{ marginTop: 12 }}>
                      {activeChildCategories.map((child) => (
                        <Link key={child.id} className="chip" href={`/category/${child.slug}`}>
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="channel-category-hero__meta">
                  <div className="channel-category-hero__meta-card">
                    <strong>{aggregatedTopics.length}</strong>
                    <span>专题入口</span>
                  </div>
                  <div className="channel-category-hero__meta-card">
                    <strong>{aggregatedResources.length}</strong>
                    <span>已收录资源</span>
                  </div>
                </div>

                <div className="channel-category-hero__actions">
                  <Link className="channel-category-hero__link" href={`/category/${activeCategory.slug}`}>
                    进入栏目页
                  </Link>
                  <Link
                    className="channel-category-hero__link"
                    href={`/search?q=${encodeURIComponent(activeCategory.name)}`}
                  >
                    搜此栏目
                  </Link>
                </div>
              </section>

              {featuredTopics.length > 0 ? (
                <section className="channel-block">
                  <div className="section-head">
                    <div>
                      <h3 className="section-title">推荐专题</h3>
                      <p className="section-subtitle">优先展示最适合继续细分检索的专题入口。</p>
                    </div>
                  </div>

                  <div className="channel-topic-grid">
                    {featuredTopics.map((topic) => (
                      <Link className="channel-topic-card" href={`/topic/${topic.slug}`} key={topic.id}>
                        <div className="channel-topic-card__top">
                          <h4>{topic.name}</h4>
                          <span>{topic.resources.length} 条</span>
                        </div>
                        {topic.summary ? <p>{topic.summary}</p> : null}
                        {topic.resources[0] ? (
                          <div className="channel-topic-card__preview">{topic.resources[0].title}</div>
                        ) : null}
                      </Link>
                    ))}
                  </div>

                  {moreTopics.length > 0 ? (
                    <div className="channel-topic-chip-row">
                      {moreTopics.map((topic) => (
                        <Link className="channel-topic-chip" href={`/topic/${topic.slug}`} key={topic.id}>
                          <span>{topic.name}</span>
                          <strong>{topic.resources.length}</strong>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {visibleResources.length > 0 ? (
                <section className="channel-block">
                  <div className="section-head">
                    <div>
                      <h3 className="section-title">最近更新</h3>
                      <p className="section-subtitle">先看当前栏目下最近更新的资源，避免在移动端长距离滚动。</p>
                    </div>
                    <Link className="channel-inline-link" href={`/category/${activeCategory.slug}`}>
                      查看栏目全部内容
                    </Link>
                  </div>

                  <div className="channel-resource-panel">
                    <ResourceListCompact items={visibleResources} />
                  </div>
                </section>
              ) : (
                <section className="channel-empty">
                  <h3>这个栏目暂时没有直接资源列表</h3>
                  <p>更适合先从上面的专题入口进入，按考试类型、年级或方向继续筛选。</p>
                </section>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ChannelPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const channel = (await getContentStructureTree()).find((item) => item.slug === slug);

  if (!channel) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      channel,
    },
  };
};
