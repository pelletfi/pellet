import Link from "next/link";

const productLinks = [
  { label: "Explorer", href: "/explorer" },
  { label: "Stables", href: "/stablecoins" },
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
        borderTop: "1px solid var(--color-border-subtle)",
        marginTop: 64,
      }}
    >
      <div className="footer-inner">
        {/* Left: brand + system info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Pellet Finance
          </span>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text-quaternary)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Built on
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tempo-logo-white.svg" alt="Tempo" style={{ height: 10, width: "auto", opacity: 0.4 }} />
            </span>
            <span>API v1 · 12 endpoints</span>
          </div>
        </div>

        {/* Right: three columns */}
        <div className="footer-columns">
          <FooterColumn title="Product" links={productLinks} />
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
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
          color: "var(--color-text-quaternary)",
        }}
      >
        {title}
      </span>
      {links.map((link) => {
        const isExternal = link.href.startsWith("http");
        const style = {
          fontSize: 13,
          color: "var(--color-text-tertiary)",
          textDecoration: "none" as const,
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
