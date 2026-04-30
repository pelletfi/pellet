"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Bot,
  Route,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { PelletMark } from "@/components/pellet-mark";

type NavItem = { label: string; href: string; icon: LucideIcon };
type Section = { label: string; items: NavItem[] };

const sections: Section[] = [
  {
    label: "Explore",
    items: [
      { label: "Dashboard", href: "/oli", icon: LayoutDashboard },
      { label: "Services", href: "/oli/services", icon: Server },
      { label: "Agents", href: "/oli/agents", icon: Bot },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Rails", href: "/oli/rails", icon: Route },
      { label: "Skills", href: "/oli/skills", icon: BookOpen },
      { label: "Methodology", href: "/oli/methodology", icon: FileText },
    ],
  },
];

const STORAGE_KEY = "pellet-oli-sidebar-collapsed";

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
        padding: collapsed ? "20px 8px" : "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        // No transition until after hydration so the collapsed snapshot from
        // localStorage doesn't animate in on every fresh page load.
        transition: hydrated ? "width var(--duration-normal) ease, padding var(--duration-normal) ease" : "none",
      }}
      className={`oli-sidebar ${collapsed ? "oli-sidebar-collapsed" : ""}`}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        style={{
          // Collapsed: stack the logo and toggle vertically so neither has to
          // shrink to fit a 56px-wide rail. Expanded: side-by-side row.
          display: "flex",
          flexDirection: collapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: collapsed ? 14 : 8,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
            flexShrink: 0,
          }}
          aria-label="Pellet — back to home"
        >
          <PelletMark size={24} />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="oli-sidebar-toggle"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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
                  <Icon size={16} strokeWidth={1.75} />
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
