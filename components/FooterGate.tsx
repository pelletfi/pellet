"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

/**
 * Suppresses the site-wide footer on /oli and /specimen routes where each
 * surface renders its own shell + bottom keymap and the marketing footer
 * would visually clash.
 */
export function FooterGate() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  if (pathname?.startsWith("/oli")) return null;
  if (pathname?.startsWith("/specimen")) return null;
  return <Footer />;
}
