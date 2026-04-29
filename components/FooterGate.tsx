"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

/**
 * Suppresses the site-wide footer on /oli routes where the OLI Console
 * preview renders its own shell.
 */
export function FooterGate() {
  const pathname = usePathname();
  if (pathname?.startsWith("/oli")) return null;
  return <Footer />;
}
