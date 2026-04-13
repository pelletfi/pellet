import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pellet",
  description: "intelligence for Tempo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{
          background: "#0f0f11",
          color: "#e8e8e8",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
