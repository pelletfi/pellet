"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

/**
 * Suppresses the site-wide footer on /wallet and /specimen routes where each
 * surface renders its own shell + bottom keymap and the marketing footer
 * would visually clash.
 */
export function FooterGate() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  if (pathname === "/wallet") return null;
  if (pathname?.startsWith("/wallet")) return null;
  if (pathname?.startsWith("/webhooks")) return null;
  if (pathname?.startsWith("/skills")) return null;
  if (pathname?.startsWith("/mcp-docs")) return null;
  if (pathname?.startsWith("/cli")) return null;
  if (pathname?.startsWith("/methodology")) return null;
  if (pathname?.startsWith("/rails")) return null;
  if (pathname?.startsWith("/specimen")) return null;
  return <Footer />;
}
