import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  Wallet,
  Terminal,
  Bot,
  Telescope,
  ServerCog,
  Users,
  Route,
  Sparkles,
  BookText,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { OliSearchProvider } from "@/components/oli/CommandBarSearchProvider";
import type { Metadata } from "next";
import type * as PageTree from "fumadocs-core/page-tree";

const OG_DESCRIPTION =
  "Decoded autonomous economic activity on Tempo. Per-event provenance, per-service revenue, per-provider attribution recovered on-chain.";

export const metadata: Metadata = {
  title: {
    default: "Pellet OLI — Open-Ledger Interface for Tempo",
    template: "%s — Pellet OLI",
  },
  description: OG_DESCRIPTION,
  metadataBase: new URL("https://pellet.network"),
  openGraph: {
    title: "Pellet OLI — Open-Ledger Interface for Tempo",
    description: OG_DESCRIPTION,
    url: "https://pellet.network/oli",
    siteName: "Pellet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@pelletnetwork",
    creator: "@pelletnetwork",
    title: "Pellet OLI — Open-Ledger Interface for Tempo",
    description: OG_DESCRIPTION,
  },
};

// Hand-built page tree for the fumadocs DocsLayout sidebar. Renders inside
// the same shell as /docs. Icons are lucide-react and explicitly match the
// docs frontmatter (Wallet, Terminal, Bot, Telescope, Sparkles, BookText)
// so an item in this sidebar that also exists in the docs sidebar carries
// the exact same glyph there.
//
// Pellet Wallet sits at the top of the tree as a cross-product link —
// surfaces the wallet to anyone landing on OLI without forcing them up to
// the site Nav.

const tree: PageTree.Root = {
  name: "OLI",
  children: [
    {
      type: "page",
      name: "Back to home",
      url: "/",
      icon: <ArrowLeft />,
    },
    { type: "separator", name: "Explore" },
    {
      type: "page",
      name: "Dashboard",
      url: "/oli",
      icon: <Telescope />,
    },
    {
      type: "page",
      name: "Services",
      url: "/oli/services",
      icon: <ServerCog />,
    },
    {
      type: "page",
      name: "Agents",
      url: "/oli/agents",
      icon: <Users />,
    },
    { type: "separator", name: "Wallet" },
    {
      type: "page",
      name: "Pellet Wallet",
      url: "/oli/wallet",
      icon: <Wallet />,
    },
    {
      type: "page",
      name: "CLI",
      url: "/oli/cli",
      icon: <Terminal />,
    },
    {
      type: "page",
      name: "MCP",
      url: "/oli/mcp",
      icon: <Bot />,
    },
    { type: "separator", name: "Reference" },
    {
      type: "page",
      name: "Rails",
      url: "/oli/rails",
      icon: <Route />,
    },
    {
      type: "page",
      name: "Skills",
      url: "/oli/skills",
      icon: <Sparkles />,
    },
    {
      type: "page",
      name: "Methodology",
      url: "/oli/methodology",
      icon: <BookText />,
    },
    { type: "separator", name: "Docs" },
    {
      type: "page",
      name: "Documentation",
      url: "/docs",
      icon: <BookOpen />,
    },
  ],
};

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <OliSearchProvider>
      <DocsLayout
        tree={tree}
        nav={{
          title: "Pellet Network",
          url: "/oli",
        }}
        searchToggle={{ enabled: true }}
        sidebar={{
          defaultOpenLevel: 1,
        }}
        containerProps={{ className: "oli-docs-shell" }}
      >
        <div className="oli-docs-main">{children}</div>
      </DocsLayout>
    </OliSearchProvider>
  );
}
