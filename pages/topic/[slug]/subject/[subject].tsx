import Link from "next/link";
import { GetServerSideProps } from "next";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { getExamTopicConfig } from "@/lib/examTopics";
import { absoluteUrl } from "@/lib/site";
import { getContentStructure, getResourcesByTopicId, getTopicBySlug } from "@/lib/store";
import type { Resource } from "@/lib/types";

interface ExamSubjectPageProps {
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
  subject: string;
  examLabel: string;
  resources: Resource[];
  years: string[];
  regions: string[];
}

export default function ExamSubjectPage({
  topic,
  categoryName,
  categorySlug,
  channelName,
  channelSlug,
  subject,
  examLabel,
  resources,
  years,
  regions,
}: ExamSubjectPageProps) {
  const title = `${subject}${examLabel}汇总`;
  const description = `${title}页，收录 ${resources.length} 份资料，覆盖 ${years[years.length - 1]}-${years[0]} 年与 ${regions.slice(0, 6).join("、")} 等地区。`;
  const path = `/topic/${topic.slug}/subject/${subject}`;
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
            <span className="eyebrow">{examLabel}单科页</span>
            <h1 className="page-title">{title}</h1>
            <p className="page-copy">
              按学科汇总全部 {subject}{examLabel}，适合直接浏览历年该科目的完整资料。
            </p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <span className="chip">{resources.length} 条资源</span>
              <span className="chip">{years.length} 个年份</span>
              <span className="chip">{regions.length} 个地区</span>
              <Link className="chip" href={`/topic/${topic.slug}`}>返回专题总页</Link>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="section-title">全部真题</h2>
                <p className="section-subtitle">
                  年份覆盖：{years[0]} 至 {years[years.length - 1]}，地区覆盖：{regions.slice(0, 10).join("、")}{regions.length > 10 ? " 等" : ""}
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

export const getServerSideProps: GetServerSideProps<ExamSubjectPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const subject = decodeURIComponent(String(params?.subject || "")).trim();
  const config = getExamTopicConfig(slug);

  if (!config || !subject) {
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
    .filter((resource) => config.getSubject(resource) === subject)
    .sort((a, b) => {
      const yearA = Number(config.getYear(a) || 0);
      const yearB = Number(config.getYear(b) || 0);
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (resources.length === 0) {
    return { notFound: true };
  }

  const years = Array.from(new Set(resources.map(config.getYear).filter(Boolean) as string[])).sort((a, b) => Number(b) - Number(a));
  const regions = config.sortRegions(Array.from(new Set(resources.flatMap(config.getApplicableRegions))));
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
      subject,
      examLabel: config.label,
      resources,
      years,
      regions,
    },
  };
};
