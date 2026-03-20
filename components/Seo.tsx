import Head from "next/head";

import { absoluteUrl, siteConfig } from "@/lib/site";

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
}

export function Seo({ title, description, path = "/", image, noindex = false }: SeoProps) {
  const url = absoluteUrl(path);
  const fullTitle = `${title} | ${siteConfig.shortName}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteConfig.name} />
      {image ? <meta property="og:image" content={image} /> : null}
      <link rel="canonical" href={url} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
    </Head>
  );
}
