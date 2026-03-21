import { ReactNode } from "react";

import { Seo } from "@/components/Seo";

interface InfoSection {
  title: string;
  content: ReactNode;
}

interface InfoPageProps {
  title: string;
  description: string;
  path: string;
  eyebrow: string;
  sections: InfoSection[];
}

export function InfoPage({ title, description, path, eyebrow, sections }: InfoPageProps) {
  return (
    <>
      <Seo title={title} description={description} path={path} />

      <div className="page-shell">
        <section className="page-hero panel">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="page-title">{title}</h1>
          <p className="page-copy">{description}</p>
        </section>

        <div className="info-stack">
          {sections.map((section) => (
            <section className="panel info-section" key={section.title}>
              <h2 className="section-title">{section.title}</h2>
              <div className="info-copy">{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
