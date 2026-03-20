import Link from "next/link";
import { PropsWithChildren } from "react";

import { SearchBox } from "@/components/SearchBox";

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/">
            <span className="brand-icon">夸</span>
            <strong>夸克资料站</strong>
          </Link>

          <nav className="nav" aria-label="主导航">
            <Link href="/" className="nav-link active">首页</Link>
            <Link href="/search?q=" className="nav-link">发现</Link>
            <Link href="/search?q=考试资料" className="nav-link">考试</Link>
            <Link href="/search?q=模板" className="nav-link">模板</Link>
            <Link href="/search?q=AI" className="nav-link">AI 资料</Link>
          </nav>

          <div className="header-search">
            <SearchBox compact />
          </div>

          <Link href="/admin/resources" className="btn-admin">后台</Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>夸克资料站 · 搜索驱动更新</p>
          <p>
            <Link href="/sitemap.xml">Sitemap</Link>
            <span className="footer-sep">·</span>
            <Link href="/admin/resources">后台管理</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
