import Link from "next/link";
import { GetServerSideProps } from "next";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { getExamTopicConfig } from "@/lib/examTopics";
import { absoluteUrl } from "@/lib/site";
import { getContentStructure, getResourcesByTopicId, getTopicBySlug } from "@/lib/store";
import type { Resource } from "@/lib/types";

interface ExamRegionYearPageProps {
  topic: {
    id: string;
    name: string;
    slug: string;
    summary: string;
  };
  categoryName: string;
  categorySlug: string;
  channelName: string;
  channelSlug: string;
  year: string;
  region: string;
  examLabel: string;
  resources: Resource[];
  subjects: string[];
}

export default function ExamRegionYearPage({
  topic,
  categoryName,
  categorySlug,
  channelName,
  channelSlug,
  year,
  region,
  examLabel,
  resources,
  subjects,
}: ExamRegionYearPageProps) {
  const title = `${year}年${region}${examLabel}`;
  const description = `${title}汇总页，收录 ${resources.length} 份资料，覆盖 ${subjects.join("、")} 等科目。`;
  const path = `/topic/${topic.slug}/${year}/${region}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: absoluteUrl(path),
  };

  return (
    <>
      <Seo title={title} description={description} path={path} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="page-shell">
        <div className="container">
          <nav className="breadcrumb">
            <Link href="/">首页</Link>
            <span className="breadcrumb__sep">›</span>
            {channelName && channelSlug && (
              <>
                <Link href={`/channel/${channelSlug}`}>{channelName}</Link>
                <span className="breadcrumb__sep">›</span>
              </>
            )}
            {categoryName && categorySlug && (
              <>
                <Link href={`/category/${categorySlug}`}>{categoryName}</Link>
                <span className="breadcrumb__sep">›</span>
              </>
            )}
            <Link href={`/topic/${topic.slug}`}>{topic.name}</Link>
            <span className="breadcrumb__sep">›</span>
            <span>{title}</span>
          </nav>

          <section className="page-hero panel">
            <span className="eyebrow">{examLabel}组合页</span>
            <h1 className="page-title">{title}</h1>
            <p className="page-copy">
              汇总 {year} 年 {region} {examLabel}资料，按资源包展示，便于直接浏览当年当地区的全部真题。
            </p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <span className="chip">{resources.length} 条资源</span>
              <span className="chip">{region}</span>
              <span className="chip">{year}</span>
              <Link className="chip" href={`/topic/${topic.slug}`}>返回专题总页</Link>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">全部真题</h2>
                <p className="section-subtitle">
                  覆盖科目：{subjects.join("、")}
                </p>
              </div>
            </div>

            <ResourceListCompact items={resources} />
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ExamRegionYearPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const year = String(params?.year || "");
  const region = decodeURIComponent(String(params?.region || "")).trim();
  const config = getExamTopicConfig(slug);

  if (!config || !/^(19|20)\d{2}$/.test(year) || !config.regionSet.has(region)) {
    return { notFound: true };
  }

  const topic = await getTopicBySlug(slug);
  if (!topic) {
    return { notFound: true };
  }

  const [structure, topicResources] = await Promise.all([
    getContentStructure(),
    getResourcesByTopicId(topic.id),
  ]);

  const resources = topicResources
    .filter((resource) => config.getYear(resource) === year)
    .filter((resource) => config.getApplicableRegions(resource).includes(region))
    .sort((a, b) => {
      const aSubject = config.getSubject(a) || "";
      const bSubject = config.getSubject(b) || "";
      const bySubject = aSubject.localeCompare(bSubject, "zh-CN");
      if (bySubject !== 0) {
        return bySubject;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (resources.length === 0) {
    return { notFound: true };
  }

  const subjects = Array.from(new Set(resources.map(config.getSubject).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const category = structure.categories.find((item) => item.id === topic.category_id);
  const channel = category
    ? structure.channels.find((item) => item.id === category.channel_id)
    : null;

  return {
    props: {
      topic: {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        summary: topic.summary,
      },
      categoryName: category?.name || "未分类",
      categorySlug: category?.slug || "",
      channelName: channel?.name || "未分频道",
      channelSlug: channel?.slug || "",
      year,
      region,
      examLabel: config.label,
      resources,
      subjects,
    },
  };
};
