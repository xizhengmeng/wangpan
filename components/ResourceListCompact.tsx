import Link from "next/link";

import { formatDate } from "@/lib/format";
import { Resource } from "@/lib/types";

interface ResourceListCompactProps {
  items: Resource[];
}

export function ResourceListCompact({ items }: ResourceListCompactProps) {
  return (
    <div className="result-list">
      {items.map((item) => (
        <article className="result-row" key={item.id}>
          <div className="result-row__meta">
            <span className="result-row__category">{item.category}</span>
            <span>更新于 {formatDate(item.updated_at)}</span>
          </div>
          <h3>
            <Link href={`/resource/${item.slug}`}>{item.title}</Link>
          </h3>
          <p className="result-row__summary">{item.summary}</p>
        </article>
      ))}
    </div>
  );
}
