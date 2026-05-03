"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PelletMark } from "@/components/pellet-mark";

const navLinks = [
  { label: "OLI", href: "/oli" },
  { label: "Wallet", href: "/wallet", title: "Pellet Wallet coming soon", soon: true },
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
  if (pathname === "/") return null;
  return <NavContent />;
}

function NavContent() {
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

  return (
    <header className="nav-header">
      <div className="nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Logo />
          <nav className="nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${link.soon ? " nav-link-soon" : ""}`}
                title={link.title}
              >
                <span className="nav-link-label">{link.label}</span>
                {link.soon ? <span className="nav-link-soon-label">soon</span> : null}
              </Link>
            ))}
          </nav>
        </div>

        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/status"
            className="nav-status"
            aria-label="System status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              textDecoration: "none",
            }}
          >
            <span
              className="status-dot"
              style={systemStatus === "drift" || systemStatus === "fail" ? { background: "var(--color-warning)" } : undefined}
            />
            <span className="nav-status-text">
              {systemStatus === "ok" || systemStatus === "unknown" ? "operational" : systemStatus === "drift" ? "drift" : "incident"}
            </span>
          </Link>
        </div>

        <button className="nav-mobile-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
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

        {open ? (
          <nav className="nav-mobile-menu">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                title={link.title}
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
                {link.soon ? `${link.label} soon` : link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export default Nav;
