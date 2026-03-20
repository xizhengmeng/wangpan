import Link from "next/link";

import { formatDate } from "@/lib/format";
import { Resource } from "@/lib/types";

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <article className="resource-card">
      <Link href={`/resource/${resource.slug}`}>
        <div className="resource-card__media">
          <img src={resource.cover} alt={resource.title} loading="lazy" />
        </div>
        <div className="resource-card__body">
          <div className="meta-row">
            <span className="meta-pill">{resource.category}</span>
            <span className="meta-pill">更新于 {formatDate(resource.updated_at)}</span>
          </div>
          <h3>{resource.title}</h3>
          <p>{resource.summary}</p>
          <div className="tag-cloud">
            {resource.tags.slice(0, 3).map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
