"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PelletMark } from "@/components/pellet-mark";

// v0 nav: trimmed to the routes that actually exist post-pivot. Agents + Docs
// confirmed by the user as keepers; pricing/studies/swap/explorer/fee-economics
// were stablecoin-OLI-era surfaces and are deferred until they get rebuilt.
const navLinks = [
  { label: "Agents", href: "/agents" },
  { label: "Docs", href: "/docs" },
];

function Logo() {
  return (
    <Link
      href="/"
      style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
      aria-label="Pellet"
    >
      <PelletMark size={28} />
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<"ok" | "drift" | "fail" | "unknown">("unknown");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((r) => r.json().then((d) => ({ httpOk: r.ok, body: d })))
      .then(({ body }) => {
        if (body?.status === "ok" || body?.status === "drift" || body?.status === "fail") {
          setSystemStatus(body.status);
        }
      })
      .catch(() => {});
  }, []);

  // OLI routes can render their own shell; suppress the site nav there.
  if (pathname?.startsWith("/oli")) return null;

  return (
    <header className="nav-header">
      <div className="nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Logo />
          <nav className="nav-links">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            className="nav-status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
            }}
          >
            <span
              className="status-dot"
              style={systemStatus === "drift" || systemStatus === "fail" ? { background: "var(--color-warning)" } : undefined}
            />
            <span className="nav-status-text">
              {systemStatus === "ok" || systemStatus === "unknown" ? "operational" : systemStatus === "drift" ? "drift" : "incident"}
            </span>
          </span>
        </div>

        <button className="nav-mobile-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            {open ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </>
            )}
          </svg>
        </button>

        {open && (
          <nav className="nav-mobile-menu">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "12px 0",
                  fontSize: 15,
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export default Nav;
