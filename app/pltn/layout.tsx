import "./pltn-theme.css";
import type { Metadata, Viewport } from "next";

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

// Override the root layout's themeColor "#0a0a0a" so iOS Safari treats /pltn
// as a light page (status bar, system color shifts on SVG/text inherit).
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function PLTNLayout({ children }: { children: React.ReactNode }) {
  return <div className="pltn-page">{children}</div>;
}
