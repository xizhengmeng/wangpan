import { GetServerSideProps } from "next";

import { absoluteUrl } from "@/lib/site";

export default function SitemapIndex() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${absoluteUrl("/sitemaps/resources.xml")}</loc></sitemap>
  <sitemap><loc>${absoluteUrl("/sitemaps/channels.xml")}</loc></sitemap>
  <sitemap><loc>${absoluteUrl("/sitemaps/categories.xml")}</loc></sitemap>
  <sitemap><loc>${absoluteUrl("/sitemaps/topics.xml")}</loc></sitemap>
  <sitemap><loc>${absoluteUrl("/sitemaps/tags.xml")}</loc></sitemap>
</sitemapindex>`;
  res.setHeader("Content-Type", "application/xml");
  res.write(xml);
  res.end();

  return {
    props: {}
  };
};
