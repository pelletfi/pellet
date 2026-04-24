import type { Metadata } from "next";

import { SiteHeader } from "../(components)/SiteHeader";
import { DocsSidebar } from "./(components)/DocsSidebar";
import { DocsFooter } from "./(components)/DocsFooter";

export const metadata: Metadata = {
  title: {
    default: "Docs — Pellet",
    template: "%s — Pellet Docs",
  },
  description:
    "Technical documentation for Pellet — agentic infrastructure on Hyperliquid. ERC-8004 registries for identity, reputation, and validation.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page docs-page">
      <SiteHeader />
      <div className="docs-shell">
        <aside className="docs-aside">
          <DocsSidebar />
        </aside>
        <main className="docs-main">
          <article className="docs-prose">{children}</article>
          <DocsFooter />
        </main>
      </div>
    </div>
  );
}
