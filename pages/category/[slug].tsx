import { GetServerSideProps } from "next";

import { ResourceCard } from "@/components/ResourceCard";
import { Seo } from "@/components/Seo";
import { getResourcesByCategorySlug } from "@/lib/store";
import { Resource } from "@/lib/types";

interface CategoryPageProps {
  categoryName: string;
  slug: string;
  items: Resource[];
}

export default function CategoryPage({ categoryName, slug, items }: CategoryPageProps) {
  const description = `${categoryName} 相关夸克资料合集页，持续更新资源并提供详情页内链。`;

  return (
    <>
      <Seo
        title={`${categoryName} 资源合集`}
        description={description}
        path={`/category/${slug}`}
      />

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">分类聚合页</span>
            <h1 className="page-title">{categoryName}</h1>
            <p className="page-copy">{description}</p>
          </section>

          <section className="section">
            <div className="card-grid">
              {items.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<CategoryPageProps> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const items = await getResourcesByCategorySlug(slug);

  if (items.length === 0) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      categoryName: items[0].category,
      slug,
      items
    }
  };
};
