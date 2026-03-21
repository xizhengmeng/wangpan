import { GetServerSideProps } from "next";
import Link from "next/link";

import { SearchBox } from "@/components/SearchBox";
import { SearchRecorder } from "@/components/SearchRecorder";
import { Seo } from "@/components/Seo";
import { TrackedLink } from "@/components/TrackedLink";
import { formatDate } from "@/lib/format";
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
        noindex={true}
      />
      <SearchRecorder query={query} total={total} />

      <div className="page-shell">
        <div className="container">
          <section className="page-hero panel">
            <span className="eyebrow">站内搜索</span>
            <h1 className="page-title">搜索夸克网盘资料</h1>
            <p className="page-copy">
              输入关键词，按标题、标签、内容相关度排序，快速找到您需要的资料。
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
                    <div className="result-row__meta">
                      <span className="result-row__category">{item.category}</span>
                      <span>更新于 {formatDate(item.updated_at)}</span>
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
                    <p className="result-row__summary">{item.summary}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>还没有找到相关资源</strong>
                <p className="muted">这个关键词会被记入无结果词，后续可据此补库。</p>
                <div className="chip-row" style={{ justifyContent: "center" }}>
                  <Link className="chip" href="/channel/education-exam">
                    先看教育考试
                  </Link>
                  <Link className="chip" href="/channel/software-tools">
                    先看软件工具
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
    props: await runSearch(q, page)
  };
};
