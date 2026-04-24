"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { flattenDocsNav } from "@/lib/docs/nav";

export function DocsFooter() {
  const pathname = usePathname();
  const ordered = flattenDocsNav();
  const idx = ordered.findIndex((i) => i.href === pathname);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <footer className="docs-footer">
      <div className="docs-footer-prev">
        {prev && prev.href ? (
          <Link href={prev.href}>
            <span className="label">← Previous</span>
            <span className="title">{prev.title}</span>
          </Link>
        ) : null}
      </div>
      <div className="docs-footer-next">
        {next && next.href ? (
          <Link href={next.href}>
            <span className="label">Next →</span>
            <span className="title">{next.title}</span>
          </Link>
        ) : null}
      </div>
    </footer>
  );
}
