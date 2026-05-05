import type { Metadata } from "next";
import { CommandBar } from "@/components/oli/CommandBar";
import { LiquidGlass } from "@/components/oli/LiquidGlass";
import { SpecimenShell } from "@/components/specimen/SpecimenShell";
import "./oli-theme.css";
import "../specimen/specimen.css";

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
    <div className="oli-shader-wrap">
      <LiquidGlass className="oli-shader-canvas" />
      <SpecimenShell>
        {children}
        <CommandBar />
      </SpecimenShell>
    </div>
  );
}
