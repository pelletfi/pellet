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
  title: "Pellet — Agent Wallet on Tempo",
  description:
    "The wallet that connects to your AI. Manage agent finances, approve spends, and monitor activity — all on Tempo.",
  openGraph: {
    title: "Pellet — Agent Wallet on Tempo",
    description:
      "The wallet that connects to your AI. Manage agent finances, approve spends, and monitor activity — all on Tempo.",
    url: "https://pellet.network",
    siteName: "Pellet",
    type: "website",
    images: [{ url: "/og.png", width: 2400, height: 1260 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pellet — Agent Wallet on Tempo",
    description:
      "The wallet that connects to your AI. Manage agent finances, approve spends, and monitor activity — all on Tempo.",
    site: "@pelletnetwork",
    images: ["/og.png"],
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
        <RootProvider
          theme={{ enabled: false }}
          // Disable the global fumadocs search at the root. /oli wraps its
          // own SearchProvider that routes ⌘K + the visible trigger into
          // CommandBar; /docs doesn't have a wired search backend yet so
          // the bar was non-functional anyway. With this off, only one
          // SearchProvider is active at a time and ⌘K opens a single
          // dialog instead of stacking.
          search={{ enabled: false }}
        >
          <Nav />
          <main>{children}</main>
          <FooterGate />
        </RootProvider>
      </body>
    </html>
  );
}
