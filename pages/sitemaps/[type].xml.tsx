import { GetServerSideProps } from "next";

import { absoluteUrl } from "@/lib/site";
import { getCategoryMap, getContentStructure, getPublishedResources, getTagMap } from "@/lib/store";

export default function SitemapFile() {
  return null;
}

function buildUrlSet(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const type = String(params?.type || "");
  let urls: string[] = [];

  if (type === "resources") {
    urls = (await getPublishedResources()).map((resource) => absoluteUrl(`/resource/${resource.slug}`));
  } else if (type === "channels") {
    const structure = await getContentStructure();
    urls = structure.channels
      .filter((ch) => ch.status === "active")
      .map((ch) => absoluteUrl(`/channel/${ch.slug}`));
  } else if (type === "categories") {
    urls = (await getCategoryMap()).map((category) => absoluteUrl(`/category/${category.slug}`));
  } else if (type === "topics") {
    const structure = await getContentStructure();
    urls = structure.topics
      .filter((t) => t.status === "active")
      .map((t) => absoluteUrl(`/topic/${t.slug}`));
  } else if (type === "tags") {
    urls = (await getTagMap()).map((tag) => absoluteUrl(`/tag/${tag.slug}`));
  } else {
    return {
      notFound: true
    };
  }

  res.setHeader("Content-Type", "application/xml");
  res.write(buildUrlSet(urls));
  res.end();

  return {
    props: {}
  };
};
