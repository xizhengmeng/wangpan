import Link from "next/link";

function buildCategoryHref(slug: string, page: number) {
  if (page <= 1) {
    return `/category/${slug}`;
  }
  return `/category/${slug}?page=${page}`;
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

interface CategoryPaginationProps {
  slug: string;
  page: number;
  total: number;
  totalPages: number;
}

export function CategoryPagination({ slug, page, total, totalPages }: CategoryPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const paginationItems = buildPagination(page, totalPages);

  return (
    <nav aria-label="分类结果分页" className="search-pagination">
      <div className="search-pagination__bar">
        <p className="search-pagination__summary">
          第 {page} / {totalPages} 页，共 {total} 条资源
        </p>
        <div className="search-pagination__actions">
          <div className="search-pagination__pages">
            {page > 1 ? (
              <Link className="search-pagination__page" href={buildCategoryHref(slug, page - 1)}>
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
                <Link className="search-pagination__page" href={buildCategoryHref(slug, item)} key={item}>
                  {item}
                </Link>
              )
            )}

            {page < totalPages ? (
              <Link className="search-pagination__page" href={buildCategoryHref(slug, page + 1)}>
                下一页
              </Link>
            ) : (
              <span className="search-pagination__page search-pagination__page--disabled">下一页</span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
