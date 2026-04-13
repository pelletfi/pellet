import Link from "next/link";
import Image from "next/image";
import { PixelIcon } from "./PixelIcon";

const productLinks = [
  { label: "Tokens", href: "/tokens" },
  { label: "Stablecoins", href: "/stablecoins" },
  { label: "Services", href: "/services" },
  { label: "Terminal", href: "/terminal" },
];

const resourceLinks = [
  { label: "About", href: "/about" },
  { label: "API", href: "/api" },
  { label: "MCP Server", href: "https://www.npmjs.com/package/@pelletfi/mcp" },
];

const socialLinks = [
  { label: "GitHub", href: "https://github.com/pelletfi" },
  { label: "X", href: "https://x.com/pelletfinance" },
  { label: "Farcaster", href: "https://warpcast.com/pellet" },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        marginTop: 96,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 48,
        }}
      >
        {/* Left: brand + built on */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--color-text)",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            <span style={{ fontFamily: "var(--font-geist-pixel-line)", fontSize: 13, fontWeight: 600, lineHeight: 1 }}>Pellet Finance</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--color-secondary)",
            }}
          >
            Built on
            <Image
              src="/tempo-logo.svg"
              alt="Tempo"
              width={60}
              height={14}
              style={{ opacity: 0.7 }}
            />
          </div>
        </div>

        {/* Right: three columns */}
        <div style={{ display: "flex", gap: 64 }}>
          <FooterColumn title="Product" links={productLinks} internal />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Social" links={socialLinks} />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  internal,
}: {
  title: string;
  links: { label: string; href: string }[];
  internal?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="label">{title}</span>
      {links.map((link) => {
        const isExternal = link.href.startsWith("http");
        const style = {
          fontSize: 13,
          color: "var(--color-secondary)",
          textDecoration: "none",
        };

        if (isExternal) {
          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={style}
            >
              {link.label}
            </a>
          );
        }

        return (
          <Link key={link.href} href={link.href} style={style}>
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

export default Footer;
