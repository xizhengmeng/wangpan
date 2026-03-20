import { GetServerSideProps } from "next";

import { absoluteUrl } from "@/lib/site";

export default function Robots() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "text/plain");
  res.write(`User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`);
  res.end();

  return {
    props: {}
  };
};
