import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Nav } from "@/components/Nav";
import { FooterGate } from "@/components/FooterGate";

export const metadata: Metadata = {
  metadataBase: new URL("https://pellet.network"),
  title: "Pellet — Open-Ledger Interface on Tempo",
  description:
    "Open-Ledger Interface on Tempo. Every peg, every policy, every flow — tracked natively across the public ledger and the mainnet/zone boundary.",
  openGraph: {
    title: "Pellet — Open-Ledger Interface on Tempo",
    description:
      "The canonical interface for autonomous agent activity on Tempo. MPP-native API + MCP server.",
    url: "https://pellet.network",
    siteName: "Pellet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pellet — Open-Ledger Interface on Tempo",
    description:
      "The canonical interface for autonomous agent activity on Tempo. MPP-native API + MCP server.",
    site: "@pelletnetwork",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootProvider theme={{ enabled: true, defaultTheme: "dark", forcedTheme: "dark" }}>
          <Nav />
          <main>{children}</main>
          <FooterGate />
        </RootProvider>
      </body>
    </html>
  );
}
