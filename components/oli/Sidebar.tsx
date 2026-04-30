"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconServer,
  IconRobot,
  IconRoute,
  IconBook,
  IconFileText,
  IconWebhook,
  IconWallet,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  type Icon as TablerIconType,
} from "@tabler/icons-react";

type NavItem = { label: string; href: string; icon: TablerIconType };
type Section = { label: string; items: NavItem[] };

const sections: Section[] = [
  {
    label: "Explore",
    items: [
      { label: "Dashboard", href: "/oli", icon: IconLayoutDashboard },
      { label: "Services", href: "/oli/services", icon: IconServer },
      { label: "Agents", href: "/oli/agents", icon: IconRobot },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Rails", href: "/oli/rails", icon: IconRoute },
      { label: "Skills", href: "/oli/skills", icon: IconBook },
      { label: "Methodology", href: "/oli/methodology", icon: IconFileText },
    ],
  },
  {
    label: "Wallet",
    items: [
      { label: "Webhooks", href: "/oli/webhooks", icon: IconWebhook },
      { label: "Pellet Wallet", href: "/oli/wallet", icon: IconWallet },
    ],
  },
];

const STORAGE_KEY = "pellet-oli-sidebar-collapsed";
const ICON_PROPS = { size: 18, stroke: 1.5 } as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted preference on mount. SSR renders expanded by default; the
  // mount-time read snaps to the user's last choice without a flash because
  // we only paint the collapsed state once `hydrated` is true.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* localStorage unavailable; stay expanded */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const width = collapsed ? 56 : 240;

  return (
    <aside
      style={{
        width,
        borderRight: "1px solid var(--color-border-subtle)",
        height: "calc(100vh - 48px)",
        position: "sticky",
        top: 48,
        background: "var(--color-bg-base)",
        padding: collapsed ? "12px 8px" : "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        // No transition until after hydration so the collapsed snapshot from
        // localStorage doesn't animate in on every fresh page load.
        transition: hydrated ? "width var(--duration-normal) ease, padding var(--duration-normal) ease" : "none",
      }}
      className={`oli-sidebar ${collapsed ? "oli-sidebar-collapsed" : ""}`}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-end",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="oli-sidebar-toggle"
        >
          {collapsed ? (
            <IconLayoutSidebarLeftExpand {...ICON_PROPS} />
          ) : (
            <IconLayoutSidebarLeftCollapse {...ICON_PROPS} />
          )}
        </button>
      </div>

      {sections.map((section) => (
        <nav key={section.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {!collapsed && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-text-quaternary)",
                padding: "0 8px",
                marginBottom: 6,
              }}
            >
              {section.label}
            </span>
          )}
          {section.items.map((item) => {
            const active =
              item.href === "/oli" ? pathname === "/oli" : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`oli-nav-link${active ? " oli-nav-link-active" : ""}`}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
              >
                <span className="oli-nav-link-icon" aria-hidden>
                  <Icon {...ICON_PROPS} />
                </span>
                {!collapsed && <span className="oli-nav-link-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}
