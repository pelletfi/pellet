"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "DASHBOARD", href: "/dashboard" },
  { label: "CONNECT", href: "/onboard" },
  { label: "CHAT", href: "/chat" },
  { label: "AGENTS", href: "/dashboard/agents" },
  { label: "SETTINGS", href: "/dashboard/settings" },
] as const;

function isActive(pathname: string, tabHref: string, basePath: string): boolean {
  const full = basePath + tabHref;
  if (tabHref === "/dashboard") {
    return pathname === full || pathname === basePath || pathname === basePath + "/";
  }
  return pathname === full || pathname.startsWith(full + "/");
}

export function WalletTabs({ basePath = "/oli/wallet" }: { basePath?: string }) {
  const pathname = usePathname();

  return (
    <div className="spec-switch" role="group" aria-label="Wallet sections">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href, basePath);
        if (active) {
          return (
            <span
              key={tab.label}
              className="spec-switch-seg spec-switch-seg-active"
            >
              {tab.label}
            </span>
          );
        }
        return (
          <Link
            key={tab.label}
            className="spec-switch-seg"
            href={`${basePath}${tab.href}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
