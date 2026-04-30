import { Sidebar } from "@/components/oli/Sidebar";
import { CommandBar } from "@/components/oli/CommandBar";
import type { Metadata } from "next";

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

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="oli-layout-shell" style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg-base)" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <CommandBar />
    </div>
  );
}
