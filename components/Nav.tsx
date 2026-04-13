import Link from "next/link";
import { PixelIcon } from "./PixelIcon";

const navLinks = [
  { label: "Tokens", href: "/tokens" },
  { label: "Stablecoins", href: "/stablecoins" },
  { label: "Services", href: "/services" },
  { label: "Terminal", href: "/terminal" },
  { label: "About", href: "/about" },
];

export function Nav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "var(--color-bg)",
        borderBottom: "1px solid var(--color-border)",
        padding: "16px 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "var(--color-text)",
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        <PixelIcon size={24} />
        Pellet
      </Link>

      <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
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
