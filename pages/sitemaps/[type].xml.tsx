import { GetServerSideProps } from "next";

import { absoluteUrl } from "@/lib/site";
import { getCategoryMap, getPublishedResources, getTagMap } from "@/lib/store";

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
    urls = getPublishedResources().map((resource) => absoluteUrl(`/resource/${resource.slug}`));
  } else if (type === "categories") {
    urls = getCategoryMap().map((category) => absoluteUrl(`/category/${category.slug}`));
  } else if (type === "tags") {
    urls = getTagMap().map((tag) => absoluteUrl(`/tag/${tag.slug}`));
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
