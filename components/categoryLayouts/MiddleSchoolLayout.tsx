import Link from "next/link";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { getZhongkaoApplicableRegions, getZhongkaoSubject, getZhongkaoYear, sortZhongkaoRegions } from "@/lib/zhongkao";
import { CategoryPagination } from "./CategoryPagination";
import type { CategoryLayoutProps } from "./types";

function toRankedList(values: string[]) {
  const counter = new Map<string, number>();
  for (const value of values) {
    counter.set(value, (counter.get(value) || 0) + 1);
  }
  return Array.from(counter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });
}

export default function MiddleSchoolLayout({
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
  const description = `${categoryName} 持续更新中考真题、练习资料与专题整理，适合按科目、年份和地区快速定位。`;
  const path = page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`;
  const zhongkaoTopic = topics.find((topic) => topic.slug === "zhongkaozhenti");

  const zhongkaoResources = zhongkaoTopic?.resources || [];
  const zhongkaoSubjects = Array.from(
    new Set(zhongkaoResources.map(getZhongkaoSubject).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const zhongkaoRegions = sortZhongkaoRegions(
    Array.from(new Set(zhongkaoResources.flatMap(getZhongkaoApplicableRegions)))
  );
  const latestYear = Array.from(
    new Set(zhongkaoResources.map(getZhongkaoYear).filter(Boolean) as string[])
  ).sort((a, b) => Number(b) - Number(a))[0];
  const latestYearRegions = latestYear
    ? sortZhongkaoRegions(
        Array.from(
          new Set(
            zhongkaoResources
              .filter((resource) => getZhongkaoYear(resource) === latestYear)
              .flatMap(getZhongkaoApplicableRegions)
          )
        )
      )
    : [];
  const topSubjects = toRankedList(
    zhongkaoResources.map(getZhongkaoSubject).filter(Boolean) as string[]
  ).slice(0, 8);
  const topRegions = toRankedList(
    zhongkaoResources.flatMap(getZhongkaoApplicableRegions)
  ).slice(0, 12);

  return (
    <>
      <Seo
        title={`${categoryName} 资源合集`}
        description={description}
        path={path}
      />

      <div className="page-shell">
        <div className="container">
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            <Link href={`/channel/${channelSlug}`}>{channelName}</Link>
            <span className="breadcrumb__sep">›</span>
            <span>{categoryName}</span>
          </nav>

          <section className="page-hero panel">
            <span className="eyebrow">初中资料专区</span>
            <h1 className="page-title">{categoryName}</h1>
            <p className="page-copy">{description}</p>
            <div className="chip-row ch-topic-links">
              {topics.map((topic) => (
                <Link className="chip" href={`/topic/${topic.slug}`} key={topic.id}>
                  {topic.name}
                </Link>
              ))}
            </div>
          </section>

          {zhongkaoTopic ? (
            <section className="section panel ms-exam-hub">
              <div className="section-head">
                <div>
                  <h2 className="section-title">中考真题快速进入</h2>
                  <p className="section-subtitle">把高价值的中考真题聚合页直接提到初中专区首页。</p>
                </div>
              </div>

              <div className="ms-exam-hub__hero">
                <Link className="ms-exam-hub__card" href={`/topic/${zhongkaoTopic.slug}`}>
                  <span className="ms-exam-hub__eyebrow">核心专题</span>
                  <strong>{zhongkaoTopic.name}</strong>
                  <p>{zhongkaoTopic.summary}</p>
                  <span className="ms-exam-hub__meta">{zhongkaoResources.length} 条真题资源</span>
                </Link>
              </div>

              {(topSubjects.length > 0 || topRegions.length > 0) && (
                <div className="ms-exam-hub__recommend">
                  {topSubjects.length > 0 && (
                    <section className="ms-exam-hub__recommend-card">
                      <div className="ms-exam-hub__head">
                        <h3>热门科目</h3>
                      </div>
                      <div className="ms-exam-hub__rank-list">
                        {topSubjects.map((item) => (
                          <Link
                            className="ms-exam-hub__rank-item"
                            href={`/topic/${zhongkaoTopic.slug}/subject/${encodeURIComponent(item.name)}`}
                            key={`subject-${item.name}`}
                          >
                            <span>{item.name}中考真题</span>
                            <strong>{item.count}</strong>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {topRegions.length > 0 && (
                    <section className="ms-exam-hub__recommend-card">
                      <div className="ms-exam-hub__head">
                        <h3>热门地区</h3>
                      </div>
                      <div className="ms-exam-hub__rank-list">
                        {topRegions.map((item) => (
                          <Link
                            className="ms-exam-hub__rank-item"
                            href={`/topic/${zhongkaoTopic.slug}/region/${encodeURIComponent(item.name)}`}
                            key={`region-${item.name}`}
                          >
                            <span>{item.name}中考真题</span>
                            <strong>{item.count}</strong>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {zhongkaoSubjects.length > 0 && (
                <div className="ms-exam-hub__group">
                  <div className="ms-exam-hub__head">
                    <h3>按科目浏览</h3>
                  </div>
                  <div className="ms-exam-hub__chips">
                    {zhongkaoSubjects.map((subject) => (
                      <Link
                        className="ms-exam-hub__chip"
                        href={`/topic/${zhongkaoTopic.slug}/subject/${encodeURIComponent(subject)}`}
                        key={subject}
                      >
                        {subject}中考真题
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {zhongkaoRegions.length > 0 && (
                <div className="ms-exam-hub__group">
                  <div className="ms-exam-hub__head">
                    <h3>按地区汇总</h3>
                  </div>
                  <div className="ms-exam-hub__chips">
                    {zhongkaoRegions.slice(0, 15).map((region) => (
                      <Link
                        className="ms-exam-hub__chip"
                        href={`/topic/${zhongkaoTopic.slug}/region/${encodeURIComponent(region)}`}
                        key={region}
                      >
                        {region}中考真题
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {latestYear && latestYearRegions.length > 0 && (
                <div className="ms-exam-hub__group">
                  <div className="ms-exam-hub__head">
                    <h3>{latestYear} 年地区真题</h3>
                  </div>
                  <div className="ms-exam-hub__chips">
                    {latestYearRegions.slice(0, 12).map((region) => (
                      <Link
                        className="ms-exam-hub__chip"
                        href={`/topic/${zhongkaoTopic.slug}/${latestYear}/${encodeURIComponent(region)}`}
                        key={`${latestYear}-${region}`}
                      >
                        {latestYear}年{region}中考真题
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}

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
