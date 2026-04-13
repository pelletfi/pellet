"use client";

import Link from "next/link";
/* eslint-disable @next/next/no-img-element */

const navLinks = [
  { label: "Tokens", href: "/tokens" },
  { label: "Stablecoins", href: "/stablecoins" },
  { label: "Services", href: "/services" },
  { label: "Terminal", href: "/terminal" },
  { label: "About", href: "/about" },
];

export function Nav() {
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
    </header>
  );
}

export default Nav;
