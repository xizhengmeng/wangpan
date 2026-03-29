import Link from "next/link";

import { formatDate } from "@/lib/format";
import { Resource } from "@/lib/types";

interface ResourceListCompactProps {
  items: Resource[];
}

export function ResourceListCompact({ items }: ResourceListCompactProps) {
  return (
    <div className="elegant-resource-list">
      <style jsx>{`
        .elegant-resource-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .er-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: all 0.2s ease;
          text-decoration: none;
          color: inherit;
        }
        .er-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
          transform: translateY(-1px);
        }
        .er-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .er-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          transition: color 0.2s;
        }
        .er-card:hover .er-title {
          color: #2563eb;
        }
        .er-title-link {
          text-decoration: none;
          color: inherit;
        }
        .er-title-link::after {
          position: absolute;
          inset: 0;
          content: "";
        }
        .er-card {
          position: relative;
        }
        .er-meta-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .er-date {
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .er-summary {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .er-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }
        .er-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: #f1f5f9;
          color: #475569;
          border-radius: 4px;
          font-weight: 500;
        }
        .er-category {
          background: #eff6ff;
          color: #2563eb;
        }
        @media (max-width: 640px) {
          .er-card { padding: 16px; }
          .er-header { flex-direction: column; gap: 4px; }
          .er-meta-right { display: none; }
          .er-title { font-size: 15px; }
          .er-summary { -webkit-line-clamp: 1; }
        }
      `}</style>

      {items.map((item) => {
        // Extract grades/editions for tags
        const tags = [];
        if (item.tags) {
          const grades = item.tags.filter(t => ["七年级","八年级","九年级"].includes(t));
          if (grades.length > 0) tags.push(...grades.slice(0,1));
          
          const types = item.tags.filter(t => ["期中","期末","月考","单元测试","一课一练"].includes(t));
          if (types.length > 0) tags.push(...types.slice(0,1));
        }

        return (
          <article className="er-card" key={item.id}>
            <div className="er-header">
              <h3 className="er-title">
                <Link href={`/resource/${item.slug}`} className="er-title-link">
                  {item.title}
                </Link>
              </h3>
              <div className="er-meta-right">
                <span className="er-date">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  {formatDate(item.updated_at)}
                </span>
              </div>
            </div>
            
            {item.summary && (
              <p className="er-summary">{item.summary}</p>
            )}

            <div className="er-footer">
              <span className="er-tag er-category">{item.category}</span>
              {tags.map((tag, idx) => (
                <span key={idx} className="er-tag">{tag}</span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
