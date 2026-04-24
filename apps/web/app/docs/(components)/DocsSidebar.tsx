"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { docsNav } from "@/lib/docs/nav";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="docs-sidebar" aria-label="Documentation">
      {docsNav.map((section) => (
        <div key={section.title} className="docs-sidebar-section">
          <div className="docs-sidebar-heading">{section.title}</div>
          {section.children?.map((item) => {
            if (item.soon || !item.href) {
              return (
                <span
                  key={item.title}
                  className="docs-sidebar-link soon"
                  aria-disabled="true"
                  title="Coming soon"
                >
                  {item.title}
                  <span className="soon-chip">Soon</span>
                </span>
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.title}
                href={item.href}
                className={`docs-sidebar-link${active ? " active" : ""}`}
              >
                {item.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
