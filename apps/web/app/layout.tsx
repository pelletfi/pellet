import type { Metadata } from "next";
import { Courier_Prime, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-courier-prime",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pellet — Agentic Infrastructure on Hyperliquid",
  description:
    "Three on-chain registries — Identity, Reputation, and Validation — forming the substrate for autonomous agents on HyperEVM. ERC-8004 compliant.",
  openGraph: {
    title: "Pellet — Agentic Infrastructure on Hyperliquid",
    description:
      "Three on-chain registries — Identity, Reputation, and Validation — forming the substrate for autonomous agents on HyperEVM.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pellet — Agentic Infrastructure on Hyperliquid",
    description:
      "Three on-chain registries — Identity, Reputation, and Validation — forming the substrate for autonomous agents on HyperEVM.",
    site: "@pelletinfra",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${courierPrime.variable} ${plexMono.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
