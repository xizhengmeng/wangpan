import Link from "next/link";
import { useEffect, useMemo, useRef, useState, PropsWithChildren } from "react";
import { useRouter } from "next/router";

import { ContentStructure } from "@/lib/types";

interface NavChildItem {
  label: string;
  href: string;
  meta?: string[];
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  children?: NavChildItem[];
  variant?: "links" | "cards";
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

    const preferredPrimarySlugs = [
      "education-exam",
      "skill-growth",
      "language-learning",
      "software-tools",
    ];
    const shortLabels: Record<string, string> = {
      "education-exam": "考试",
      "skill-growth": "技能",
      "language-learning": "语言",
      "software-tools": "工具",
    };

    const activeChannels = [...structure.channels]
      .filter((channel) => channel.status === "active")
      .sort((a, b) => {
        const preferredDelta =
          preferredPrimarySlugs.indexOf(a.slug) === -1
            ? 999
            : preferredPrimarySlugs.indexOf(a.slug);
        const preferredCompare =
          preferredPrimarySlugs.indexOf(b.slug) === -1
            ? 999
            : preferredPrimarySlugs.indexOf(b.slug);

        if (preferredDelta !== preferredCompare) {
          return preferredDelta - preferredCompare;
        }

        const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDelta !== 0) {
          return featuredDelta;
        }

        return a.sort - b.sort;
      });

    const primaryChannels = activeChannels.slice(0, 4);
    const overflowChannels = activeChannels.slice(4);

    const channelItems: NavItem[] = primaryChannels.map((channel) => {
      const categories = structure.categories
        .filter((category) => category.channel_id === channel.id && category.status === "active")
        .sort((a, b) => a.sort - b.sort)
        .slice(0, 6)
        .map((category) => ({
          label: category.name,
          href: `/category/${category.slug}`
        }));

      return {
        key: channel.id,
        label: shortLabels[channel.slug] || channel.name,
        href: `/channel/${channel.slug}`,
        children: categories,
        variant: "links",
      };
    });

    const items: NavItem[] = [{ key: "home", label: "首页", href: "/" }, ...channelItems];

    if (overflowChannels.length > 0) {
      items.push({
        key: "more",
        label: "更多",
        href: "/search?q=",
        children: overflowChannels.map((channel) => ({
          label: channel.name,
          href: `/channel/${channel.slug}`,
          meta: structure.categories
            .filter((category) => category.channel_id === channel.id && category.status === "active")
            .sort((a, b) => a.sort - b.sort)
            .slice(0, 3)
            .map((category) => category.name),
        })),
        variant: "cards",
      });
    }

    return items;
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

    if (router.asPath === item.href) {
      return true;
    }

    return item.children?.some((child) => router.asPath === child.href) || false;
  }

  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/">
            <span className="brand-icon">夸</span>
            <strong>夸克资料站</strong>
          </Link>

          <div className="header-search">
            <Link href="/search?q=" className="header-search-btn">
              搜索
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
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>夸克资料站 · 搜索驱动更新</p>
          <p>
            <Link href="/sitemap.xml">Sitemap</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
