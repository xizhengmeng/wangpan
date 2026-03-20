import { GetServerSideProps } from "next";
import Link from "next/link";

import { SearchBox } from "@/components/SearchBox";
import { SearchRecorder } from "@/components/SearchRecorder";
import { Seo } from "@/components/Seo";
import { TrackedLink } from "@/components/TrackedLink";
import { formatDate, slugify } from "@/lib/format";
import { runSearch } from "@/lib/store";
import { SearchResponse } from "@/lib/types";

interface SearchPageProps extends SearchResponse {}

export default function SearchPage({ items, total, page, pageSize, query }: SearchPageProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Seo
        title={`${query || "站内搜索"} 搜索结果`}
        description={query ? `查找与 ${query} 相关的夸克资料资源。` : "按关键词搜索站内资料。"}
        path={`/search?q=${encodeURIComponent(query)}`}
      />
      <SearchRecorder query={query} total={total} />

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">站内搜索</span>
            <h1 className="page-title">按关键词定位资料</h1>
            <p className="page-copy">
              V1 保持搜索简单清晰：仅关键词 + 相关性排序，不引入复杂筛选器。
            </p>
            <SearchBox initialQuery={query} />
          </section>

          <section className="panel" style={{ padding: 24 }}>
            <div className="section-head">
              <div>
                <h2 className="section-title">“{query || "全部"}” 的搜索结果</h2>
                <p className="section-subtitle">共 {total} 条结果，按标题、标签、摘要相关性排序。</p>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="result-list">
                {items.map((item, index) => (
                  <article className="result-row" key={item.id}>
                    <img src={item.cover} alt={item.title} loading="lazy" />
                    <div>
                      <div className="meta-row">
                        <span className="meta-pill">{item.category}</span>
                        <span className="meta-pill">更新于 {formatDate(item.updated_at)}</span>
                      </div>
                      <h3>
                        <TrackedLink
                          href={`/resource/${item.slug}`}
                          eventName="search_result_click"
                          payload={{
                            query,
                            resource_id: item.id,
                            result_rank: (page - 1) * pageSize + index + 1
                          }}
                        >
                          {item.title}
                        </TrackedLink>
                      </h3>
                      <p className="muted">{item.summary}</p>
                      <div className="tag-cloud">
                        {item.tags.map((tag) => (
                          <Link className="tag" href={`/tag/${slugify(tag)}`} key={tag}>
                            {tag}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>还没有找到相关资源</strong>
                <p className="muted">这个关键词会被记入无结果词，后续可据此补库。</p>
                <div className="chip-row" style={{ justifyContent: "center" }}>
                  <Link className="chip" href="/category/%E8%80%83%E8%AF%95%E8%B5%84%E6%96%99">
                    先看考试资料
                  </Link>
                  <Link className="chip" href="/category/%E6%A8%A1%E6%9D%BF%E7%B4%A0%E6%9D%90">
                    先看模板素材
                  </Link>
                </div>
              </div>
            )}

            {totalPages > 1 ? (
              <div className="chip-row" style={{ marginTop: 24 }}>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Link
                    className="chip"
                    href={`/search?q=${encodeURIComponent(query)}&page=${pageNumber}`}
                    key={pageNumber}
                  >
                    第 {pageNumber} 页
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SearchPageProps> = async ({ query }) => {
  const q = typeof query.q === "string" ? query.q : "";
  const page = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1;

  return {
    props: runSearch(q, page)
  };
};
