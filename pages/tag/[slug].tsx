import { GetServerSideProps } from "next";

import { ResourceListCompact } from "@/components/ResourceListCompact";
import { Seo } from "@/components/Seo";
import { slugify } from "@/lib/format";
import { getResourcesByTagSlug } from "@/lib/store";
import { Resource } from "@/lib/types";

interface TagPageProps {
  tagName: string;
  slug: string;
  items: Resource[];
}

export default function TagPage({ tagName, slug, items }: TagPageProps) {
  const description = `围绕 ${tagName} 的夸克资料标签聚合页，适合承接长尾搜索词。`;

  return (
    <>
      <Seo title={`${tagName} 资料标签页`} description={description} path={`/tag/${slug}`} />

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">标签聚合页</span>
            <h1 className="page-title">{tagName}</h1>
            <p className="page-copy">{description}</p>
          </section>

          <section className="section">
            <ResourceListCompact items={items} />
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<TagPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const items = await getResourcesByTagSlug(slug);

  if (items.length === 0) {
    return {
      notFound: true
    };
  }

  const tagName =
    items.flatMap((item) => item.tags).find((tag) => slugify(tag) === slug) || items[0].tags[0];

  return {
    props: {
      tagName,
      slug,
      items
    }
  };
};
