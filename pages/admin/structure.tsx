import { GetServerSideProps } from "next";

import { Seo } from "@/components/Seo";
import { getContentStructureTree } from "@/lib/store";

interface StructurePageProps {
  tree: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      topics: Array<{
        id: string;
        name: string;
        slug: string;
      }>;
    }>;
  }>;
}

export default function StructurePage({ tree }: StructurePageProps) {
  return (
    <>
      <Seo
        title="内容结构"
        description="频道、栏目、专题的结构预览"
        path="/admin/structure"
        noindex
      />

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">后台结构预览</span>
            <h1 className="page-title">频道 / 栏目 / 专题</h1>
            <p className="page-copy">这页用于验证当前内容树是否已经组织正确，后续可继续接成真正的后台管理页。</p>
          </section>

          <div className="main-grid">
            {tree.map((channel) => (
              <section className="panel" key={channel.id} style={{ padding: 20 }}>
                <div className="section-head">
                  <div>
                    <h2 className="section-title">{channel.name}</h2>
                    <p className="section-subtitle">{channel.description}</p>
                  </div>
                  <span className="chip">{channel.slug}</span>
                </div>

                <div className="main-grid">
                  {channel.categories.map((category) => (
                    <div className="admin-card" key={category.id}>
                      <div className="section-head">
                        <div>
                          <h3 className="section-title">{category.name}</h3>
                          <p className="section-subtitle">{category.slug}</p>
                        </div>
                        <span className="chip">{category.topics.length} 个专题</span>
                      </div>
                      <div className="chip-row">
                        {category.topics.map((topic) => (
                          <span className="chip" key={topic.id}>
                            {topic.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<StructurePageProps> = async () => {
  return {
    props: {
      tree: await getContentStructureTree()
    }
  };
};
