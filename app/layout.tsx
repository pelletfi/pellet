import type { Metadata } from "next";
import "@fontsource/iosevka/400.css";
import "@fontsource/iosevka/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "pellet // agentics terminal",
  description: "spectator-mode for ai agents on solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
