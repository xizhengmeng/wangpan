import Link from "next/link";
import { useEffect, useMemo, useState, PropsWithChildren } from "react";
import { useRouter } from "next/router";

import { ContentStructure } from "@/lib/types";

interface NavChildItem {
  label: string;
  href: string;
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  children?: NavChildItem[];
}

export function Layout({ children }: PropsWithChildren) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [structure, setStructure] = useState<ContentStructure | null>(null);

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
        if (featuredDelta !== 0) {
          return featuredDelta;
        }

        return a.sort - b.sort;
      });

    const primaryChannels = activeChannels.slice(0, 5);
    const overflowChannels = activeChannels.slice(5);

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
        label: channel.name,
        href: `/channel/${channel.slug}`,
        children: categories
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
          href: `/channel/${channel.slug}`
        }))
      });
    }

    return items;
  }, [structure]);

  useEffect(() => {
    setOpenMenu(null);
  }, [router.asPath]);

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

          <nav className="nav" aria-label="主导航">
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
                    if (hasChildren) {
                      setOpenMenu(item.key);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasChildren) {
                      setOpenMenu((current) => (current === item.key ? null : current));
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
                    <div className="nav-submenu">
                      {item.children?.map((child) => (
                        <Link className="nav-submenu__link" href={child.href} key={child.href}>
                          <strong>{child.label}</strong>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="header-search">
            <Link href="/search?q=" className="header-search-btn">
              搜索
            </Link>
          </div>
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
