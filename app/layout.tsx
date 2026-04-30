import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Nav } from "@/components/Nav";
import { FooterGate } from "@/components/FooterGate";

// CommitMono — replacing Geist Mono for terminal-flavored type. Geist Mono
// stays imported above as a fallback for any surface that's still
// referencing var(--font-geist-mono) directly until we sweep them.
const commitMono = localFont({
  src: [
    { path: "../public/fonts/CommitMono-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/CommitMono-Italic.otf",  weight: "400", style: "italic" },
    { path: "../public/fonts/CommitMono-Bold.otf",    weight: "700", style: "normal" },
  ],
  variable: "--font-commit-mono",
  display: "swap",
});

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
      className={`${GeistSans.variable} ${GeistMono.variable} ${commitMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
          theme.enabled = false skips the no-flash theme-init <script> that
          next-themes (under fumadocs-ui's RootProvider) injects. We don't need
          it since dark mode is hardcoded via the `dark` class on <html> +
          forced color-scheme in globals.css. The provider is still needed for
          fumadocs-ui's other context (framework, sidebar, search), so we keep
          RootProvider but turn its theme switch off.
        */}
        <RootProvider theme={{ enabled: false }}>
          <Nav />
          <main>{children}</main>
          <FooterGate />
        </RootProvider>
      </body>
    </html>
  );
}
