"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { label: "Tokens", href: "/tokens" },
  { label: "Stablecoins", href: "/stablecoins" },
  { label: "Services", href: "/services" },
  { label: "Terminal", href: "/terminal" },
  { label: "About", href: "/about" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="nav-header">
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          textDecoration: "none",
          color: "var(--color-text)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-pixel-line)",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          Pellet Finance
        </span>
      </Link>

      {/* Desktop nav */}
      <nav className="nav-links">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontSize: 14,
              color: "var(--color-secondary)",
              textDecoration: "none",
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Mobile hamburger */}
      <button
        className="nav-mobile-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
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

      {/* Mobile dropdown */}
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
                color: "var(--color-text)",
                textDecoration: "none",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export default Nav;
