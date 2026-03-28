import { GetServerSideProps } from "next";
import Link from "next/link";

import { SearchBox } from "@/components/SearchBox";
import { SearchRecorder } from "@/components/SearchRecorder";
import { Seo } from "@/components/Seo";
import { TrackedLink } from "@/components/TrackedLink";
import { formatDate } from "@/lib/format";
import { DEFAULT_SEARCH_PAGE_SIZE, normalizeSearchPageSize, SEARCH_PAGE_SIZE_OPTIONS } from "@/lib/search";
import { runSearch } from "@/lib/store";
import { SearchResponse } from "@/lib/types";

interface SearchPageProps extends SearchResponse {}

function buildSearchHref(query: string, page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  if (pageSize !== DEFAULT_SEARCH_PAGE_SIZE) {
    params.set("pageSize", String(pageSize));
  }

  const nextQuery = params.toString();
  return nextQuery ? `/search?${nextQuery}` : "/search";
}

function buildPagination(currentPage: number, totalPages: number, maxVisible = 7) {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const innerSlots = maxVisible - 2;
  let start = Math.max(2, currentPage - Math.floor(innerSlots / 2));
  let end = Math.min(totalPages - 1, start + innerSlots - 1);

  if (end - start + 1 < innerSlots) {
    start = Math.max(2, end - innerSlots + 1);
  }

  if (start > 2) {
    items.push("ellipsis");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
}

export default function SearchPage({ items, total, page, pageSize, query }: SearchPageProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginationItems = buildPagination(page, totalPages);

  return (
    <>
      <Seo
        title={`${query || "站内搜索"} 搜索结果`}
        description={query ? `查找与 ${query} 相关的夸克资料资源。` : "按关键词搜索站内资料。"}
        path={`/search?q=${encodeURIComponent(query)}`}
        noindex={true}
      />
      <SearchRecorder query={query} total={total} />

      <div className="page-shell search-page">
        <div className="container">
          <section className="page-hero panel search-page__hero">
            <span className="eyebrow">站内搜索</span>
            <h1 className="page-title">搜索夸克网盘资料</h1>
            <p className="page-copy">
              输入关键词，按标题、标签、内容相关度排序，快速找到您需要的资料。
            </p>
            <div className="search-page__form">
              <SearchBox initialQuery={query} />
            </div>
          </section>

          <section className="panel search-page__results">
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
                    <div className="search-page__result-head">
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
                      <div className="result-row__meta">
                        <span className="result-row__category">{item.category}</span>
                        <span>{formatDate(item.updated_at)}</span>
                      </div>
                    </div>
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

            {items.length > 0 ? (
              <nav aria-label="搜索结果分页" className="search-pagination">
                <div className="search-pagination__bar">
                  <p className="search-pagination__summary">
                    第 {page} / {totalPages} 页，共 {total} 条结果
                  </p>
                  <div className="search-pagination__actions">
                    {totalPages > 1 ? (
                      <div className="search-pagination__pages">
                        {page > 1 ? (
                          <Link className="search-pagination__page" href={buildSearchHref(query, page - 1, pageSize)}>
                            上一页
                          </Link>
                        ) : (
                          <span className="search-pagination__page search-pagination__page--disabled">上一页</span>
                        )}

                        {paginationItems.map((item, index) =>
                          item === "ellipsis" ? (
                            <span className="search-pagination__ellipsis" key={`ellipsis-${index}`}>
                              …
                            </span>
                          ) : item === page ? (
                            <span className="search-pagination__page search-pagination__page--active" key={item}>
                              {item}
                            </span>
                          ) : (
                            <Link
                              className="search-pagination__page"
                              href={buildSearchHref(query, item, pageSize)}
                              key={item}
                            >
                              {item}
                            </Link>
                          )
                        )}

                        {page < totalPages ? (
                          <Link className="search-pagination__page" href={buildSearchHref(query, page + 1, pageSize)}>
                            下一页
                          </Link>
                        ) : (
                          <span className="search-pagination__page search-pagination__page--disabled">下一页</span>
                        )}
                      </div>
                    ) : null}

                    <form action="/search" className="search-pagination__controls" method="get">
                      {query ? <input name="q" type="hidden" value={query} /> : null}
                      <label className="search-pagination__label" htmlFor="pageSize">
                        每页
                      </label>
                      <select defaultValue={String(pageSize)} id="pageSize" name="pageSize">
                        {SEARCH_PAGE_SIZE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option} 条
                          </option>
                        ))}
                      </select>
                      <label className="search-pagination__label" htmlFor="pageJump">
                        跳至
                      </label>
                      <input
                        className="search-pagination__jump-input"
                        defaultValue={String(page)}
                        id="pageJump"
                        inputMode="numeric"
                        max={totalPages}
                        min={1}
                        name="page"
                        type="number"
                      />
                      <span className="search-pagination__label">页</span>
                      <button className="button button-secondary" type="submit">
                        前往
                      </button>
                    </form>
                  </div>
                </div>
              </nav>
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
  const pageSize = normalizeSearchPageSize(
    Number.parseInt(typeof query.pageSize === "string" ? query.pageSize : String(DEFAULT_SEARCH_PAGE_SIZE), 10)
  );

  return {
    props: await runSearch(q, page, pageSize)
  };
};
