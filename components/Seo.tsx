import Head from "next/head";

import { absoluteUrl, siteConfig } from "@/lib/site";

// 默认 OG 图片路径，需在 public/ 目录下放置真实图片（1200×630 px）
// TODO: 添加 public/og-default.png 以在无封面页面也能正常社交分享
const DEFAULT_OG_IMAGE_PATH = "";

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
  keywords?: string;
  /** "website" | "article" — 资源详情页应传 "article" */
  ogType?: "website" | "article";
  /** 发布时间（ISO 字符串），用于 article:published_time */
  publishedAt?: string;
  /** 更新时间（ISO 字符串），用于 article:modified_time */
  updatedAt?: string;
}

export function Seo({
  title,
  description,
  path = "/",
  image,
  noindex = false,
  keywords,
  ogType = "website",
  publishedAt,
  updatedAt,
}: SeoProps) {
  const url = absoluteUrl(path);
  const fullTitle = `${title} | ${siteConfig.shortName}`;
  const ogImage = image || (DEFAULT_OG_IMAGE_PATH ? absoluteUrl(DEFAULT_OG_IMAGE_PATH) : null);
  // 截断 description 到 155 字（避免 Google 截断）
  const metaDesc = description.length > 155 ? description.slice(0, 152) + "..." : description;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      {keywords && <meta name="keywords" content={keywords} />}
      {/* Google Discover 允许大图、完整摘要 */}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteConfig.name} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta property="og:image:width" content="1200" />}
      {ogImage && <meta property="og:image:height" content="630" />}
      {ogType === "article" && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}
      {ogType === "article" && updatedAt && (
        <meta property="article:modified_time" content={updatedAt} />
      )}
      {/* Twitter / X Card */}
      <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDesc} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      <link rel="canonical" href={url} />
    </Head>
  );
}

