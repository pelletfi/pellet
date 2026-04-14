import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pellet — Stablecoin Intelligence on Tempo",
  description:
    "The first payments chain deserves its own stablecoin intelligence. Every peg, every policy, every flow — tracked natively on Tempo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootProvider theme={{ enabled: true, defaultTheme: "dark" }}>
          <Nav />
          <main>{children}</main>
          <Footer />
        </RootProvider>
      </body>
    </html>
  );
}
