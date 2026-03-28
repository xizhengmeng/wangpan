import Link from "next/link";
import { useEffect, useMemo, useRef, useState, PropsWithChildren } from "react";
import { useRouter } from "next/router";

import { ContentStructure } from "@/lib/types";

interface NavChildItem {
  label: string;
  href: string;
  meta?: string[];
  topics?: { label: string; href: string }[];
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  children?: NavChildItem[];
  variant?: "links" | "cards" | "mega";
}

export function Layout({ children }: PropsWithChildren) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [structure, setStructure] = useState<ContentStructure | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStructure() {
      try {
        const response = await fetch("/api/layout");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { structure: ContentStructure };
        if (active) {
          setStructure(payload.structure);
        }
      } catch {
        // ignore layout fetch failures in the shell
      }
    }

    void loadStructure();
    return () => {
      active = false;
    };
  }, []);

  const navItems = useMemo(() => {
    if (!structure) {
      return [{ key: "home", label: "首页", href: "/" }] as NavItem[];
    }

    const activeChannels = [...structure.channels]
      .filter((channel) => channel.status === "active")
      .sort((a, b) => {
        const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDelta !== 0) return featuredDelta;
        return a.sort - b.sort;
      });

    const channelItems: NavItem[] = activeChannels.map((channel) => {
      const isMega = channel.id === "channel_education_exam";

      const categories = structure.categories
        .filter((category) => category.channel_id === channel.id && category.status === "active")
        .sort((a, b) => a.sort - b.sort)
        .slice(0, 8)
        .map((category) => {
          const base: NavChildItem = {
            label: category.name,
            href: `/category/${category.slug}`,
          };
          if (isMega) {
            const topics = structure.topics
              .filter((t) => t.category_id === category.id && t.status === "active")
              .sort((a, b) => a.sort - b.sort)
              .map((t) => ({ label: t.name, href: `/topic/${t.slug}` }));
            return { ...base, topics };
          }
          return base;
        });

      return {
        key: channel.id,
        label: channel.name,
        href: `/channel/${channel.slug}`,
        children: categories,
        variant: isMega ? "mega" : "links",
      } as NavItem;
    });

    return [{ key: "home", label: "首页", href: "/" }, ...channelItems];
  }, [structure]);

  useEffect(() => {
    setOpenMenu(null);
    setMobileNavOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openHoverMenu(key: string) {
    clearCloseTimer();
    setOpenMenu(key);
  }

  function scheduleCloseMenu(key: string) {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu((current) => (current === key ? null : current));
      closeTimerRef.current = null;
    }, 180);
  }

  function isItemActive(item: NavItem) {
    if (item.href === "/") {
      return router.pathname === "/";
    }

    if (router.asPath === item.href) return true;

    if (item.children?.some((child) => router.asPath === child.href)) return true;

    // 3rd-level topic pages (mega menu)
    if (item.children?.some((child) => child.topics?.some((t) => router.asPath === t.href))) return true;

    return false;
  }

  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/">
            <span className="brand-icon">夸</span>
            <strong>夸克网盘资料</strong>
          </Link>

          <nav className={`nav${mobileNavOpen ? " nav--mobile-open" : ""}`} aria-label="主导航">
            {navItems.map((item) => {
              const hasChildren = Boolean(item.children?.length);
              const isOpen = openMenu === item.key;
              const isActive = isItemActive(item);

              return (
                <div
                  className={[
                    "nav-item",
                    hasChildren ? "nav-item--has-children" : "",
                    isOpen ? "nav-item--open" : "",
                    isActive ? "nav-item--active" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.key}
                  onMouseEnter={() => {
                    if (hasChildren && !mobileNavOpen) {
                      openHoverMenu(item.key);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasChildren && !mobileNavOpen) {
                      scheduleCloseMenu(item.key);
                    }
                  }}
                >
                  <div className="nav-item__control">
                    <Link href={item.href} className={`nav-link${isActive ? " active" : ""}`}>
                      {item.label}
                    </Link>

                    {hasChildren ? (
                      <button
                        type="button"
                        className="nav-toggle"
                        aria-label={`展开 ${item.label} 二级菜单`}
                        aria-expanded={isOpen}
                        onClick={() => {
                          setOpenMenu((current) => (current === item.key ? null : item.key));
                        }}
                      >
                        <span className="nav-toggle__icon" />
                      </button>
                    ) : null}
                  </div>

                  {hasChildren ? (
                    item.variant === "mega" ? (
                      <div className="nav-submenu nav-submenu--mega">
                        {item.children?.map((child) => (
                          <div
                            key={child.href}
                            className={`nav-mega-row${child.topics?.length ? " nav-mega-row--has-panel" : ""}`}
                          >
                            <Link href={child.href} className="nav-submenu__link nav-mega-row__link">
                              <strong>{child.label}</strong>
                              {child.topics?.length ? (
                                <span className="nav-mega-arrow" aria-hidden="true">›</span>
                              ) : null}
                            </Link>
                            {child.topics?.length ? (
                              <div className="nav-mega-panel">
                                <p className="nav-mega-panel__head">{child.label}</p>
                                <div className="nav-mega-panel__topics">
                                  {child.topics.map((t) => (
                                    <Link key={t.href} href={t.href} className="nav-mega-topic">
                                      {t.label}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`nav-submenu${item.variant === "cards" ? " nav-submenu--cards" : ""}`}>
                        {item.children?.map((child) => (
                          <Link
                            className={`nav-submenu__link${item.variant === "cards" ? " nav-submenu__link--card" : ""}`}
                            href={child.href}
                            key={child.href}
                          >
                            <strong>{child.label}</strong>
                            {item.variant === "cards" && child.meta?.length ? (
                              <div className="nav-submenu__meta">
                                {child.meta.map((metaItem) => (
                                  <span key={metaItem}>{metaItem}</span>
                                ))}
                              </div>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}

            <Link href="/search?q=" className="nav-link nav-link--search" aria-label="搜索" title="搜索">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M13.5 13.5L18 18M15 8.75a6.25 6.25 0 1 1-12.5 0a6.25 6.25 0 0 1 12.5 0Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </Link>
          </nav>

          <div className="header-search">
            <Link href="/search?q=" className="header-search-btn header-search-btn--mobile" aria-label="搜索资料">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M13.5 13.5L18 18M15 8.75a6.25 6.25 0 1 1-12.5 0a6.25 6.25 0 0 1 12.5 0Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <span>搜索</span>
            </Link>
            <button
              type="button"
              className={`mobile-nav-btn${mobileNavOpen ? " mobile-nav-btn--active" : ""}`}
              aria-label="切换导航菜单"
              aria-expanded={mobileNavOpen}
              onClick={() => {
                setMobileNavOpen((current) => !current);
                setOpenMenu(null);
              }}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>夸克网盘资料 · 搜索驱动更新</p>
          <div className="site-footer__links">
            <Link href="/privacy">隐私</Link>
            <Link href="/terms">使用条款</Link>
            <Link href="/about">关于</Link>
            <Link href="/contact">联系我们</Link>
            <Link href="/sitemap.xml">Sitemap</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
