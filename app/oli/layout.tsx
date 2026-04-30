import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  IconWallet,
  IconTerminal2,
  IconPlugConnected,
  IconLayoutDashboard,
  IconServer,
  IconRobot,
  IconRoute,
  IconBook,
  IconFileText,
} from "@tabler/icons-react";
import { CommandBar } from "@/components/oli/CommandBar";
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

// Hand-built page tree for the fumadocs DocsLayout sidebar. Mirrors the
// previous custom Sidebar but renders inside fumadocs's polished shell —
// same aesthetic as /docs. Pellet Wallet sits at the top of the tree as a
// cross-product link (Jake's call: easy access for visitors landing on OLI
// who want to peek at the wallet, even though it's also in the site Nav).
const ICON_PROPS = { size: 16, stroke: 1.75 } as const;

const tree: PageTree.Root = {
  name: "OLI",
  children: [
    { type: "separator", name: "Wallet" },
    {
      type: "page",
      name: "Pellet Wallet",
      url: "/wallet",
      icon: <IconWallet {...ICON_PROPS} />,
    },
    {
      type: "page",
      name: "CLI",
      url: "/docs/wallet-cli",
      icon: <IconTerminal2 {...ICON_PROPS} />,
    },
    {
      type: "page",
      name: "MCP",
      url: "/docs/wallet-mcp",
      icon: <IconPlugConnected {...ICON_PROPS} />,
    },
    { type: "separator", name: "Explore" },
    {
      type: "page",
      name: "Dashboard",
      url: "/oli",
      icon: <IconLayoutDashboard {...ICON_PROPS} />,
    },
    {
      type: "page",
      name: "Services",
      url: "/oli/services",
      icon: <IconServer {...ICON_PROPS} />,
    },
    {
      type: "page",
      name: "Agents",
      url: "/oli/agents",
      icon: <IconRobot {...ICON_PROPS} />,
    },
    { type: "separator", name: "Reference" },
    {
      type: "page",
      name: "Rails",
      url: "/oli/rails",
      icon: <IconRoute {...ICON_PROPS} />,
    },
    {
      type: "page",
      name: "Skills",
      url: "/oli/skills",
      icon: <IconBook {...ICON_PROPS} />,
    },
    {
      type: "page",
      name: "Methodology",
      url: "/oli/methodology",
      icon: <IconFileText {...ICON_PROPS} />,
    },
  ],
};

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={tree}
      // Site Nav (Wallet · OLI · Docs) renders globally above this — disable
      // the fumadocs nav so we don't get two stacked top bars. The sidebar
      // does its own heading via the title we set on its first separator.
      nav={{ enabled: false }}
      // OLI has its own CommandBar (⌘K) for action search; turn off the
      // fumadocs search trigger to avoid duplicate UI.
      searchToggle={{ enabled: false }}
      sidebar={{
        defaultOpenLevel: 1,
      }}
    >
      {children}
      <CommandBar />
    </DocsLayout>
  );
}
