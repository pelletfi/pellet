import type { Metadata } from "next";
import { CommandBar } from "@/components/wallet/CommandBar";
import { LiquidGlass } from "@/components/wallet/LiquidGlass";
import { SpecimenShell } from "@/components/specimen/SpecimenShell";
import "./wallet-theme.css";
import "../specimen/specimen.css";

const OG_DESCRIPTION =
  "Agent wallet on Tempo. Manage finances, approve spends, and monitor activity for your AI agents.";

export const metadata: Metadata = {
  title: {
    default: "Pellet — Agent Wallet on Tempo",
    template: "%s — Pellet",
  },
  description: OG_DESCRIPTION,
  metadataBase: new URL("https://pellet.network"),
  openGraph: {
    title: "Pellet — Agent Wallet on Tempo",
    description: OG_DESCRIPTION,
    url: "https://pellet.network",
    siteName: "Pellet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@pelletnetwork",
    creator: "@pelletnetwork",
    title: "Pellet — Agent Wallet on Tempo",
    description: OG_DESCRIPTION,
  },
};

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wallet-shader-wrap">
      <LiquidGlass className="wallet-shader-canvas" />
      <SpecimenShell>
        {children}
        <CommandBar />
      </SpecimenShell>
    </div>
  );
}
