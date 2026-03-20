import Link from "next/link";
import { PropsWithChildren } from "react";

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link className="brand" href="/">
            <strong>夸克资料搜索站</strong>
            <span>面向中文搜索流量的资料检索站</span>
          </Link>

          <nav className="nav" aria-label="主导航">
            <Link href="/">首页</Link>
            <Link href="/search?q=考研">热门搜索</Link>
            <Link href="/category/%E8%80%83%E8%AF%95%E8%B5%84%E6%96%99">考试资料</Link>
            <Link href="/category/%E6%A8%A1%E6%9D%BF%E7%B4%A0%E6%9D%90">模板素材</Link>
            <Link href="/admin/resources">后台</Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>SEO 资料站基础版，支持搜索、二跳统计、资源后台和 CSV 导入。</p>
          <p>
            <Link href="/sitemap.xml">Sitemap</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
