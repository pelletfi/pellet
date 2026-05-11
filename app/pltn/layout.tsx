import "./pltn-theme.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "$PLTN — Pellet",
  description:
    "An open wallet for the agentic web. $PLTN is Pellet's official token on Tempo. 100M fixed supply, admin burned at deploy, LP locked permanently.",
  openGraph: {
    title: "$PLTN — Pellet",
    description: "An open wallet for the agentic web.",
    url: "https://pellet.network/pltn",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$PLTN — Pellet",
    description: "An open wallet for the agentic web.",
    site: "@pelletnetwork",
  },
};

export default function PLTNLayout({ children }: { children: React.ReactNode }) {
  return <div className="pltn-page">{children}</div>;
}
