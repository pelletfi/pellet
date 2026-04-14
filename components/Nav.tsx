"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const navLinks = [
  { label: "Explorer", href: "/explorer" },
  { label: "Fee economics", href: "/fee-economics" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [block, setBlock] = useState<string | null>(null);

  const [systemStatus, setSystemStatus] = useState<"ok" | "drift" | "fail" | "unknown">("unknown");
  useEffect(() => {
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.block) setBlock(Number(d.block).toLocaleString());
      })
      .catch(() => {});
    // Pellet ingestion health (separate from chain health)
    fetch("/api/v1/system/health")
      .then((r) => r.json().then((d) => ({ httpOk: r.ok, body: d })))
      .then(({ body }) => {
        if (body?.status === "ok" || body?.status === "drift" || body?.status === "fail") {
          setSystemStatus(body.status);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="nav-header">
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link
          href="/"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            textDecoration: "none",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Pellet Finance
        </Link>
        <nav className="nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/status" className="nav-status" style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", textDecoration: "none" }}>
          <span className="status-dot" style={systemStatus === "drift" || systemStatus === "fail" ? { background: "var(--color-warning)" } : undefined} />
          <span className="nav-status-text">
            {systemStatus === "ok" || systemStatus === "unknown" ? "operational" : systemStatus === "drift" ? "drift" : "incident"}
          </span>
        </Link>
        {block && (
          <>
            <span className="nav-block-sep" style={{ width: 1, height: 16, background: "var(--color-border-default)" }} />
            <span className="nav-block" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
              blk {block}
            </span>
          </>
        )}
        <span className="nav-kbd-sep" style={{ width: 1, height: 16, background: "var(--color-border-default)" }} />
        <span className="nav-kbd-badge" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 20, height: 20, padding: "0 5px",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
          color: "var(--color-text-quaternary)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 4,
        }}>
          ⌘K
        </span>
      </div>

      <button className="nav-mobile-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          {open ? (
            <><line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" /></>
          ) : (
            <><line x1="3" y1="5" x2="17" y2="5" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="15" x2="17" y2="15" /></>
          )}
        </svg>
      </button>

      {open && (
        <nav className="nav-mobile-menu">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
              style={{ display: "block", padding: "12px 0", fontSize: 15, color: "var(--color-text-primary)", textDecoration: "none", borderBottom: "1px solid var(--color-border-subtle)" }}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export default Nav;
