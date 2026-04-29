"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PelletMark } from "@/components/pellet-mark";

const sections = [
  {
    label: "Explore",
    items: [
      { label: "Dashboard", href: "/oli" },
      { label: "Services",  href: "/oli/services" },
      { label: "Agents",    href: "/oli/agents" },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Rails",       href: "/oli/rails" },
      { label: "Methodology", href: "/oli/methodology" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      style={{
        width: 240,
        borderRight: "1px solid var(--color-border-subtle)",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--color-bg-base)",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
      className="oli-sidebar"
    >
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
        aria-label="Pellet — back to home"
      >
        <PelletMark size={24} />
      </Link>

      {sections.map((section) => (
        <nav key={section.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
          {section.items.map((item) => {
            const active = item.href === "/oli"
              ? pathname === "/oli"
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`oli-nav-link${active ? " oli-nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}
