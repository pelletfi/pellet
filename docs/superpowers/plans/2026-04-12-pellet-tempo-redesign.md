# Pellet on Tempo — Visual Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete visual rebuild of pelletfi.com — dark crypto dashboard → light, mpp.dev-clean analytical layer with pixel art identity. Frontend only; all API routes unchanged.

**Architecture:** Replace globals.css theme + all inline styles across pages/components. Switch from Geist to Inter + JetBrains Mono. New pages: `/tokens` (moved from `/`), `/services`, `/terminal`, `/about`. Homepage becomes builder's statement with semi-live terminal.

**Tech Stack:** Next.js 16, Tailwind CSS 4, Inter + JetBrains Mono (Google Fonts), React 19, existing API routes

---

## File Map

### New Files
- `app/globals.css` — complete rewrite (light theme, new CSS vars, new fonts)
- `app/page.tsx` — complete rewrite (homepage with hero + terminal)
- `app/tokens/page.tsx` — new (token list, moved from old `/`)
- `app/services/page.tsx` — new (MPP services directory)
- `app/terminal/page.tsx` — new (interactive terminal)
- `app/about/page.tsx` — new (thesis/editorial)
- `components/Nav.tsx` — complete rewrite
- `components/Footer.tsx` — new
- `components/PixelIcon.tsx` — new (pixel pellet logo SVG)
- `components/Terminal.tsx` — new (shared terminal renderer, used in hero + `/terminal`)
- `components/StatsBar.tsx` — new (chain vitals strip)
- `public/tempo-logo.svg` — new (Tempo wordmark)

### Modified Files
- `app/layout.tsx` — new fonts (Inter + JetBrains Mono), remove Geist, light theme body
- `app/token/[address]/page.tsx` — restyle to light theme
- `app/token/[address]/briefing/page.tsx` — restyle to light theme
- `app/stablecoins/page.tsx` — restyle to light theme
- `app/stablecoins/flows/page.tsx` — restyle to light theme
- `app/stablecoins/[address]/page.tsx` — restyle to light theme
- `components/TokenCard.tsx` — restyle to light theme, add token icon
- `components/Search.tsx` — restyle to light theme
- `components/SafetyBadge.tsx` — restyle to light theme
- `components/StablecoinRow.tsx` — restyle to light theme
- `components/BriefingDocument.tsx` — restyle to light theme

### Unchanged
- All `app/api/` routes — no changes
- All `lib/` files — no changes
- `next.config.ts` — no changes (already has CoinGecko image domains)
- `package.json` — no dependency changes (fonts loaded via Google Fonts)

---

### Task 1: Design System — globals.css + layout.tsx + fonts

**Files:**
- Rewrite: `app/globals.css`
- Modify: `app/layout.tsx`

This task establishes the entire visual foundation. Every subsequent task depends on these CSS variables and font setup.

- [ ] **Step 1: Rewrite globals.css with light theme**

Replace the entire contents of `app/globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --font-inter: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-bg: #ffffff;
  --color-surface: #fafafa;
  --color-text: #0a0a0a;
  --color-secondary: #555555;
  --color-muted: #aaaaaa;
  --color-border: #eeeeee;
  --color-positive: #16a34a;
  --color-negative: #dc2626;
  --color-terminal: #0a0a0a;
  --color-terminal-text: #cccccc;
  --color-terminal-muted: #555555;
  --color-terminal-green: #4ade80;
  --color-terminal-yellow: #fbbf24;
}

body {
  font-family: var(--font-inter);
  background-color: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Typography utilities */
.font-mono {
  font-family: var(--font-mono);
}

.label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--color-muted);
}

/* Pixel strip decorative element */
.pixel-strip {
  display: flex;
  gap: 3px;
}
.pixel-strip .px {
  width: 8px;
  height: 8px;
  image-rendering: pixelated;
}
```

- [ ] **Step 2: Update layout.tsx — swap fonts, light theme**

Replace `app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pellet — The Intelligence Layer for Tempo",
  description:
    "Every token examined, every stablecoin tracked, every payment service mapped. Built natively for the first payments chain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify dev server starts with new theme**

Run: `cd /Users/jake/pellet && npm run dev`

Expected: App loads with white background, Inter font. Pages will look broken (old inline styles on white bg) — that's expected. Confirm no build errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: light theme design system — Inter + JetBrains Mono, new CSS vars"
```

---

### Task 2: PixelIcon + Nav + Footer

**Files:**
- Create: `components/PixelIcon.tsx`
- Rewrite: `components/Nav.tsx`
- Create: `components/Footer.tsx`
- Create: `public/tempo-logo.svg`

- [ ] **Step 1: Create pixel pellet icon component**

Create `components/PixelIcon.tsx`:

```tsx
export function PixelIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="none"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="2" y="0" width="4" height="1" fill="#0a0a0a" />
      <rect x="1" y="1" width="6" height="1" fill="#333333" />
      <rect x="0" y="2" width="8" height="4" fill="#0a0a0a" />
      <rect x="2" y="3" width="1" height="1" fill="#ffffff" opacity="0.3" />
      <rect x="1" y="6" width="6" height="1" fill="#333333" />
      <rect x="2" y="7" width="4" height="1" fill="#0a0a0a" />
    </svg>
  );
}
```

- [ ] **Step 2: Download Tempo logo SVG**

Fetch the Tempo logo from tempo.xyz and save as `public/tempo-logo.svg`. If the SVG can't be extracted directly, create a clean text-based SVG of the Tempo wordmark (the italic "T" mark + "Tempo" text they use). The logo should work at small sizes (height ~20px) in both the nav badge and footer.

Check tempo.xyz source for an SVG asset first. If not available, create a minimal SVG that matches their branding.

- [ ] **Step 3: Rewrite Nav component**

Replace `components/Nav.tsx`:

```tsx
import Link from "next/link";
import { PixelIcon } from "./PixelIcon";

const links = [
  { href: "/tokens", label: "Tokens" },
  { href: "/stablecoins", label: "Stablecoins" },
  { href: "/services", label: "Services" },
  { href: "/terminal", label: "Terminal" },
  { href: "/about", label: "About" },
];

export function Nav() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 48px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          color: "var(--color-text)",
          fontWeight: 700,
          fontSize: "16px",
        }}
      >
        <PixelIcon />
        Pellet
      </Link>
      <nav style={{ display: "flex", gap: "32px" }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontSize: "14px",
              color: "var(--color-secondary)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--color-text)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--color-secondary)")
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Create Footer component**

Create `components/Footer.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { PixelIcon } from "./PixelIcon";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        padding: "48px",
        marginTop: "96px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        maxWidth: "1100px",
        margin: "96px auto 0",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <PixelIcon size={20} />
          <span style={{ fontWeight: 700, fontSize: "14px" }}>Pellet</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "var(--color-muted)",
          }}
        >
          Built on
          <Image
            src="/tempo-logo.svg"
            alt="Tempo"
            width={60}
            height={16}
            style={{ opacity: 0.5 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "32px" }}>
        <FooterColumn
          title="Product"
          links={[
            { href: "/tokens", label: "Tokens" },
            { href: "/stablecoins", label: "Stablecoins" },
            { href: "/services", label: "Services" },
            { href: "/terminal", label: "Terminal" },
          ]}
        />
        <FooterColumn
          title="Resources"
          links={[
            { href: "/about", label: "About" },
            { href: "/api/openapi", label: "API" },
            {
              href: "https://www.npmjs.com/package/@pelletfi/mcp",
              label: "MCP Server",
            },
          ]}
        />
        <FooterColumn
          title="Social"
          links={[
            { href: "https://github.com/pelletfi", label: "GitHub" },
            {
              href: "https://x.com/pelletfinance",
              label: "X",
            },
            {
              href: "https://warpcast.com/pellet",
              label: "Farcaster",
            },
          ]}
        />
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "var(--color-muted)",
          marginBottom: "4px",
        }}
      >
        {title}
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            fontSize: "13px",
            color: "var(--color-secondary)",
            textDecoration: "none",
          }}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify nav + footer render**

Run dev server, check any page. Nav should show pixel icon + "Pellet" + 5 links. Footer should appear at bottom with columns and Tempo logo.

- [ ] **Step 6: Commit**

```bash
git add components/PixelIcon.tsx components/Nav.tsx components/Footer.tsx public/tempo-logo.svg
git commit -m "feat: nav, footer, pixel icon — new brand shell"
```

---

### Task 3: StatsBar + Homepage Hero

**Files:**
- Create: `components/StatsBar.tsx`
- Create: `components/Terminal.tsx`
- Rewrite: `app/page.tsx`

- [ ] **Step 1: Create StatsBar component**

Create `components/StatsBar.tsx`:

```tsx
interface Stat {
  label: string;
  value: string;
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1px",
        background: "var(--color-border)",
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            flex: 1,
            background: "var(--color-surface)",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "22px",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "4px",
            }}
          >
            {stat.value}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "var(--color-muted)",
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create Terminal renderer component**

Create `components/Terminal.tsx`. This is a shared component used in the homepage hero (read-only mode) and the `/terminal` page (interactive mode).

```tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface TerminalLine {
  type: "prompt" | "output" | "divider" | "header";
  command?: string;
  text?: string;
  color?: "green" | "yellow" | "muted" | "default";
}

interface TerminalProps {
  lines: TerminalLine[];
  interactive?: boolean;
  onCommand?: (cmd: string) => void;
}

export function Terminal({ lines, interactive = false, onCommand }: TerminalProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const colorMap: Record<string, string> = {
    green: "var(--color-terminal-green)",
    yellow: "var(--color-terminal-yellow)",
    muted: "var(--color-terminal-muted)",
    default: "var(--color-terminal-text)",
  };

  return (
    <div
      style={{
        background: "var(--color-terminal)",
        borderRadius: interactive ? "0" : "8px",
        padding: "24px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        lineHeight: 1.8,
        overflow: "auto",
        height: "100%",
        minHeight: interactive ? "100vh" : "auto",
      }}
    >
      {lines.map((line, i) => {
        if (line.type === "divider") {
          return (
            <div
              key={i}
              style={{
                borderTop: "1px solid #222",
                margin: "8px 0",
              }}
            />
          );
        }
        if (line.type === "header") {
          return (
            <div
              key={i}
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "#444",
                marginBottom: "4px",
                marginTop: "8px",
              }}
            >
              {line.text}
            </div>
          );
        }
        if (line.type === "prompt") {
          return (
            <div key={i} style={{ color: "var(--color-terminal-text)" }}>
              <span style={{ color: "var(--color-terminal-muted)" }}>$ </span>
              <span>{line.command}</span>
            </div>
          );
        }
        return (
          <div
            key={i}
            style={{
              color: colorMap[line.color || "default"],
              paddingLeft: "16px",
            }}
          >
            {line.text}
          </div>
        );
      })}

      {interactive && (
        <div style={{ display: "flex", marginTop: "4px" }}>
          <span
            style={{
              color: "var(--color-terminal-muted)",
              marginRight: "8px",
            }}
          >
            $
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                onCommand?.(input.trim());
                setInput("");
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--color-terminal-text)",
              fontFamily: "inherit",
              fontSize: "inherit",
              flex: 1,
            }}
            autoFocus
            spellCheck={false}
          />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite homepage**

Replace `app/page.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { StatsBar } from "@/components/StatsBar";
import { HeroTerminal } from "./HeroTerminal";

async function getStats() {
  try {
    const [tokensRes, stableRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/v1/tokens`, {
        next: { revalidate: 60 },
      }),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/v1/stablecoins`, {
        next: { revalidate: 60 },
      }),
    ]);
    const tokens = tokensRes.ok ? await tokensRes.json() : [];
    const stables = stableRes.ok ? await stableRes.json() : [];

    const totalVolume = tokens.reduce(
      (sum: number, t: { volume_24h?: number }) => sum + (t.volume_24h || 0),
      0
    );
    const totalLiquidity = tokens.reduce(
      (sum: number, t: { liquidity?: number }) => sum + (t.liquidity || 0),
      0
    );

    return {
      tokens: tokens.length,
      stablecoins: stables.length,
      volume: formatCompact(totalVolume),
      liquidity: formatCompact(totalLiquidity),
    };
  } catch {
    return { tokens: 0, stablecoins: 0, volume: "$0", liquidity: "$0" };
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div>
      {/* Hero — Builder's Statement */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight: "480px",
        }}
      >
        {/* Left: Thesis */}
        <div
          style={{
            padding: "80px 48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "640px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "var(--color-muted)",
              }}
            >
              Built on
            </span>
            <Image
              src="/tempo-logo.svg"
              alt="Tempo"
              width={56}
              height={14}
              style={{ opacity: 0.6 }}
            />
          </div>
          <h1
            style={{
              fontSize: "44px",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-1px",
              marginBottom: "24px",
              color: "var(--color-text)",
            }}
          >
            We&apos;re building the intelligence Tempo needs.
          </h1>
          <p
            style={{
              fontSize: "17px",
              color: "var(--color-secondary)",
              lineHeight: 1.7,
              maxWidth: "520px",
              marginBottom: "36px",
            }}
          >
            The first payments chain deserves more than a block explorer. Pellet
            examines every token, tracks every stablecoin, and maps every
            payment service — natively, from day one.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <Link
              href="/tokens"
              style={{
                background: "var(--color-text)",
                color: "var(--color-bg)",
                padding: "10px 24px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Explore tokens
            </Link>
            <Link
              href="/about"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-text)",
                padding: "10px 24px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
                border: "1px solid var(--color-border)",
              }}
            >
              Read the thesis
            </Link>
          </div>
        </div>

        {/* Right: Semi-live terminal */}
        <div style={{ position: "relative" }}>
          <HeroTerminal />
          <Link
            href="/terminal"
            style={{
              position: "absolute",
              bottom: "16px",
              right: "24px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--color-terminal-muted)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            Try the terminal →
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar
        stats={[
          { label: "Tokens Tracked", value: String(stats.tokens) },
          { label: "Stablecoins", value: String(stats.stablecoins) },
          { label: "24h Volume", value: stats.volume },
          { label: "Total Liquidity", value: stats.liquidity },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create HeroTerminal client component**

Create `app/HeroTerminal.tsx`. This is a client component that fetches real data on mount and renders it in the terminal format.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Terminal } from "@/components/Terminal";

interface TerminalLine {
  type: "prompt" | "output" | "divider" | "header";
  command?: string;
  text?: string;
  color?: "green" | "yellow" | "muted" | "default";
}

export function HeroTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "header", text: "Live on Tempo" },
    { type: "prompt", command: "pellet tokens --top 3" },
    { type: "output", text: "Loading...", color: "muted" },
  ]);

  useEffect(() => {
    async function load() {
      const newLines: TerminalLine[] = [
        { type: "header", text: "Live on Tempo" },
      ];

      try {
        const tokensRes = await fetch("/api/v1/tokens?page=1");
        const tokens = tokensRes.ok ? await tokensRes.json() : [];
        const top3 = tokens.slice(0, 3);

        newLines.push({ type: "prompt", command: "pellet tokens --top 3" });
        for (const t of top3) {
          const price = t.price_usd
            ? `$${Number(t.price_usd).toFixed(4)}`
            : "—";
          const vol = t.volume_24h
            ? `$${(t.volume_24h / 1000).toFixed(1)}K`
            : "—";
          newLines.push({
            type: "output",
            text: `${(t.name || t.symbol || "???").padEnd(12)} ${price.padEnd(12)} vol ${vol}`,
          });
        }
      } catch {
        newLines.push({ type: "prompt", command: "pellet tokens --top 3" });
        newLines.push({
          type: "output",
          text: "Error fetching tokens",
          color: "muted",
        });
      }

      newLines.push({ type: "divider" });

      try {
        const stablesRes = await fetch("/api/v1/stablecoins");
        const stables = stablesRes.ok ? await stablesRes.json() : [];

        newLines.push({
          type: "prompt",
          command: "pellet stablecoins --summary",
        });
        newLines.push({
          type: "output",
          text: `${stables.length} stablecoins tracked`,
        });
        for (const s of stables.slice(0, 2)) {
          const peg = s.price_vs_pathusd
            ? `$${Number(s.price_vs_pathusd).toFixed(4)}`
            : "$1.0000";
          newLines.push({
            type: "output",
            text: `${s.symbol?.padEnd(10)} peg: ${peg}`,
            color: "green",
          });
        }
      } catch {
        newLines.push({
          type: "prompt",
          command: "pellet stablecoins --summary",
        });
        newLines.push({
          type: "output",
          text: "Error fetching stablecoins",
          color: "muted",
        });
      }

      newLines.push({ type: "divider" });
      newLines.push({ type: "prompt", command: "pellet status" });
      newLines.push({
        type: "output",
        text: "All systems operational",
        color: "green",
      });

      setLines(newLines);
    }
    load();
  }, []);

  return <Terminal lines={lines} />;
}
```

- [ ] **Step 5: Verify homepage renders**

Run dev server, visit `http://localhost:3000`. Should see split hero (thesis left, dark terminal right), stats bar below. Terminal should load real data from API.

- [ ] **Step 6: Commit**

```bash
git add components/StatsBar.tsx components/Terminal.tsx app/page.tsx app/HeroTerminal.tsx
git commit -m "feat: homepage — builder's statement hero with semi-live terminal"
```

---

### Task 4: Tokens Page (`/tokens`)

**Files:**
- Create: `app/tokens/page.tsx`
- Modify: `components/Search.tsx`
- Modify: `components/TokenCard.tsx`

The old `/` page with token list moves to `/tokens`. Search and TokenCard get restyled for light theme.

- [ ] **Step 1: Restyle Search component**

Replace `components/Search.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Search({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
      router.push(`/token/${q}`);
    } else {
      router.push(`/tokens?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "12px" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search token name or paste address..."
        style={{
          flex: 1,
          padding: "10px 16px",
          fontSize: "14px",
          border: "1px solid var(--color-border)",
          borderRadius: "6px",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          outline: "none",
        }}
      />
      <button
        type="submit"
        style={{
          padding: "10px 24px",
          fontSize: "13px",
          fontWeight: 500,
          background: "var(--color-text)",
          color: "var(--color-bg)",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Restyle TokenCard component**

Replace `components/TokenCard.tsx`:

```tsx
import Link from "next/link";

interface TokenCardProps {
  address: string;
  name: string;
  symbol?: string;
  image_url?: string;
  price_usd: number | null;
  price_change_24h: number | null;
  volume_24h: number | null;
  liquidity: number | null;
}

export function TokenCard({
  address,
  name,
  image_url,
  price_usd,
  price_change_24h,
  volume_24h,
  liquidity,
}: TokenCardProps) {
  const change = price_change_24h ?? 0;
  const changeColor =
    change > 0
      ? "var(--color-positive)"
      : change < 0
        ? "var(--color-negative)"
        : "var(--color-muted)";

  return (
    <Link
      href={`/token/${address}`}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr",
        padding: "16px 0",
        borderBottom: "1px solid var(--color-border)",
        textDecoration: "none",
        color: "inherit",
        alignItems: "center",
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            width={28}
            height={28}
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--color-border)",
            }}
          />
        )}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>{name}</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-muted)",
            }}
          >
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px" }}>
        {price_usd != null ? `$${Number(price_usd).toFixed(4)}` : "—"}
        <span
          style={{ fontSize: "11px", marginLeft: "6px", color: changeColor }}
        >
          {change > 0 ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          color: "var(--color-muted)",
        }}
      >
        {volume_24h != null ? formatCompact(volume_24h) : "—"}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          color: "var(--color-muted)",
        }}
      >
        {liquidity != null ? formatCompact(liquidity) : "—"}
      </div>
    </Link>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
```

- [ ] **Step 3: Create tokens page**

Create `app/tokens/page.tsx`. This is essentially the logic from the old `app/page.tsx` with the new route and styling.

```tsx
import { Search } from "@/components/Search";
import { TokenCard } from "@/components/TokenCard";
import { getPools, searchTokens } from "@/lib/gecko";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function TokensPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q?.trim();
  const page = parseInt(params.page || "1", 10);

  let tokens: Array<{
    address: string;
    name: string;
    symbol?: string;
    image_url?: string;
    price_usd: number | null;
    price_change_24h: number | null;
    volume_24h: number | null;
    liquidity: number | null;
  }> = [];
  let hasNext = false;
  let hasPrev = page > 1;

  if (query) {
    const results = await searchTokens(query);
    tokens = results.map((r: Record<string, unknown>) => ({
      address: String(r.address || ""),
      name: String(r.name || ""),
      symbol: r.symbol ? String(r.symbol) : undefined,
      image_url: r.image_url ? String(r.image_url) : undefined,
      price_usd: r.price_usd != null ? Number(r.price_usd) : null,
      price_change_24h: null,
      volume_24h: r.volume_24h != null ? Number(r.volume_24h) : null,
      liquidity: r.liquidity != null ? Number(r.liquidity) : null,
    }));
  } else {
    const data = await getPools(page);
    const seen = new Set<string>();
    for (const pool of data.pools || []) {
      const addr = pool.base_token_address;
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      tokens.push({
        address: addr,
        name: pool.base_token_name || pool.base_token_symbol || addr,
        symbol: pool.base_token_symbol,
        image_url: pool.base_token_image_url,
        price_usd: pool.base_token_price_usd
          ? Number(pool.base_token_price_usd)
          : null,
        price_change_24h: pool.price_change_24h
          ? Number(pool.price_change_24h)
          : null,
        volume_24h: pool.volume_24h ? Number(pool.volume_24h) : null,
        liquidity: pool.reserve_usd ? Number(pool.reserve_usd) : null,
      });
    }
    hasNext = !!data.hasNext;
    hasPrev = !!data.hasPrev;
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px" }}>
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        Tokens
      </h1>
      <p
        style={{
          color: "var(--color-secondary)",
          fontSize: "15px",
          marginBottom: "32px",
        }}
      >
        Every token on Tempo, tracked and examined.
      </p>

      <div style={{ marginBottom: "32px" }}>
        <Search defaultValue={query || ""} />
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          padding: "12px 0",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {["Token", "Price", "Volume 24H", "Liquidity"].map((h) => (
          <span
            key={h}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "var(--color-muted)",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {tokens.map((t) => (
        <TokenCard key={t.address} {...t} />
      ))}

      {/* Pagination */}
      {!query && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            marginTop: "32px",
          }}
        >
          {hasPrev && (
            <Link
              href={`/tokens?page=${page - 1}`}
              style={{
                padding: "8px 20px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--color-secondary)",
                textDecoration: "none",
              }}
            >
              ← Previous
            </Link>
          )}
          {hasNext && (
            <Link
              href={`/tokens?page=${page + 1}`}
              style={{
                padding: "8px 20px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--color-secondary)",
                textDecoration: "none",
              }}
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

Note: The `getPools` and `searchTokens` functions from `lib/gecko.ts` return data that may need field name adaptation. Check the actual return shape and adjust field mappings in this file — the field names above (base_token_address, base_token_name, etc.) come from the GeckoTerminal API and are extracted in the existing `getPools` function. Read the actual `lib/gecko.ts` return types if any fields don't match.

- [ ] **Step 4: Verify tokens page**

Visit `http://localhost:3000/tokens`. Should show light-themed token list with search bar, table headers, rows with real data. Check pagination works.

- [ ] **Step 5: Commit**

```bash
git add app/tokens/page.tsx components/Search.tsx components/TokenCard.tsx
git commit -m "feat: tokens page — light theme, real icons, moved to /tokens"
```

---

### Task 5: Restyle Token Detail + Briefing Pages

**Files:**
- Modify: `app/token/[address]/page.tsx`
- Modify: `app/token/[address]/briefing/page.tsx`
- Modify: `components/SafetyBadge.tsx`
- Modify: `components/BriefingDocument.tsx`

These pages keep their existing data-fetching logic but get completely restyled for the light theme. The implementation agent should read each file first, then apply the new styling while preserving all logic.

- [ ] **Step 1: Restyle SafetyBadge**

Read the current `components/SafetyBadge.tsx`. Replace all inline style objects with light-theme equivalents:
- Background: `var(--color-surface)` instead of dark grays
- Text: `var(--color-text)` for primary, `var(--color-secondary)` for labels
- Keep green/yellow/red signal colors (use `var(--color-positive)` and `var(--color-negative)`)
- Labels: switch to `var(--font-mono)` with uppercase treatment
- Border: `1px solid var(--color-border)`
- Border-radius: `8px`

- [ ] **Step 2: Restyle token detail page**

Read `app/token/[address]/page.tsx`. This has extensive inline styles for the dark theme. Replace all styling while preserving the data pipeline and component structure:

Key style replacements:
- Page container: `maxWidth: "1000px"`, `margin: "0 auto"`, `padding: "48px"`
- Section wrapper: `background: "var(--color-surface)"`, `border: "1px solid var(--color-border)"`, `borderRadius: "8px"`, `padding: "24px"`, `marginBottom: "24px"`
- Section titles: `fontSize: "14px"`, `fontWeight: 600`, `color: "var(--color-text)"`, `marginBottom: "16px"`
- Data row labels: `fontFamily: "var(--font-mono)"`, `fontSize: "12px"`, `color: "var(--color-muted)"`, uppercase
- Data row values: `fontFamily: "var(--font-mono)"`, `fontSize: "14px"`, `color: "var(--color-text)"`
- Metric grid: keep 3-column layout, update colors
- Deep Briefing CTA: `background: "var(--color-text)"`, `color: "var(--color-bg)"`, `borderRadius: "6px"`, `padding: "12px 28px"`
- Remove all `#0f0f11`, `#13131a`, `#1a1a1f`, `#e8e8e8`, `#888888`, `#555555` references — replace with CSS var equivalents

- [ ] **Step 3: Restyle briefing page**

Read `app/token/[address]/briefing/page.tsx`. Same treatment — replace dark styles with light theme CSS vars. The briefing landing page describing the $0.05 MPP payment should use the editorial/thesis style (left-aligned, generous whitespace, max 720px).

- [ ] **Step 4: Restyle BriefingDocument**

Read `components/BriefingDocument.tsx`. Replace all dark inline styles with light theme. Section headers should use the mono label treatment. Data tables should have `var(--color-border)` borders with `var(--color-surface)` header backgrounds.

- [ ] **Step 5: Verify token detail flow**

Visit a token detail page (e.g., `http://localhost:3000/token/0x20c0000000000000000000000000000000000000`). Check:
- Light background renders correctly
- Safety badge colors are correct
- All sections display (safety, compliance, distribution)
- Deep Briefing CTA is visible
- Briefing landing page at `/token/{addr}/briefing` renders

- [ ] **Step 6: Commit**

```bash
git add app/token/ components/SafetyBadge.tsx components/BriefingDocument.tsx
git commit -m "feat: token detail + briefing — light theme restyle"
```

---

### Task 6: Restyle Stablecoin Pages

**Files:**
- Modify: `app/stablecoins/page.tsx`
- Modify: `app/stablecoins/flows/page.tsx`
- Modify: `app/stablecoins/[address]/page.tsx`
- Modify: `components/StablecoinRow.tsx`

Same approach as Task 5 — preserve data logic, replace all dark styling with light theme.

- [ ] **Step 1: Restyle StablecoinRow**

Read `components/StablecoinRow.tsx`. Replace inline styles:
- Grid row with `var(--color-border)` bottom border
- Mono font for all data values
- Keep peg deviation color logic (green/yellow/red) using CSS vars
- Link styling: no underline, color inherit

- [ ] **Step 2: Restyle stablecoins list page**

Read `app/stablecoins/page.tsx`. Replace all dark styles:
- Container: `maxWidth: "1100px"`, `margin: "0 auto"`, `padding: "48px"`
- Page title: `fontSize: "28px"`, `fontWeight: 700`
- Subtitle: `color: "var(--color-secondary)"`, `fontSize: "15px"`
- Table header: mono label treatment (10px uppercase)
- Flow matrix link: styled as secondary button

- [ ] **Step 3: Restyle flow matrix page**

Read `app/stablecoins/flows/page.tsx`. Replace dark styles:
- Time selector buttons: `background: "var(--color-surface)"` default, `background: "var(--color-text)"` + `color: "var(--color-bg)"` for active
- Table headers: mono label treatment
- Flow values: mono font, color for direction (positive green, negative red)

- [ ] **Step 4: Restyle stablecoin detail page**

Read `app/stablecoins/[address]/page.tsx`. Replace dark styles:
- Same section wrapper pattern as token detail (surface bg, border, radius)
- Data rows with mono labels + values
- Peg deviation coloring preserved

- [ ] **Step 5: Verify stablecoin pages**

Visit `/stablecoins`, click into a stablecoin detail, check the flow matrix. All should render on light background with correct data and colors.

- [ ] **Step 6: Commit**

```bash
git add app/stablecoins/ components/StablecoinRow.tsx
git commit -m "feat: stablecoin pages — light theme restyle"
```

---

### Task 7: MPP Services Page (`/services`)

**Files:**
- Create: `app/services/page.tsx`

New page. Fetches service data from mpp.dev or a local registry and displays as a directory.

- [ ] **Step 1: Create services page**

Create `app/services/page.tsx`:

```tsx
interface Service {
  name: string;
  description: string;
  url: string;
  currencies?: string[];
}

async function getServices(): Promise<Service[]> {
  // Try to fetch from mpp.dev public endpoint
  // If that's not available, return a curated list of known Tempo MPP services
  try {
    const res = await fetch("https://mpp.dev/api/services", {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to known services
  }

  // Curated fallback — update as services launch
  return [
    {
      name: "Pellet Deep Briefing",
      description:
        "AI-powered token analysis — safety, compliance, distribution, origin. $0.05 per report.",
      url: "https://pelletfi.com/api/v1/tokens",
      currencies: ["pathUSD"],
    },
  ];
}

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px" }}>
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        MPP Services
      </h1>
      <p
        style={{
          color: "var(--color-secondary)",
          fontSize: "15px",
          marginBottom: "40px",
          maxWidth: "560px",
        }}
      >
        Payment services built on Tempo&apos;s Micropayment Protocol. Machine-payable APIs, agent-ready endpoints.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {services.map((service) => (
          <a
            key={service.url}
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "24px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.15s",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--color-text)",
              }}
            >
              {service.name}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "var(--color-secondary)",
                lineHeight: 1.6,
                marginBottom: "12px",
              }}
            >
              {service.description}
            </div>
            {service.currencies && (
              <div style={{ display: "flex", gap: "6px" }}>
                {service.currencies.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      padding: "2px 8px",
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "4px",
                      color: "var(--color-muted)",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>

      {services.length <= 1 && (
        <div
          style={{
            marginTop: "48px",
            padding: "32px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "14px",
          }}
        >
          More services coming as the Tempo ecosystem grows.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify services page**

Visit `http://localhost:3000/services`. Should show at least the Pellet briefing service card. Check that the card layout, typography, and colors match the design system.

- [ ] **Step 3: Commit**

```bash
git add app/services/page.tsx
git commit -m "feat: MPP services directory page"
```

---

### Task 8: Interactive Terminal Page (`/terminal`)

**Files:**
- Create: `app/terminal/page.tsx`

- [ ] **Step 1: Create terminal page**

Create `app/terminal/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Terminal } from "@/components/Terminal";

interface TerminalLine {
  type: "prompt" | "output" | "divider" | "header";
  command?: string;
  text?: string;
  color?: "green" | "yellow" | "muted" | "default";
}

const HELP_TEXT: TerminalLine[] = [
  { type: "header", text: "Available Commands" },
  { type: "output", text: "pellet tokens              List all tokens on Tempo" },
  { type: "output", text: "pellet analyze <address>   Analyze a specific token" },
  { type: "output", text: "pellet stablecoins         List stablecoins" },
  { type: "output", text: "pellet flows [hours]       Stablecoin flow matrix" },
  { type: "output", text: "pellet status              System health check" },
  { type: "output", text: "help                       Show this message" },
  { type: "output", text: "clear                      Clear terminal" },
];

export default function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "header", text: "Pellet Terminal — Live on Tempo" },
    { type: "output", text: 'Type "help" for available commands.', color: "muted" },
    { type: "divider" },
  ]);

  const handleCommand = useCallback(async (input: string) => {
    const cmd = input.toLowerCase().trim();

    setLines((prev) => [...prev, { type: "prompt", command: input }]);

    if (cmd === "clear") {
      setLines([
        { type: "header", text: "Pellet Terminal — Live on Tempo" },
        { type: "divider" },
      ]);
      return;
    }

    if (cmd === "help") {
      setLines((prev) => [...prev, ...HELP_TEXT, { type: "divider" }]);
      return;
    }

    if (cmd === "pellet tokens" || cmd === "tokens") {
      try {
        const res = await fetch("/api/v1/tokens?page=1");
        const tokens = res.ok ? await res.json() : [];
        const output: TerminalLine[] = [
          {
            type: "output",
            text: `${tokens.length} tokens found`,
            color: "green",
          },
        ];
        for (const t of tokens.slice(0, 10)) {
          const price = t.price_usd
            ? `$${Number(t.price_usd).toFixed(4)}`
            : "—";
          const vol = t.volume_24h
            ? `$${(t.volume_24h / 1000).toFixed(1)}K`
            : "—";
          output.push({
            type: "output",
            text: `${(t.name || t.symbol || "???").padEnd(14)} ${price.padEnd(14)} vol: ${vol}`,
          });
        }
        output.push({ type: "divider" });
        setLines((prev) => [...prev, ...output]);
      } catch {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Error fetching tokens", color: "muted" },
          { type: "divider" },
        ]);
      }
      return;
    }

    if (cmd.startsWith("pellet analyze ") || cmd.startsWith("analyze ")) {
      const address = cmd.split(" ").pop() || "";
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Invalid address. Expected 0x... (40 hex chars)", color: "muted" },
          { type: "divider" },
        ]);
        return;
      }

      setLines((prev) => [
        ...prev,
        { type: "output", text: "Analyzing...", color: "muted" },
      ]);

      try {
        const res = await fetch(`/api/v1/tokens/${address}`);
        if (!res.ok) {
          setLines((prev) => [
            ...prev.slice(0, -1),
            { type: "output", text: `Error: ${res.status}`, color: "muted" },
            { type: "divider" },
          ]);
          return;
        }
        const data = await res.json();
        const output: TerminalLine[] = [];

        // Remove "Analyzing..." line
        setLines((prev) => {
          const withoutLoading = prev.slice(0, -1);
          return withoutLoading;
        });

        if (data.market) {
          output.push({ type: "header", text: "Market" });
          output.push({
            type: "output",
            text: `price: $${Number(data.market.price_usd || 0).toFixed(4)}`,
          });
          output.push({
            type: "output",
            text: `volume 24h: $${Number(data.market.volume_24h || 0).toFixed(2)}`,
          });
          output.push({
            type: "output",
            text: `liquidity: $${Number(data.market.liquidity_usd || 0).toFixed(2)}`,
          });
        }

        if (data.safety) {
          output.push({ type: "header", text: "Safety" });
          output.push({
            type: "output",
            text: `verdict: ${data.safety.verdict}`,
            color: data.safety.verdict === "LOW_RISK" ? "green" : "yellow",
          });
          output.push({
            type: "output",
            text: `score: ${data.safety.score}/100`,
          });
          if (data.safety.flags?.length) {
            output.push({
              type: "output",
              text: `flags: ${data.safety.flags.join(", ")}`,
              color: "yellow",
            });
          }
        }

        if (data.compliance) {
          output.push({ type: "header", text: "Compliance" });
          output.push({
            type: "output",
            text: `type: ${data.compliance.token_type || "unknown"}`,
          });
          if (data.compliance.policy_type) {
            output.push({
              type: "output",
              text: `policy: ${data.compliance.policy_type}`,
            });
          }
        }

        output.push({ type: "divider" });
        setLines((prev) => [...prev, ...output]);
      } catch {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Error analyzing token", color: "muted" },
          { type: "divider" },
        ]);
      }
      return;
    }

    if (cmd === "pellet stablecoins" || cmd === "stablecoins") {
      try {
        const res = await fetch("/api/v1/stablecoins");
        const stables = res.ok ? await res.json() : [];
        const output: TerminalLine[] = [
          {
            type: "output",
            text: `${stables.length} stablecoins tracked`,
            color: "green",
          },
        ];
        for (const s of stables) {
          const peg = s.price_vs_pathusd
            ? `$${Number(s.price_vs_pathusd).toFixed(4)}`
            : "—";
          const supply = s.total_supply
            ? `${(Number(s.total_supply) / 1e6).toFixed(2)}M`
            : "—";
          output.push({
            type: "output",
            text: `${(s.symbol || "???").padEnd(10)} peg: ${peg.padEnd(10)} supply: ${supply}`,
          });
        }
        output.push({ type: "divider" });
        setLines((prev) => [...prev, ...output]);
      } catch {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Error fetching stablecoins", color: "muted" },
          { type: "divider" },
        ]);
      }
      return;
    }

    if (cmd.startsWith("pellet flows") || cmd.startsWith("flows")) {
      const parts = cmd.split(" ");
      const hours = parseInt(parts[parts.length - 1]) || 24;
      try {
        const res = await fetch(`/api/v1/stablecoins/flows?hours=${hours}`);
        const flows = res.ok ? await res.json() : [];
        const output: TerminalLine[] = [
          {
            type: "output",
            text: `Flows (last ${hours}h): ${flows.length} pairs`,
            color: "green",
          },
        ];
        for (const f of flows.slice(0, 10)) {
          const direction = Number(f.net_flow_usd) >= 0 ? "→" : "←";
          output.push({
            type: "output",
            text: `${f.from_symbol || f.from_token?.slice(0, 8)} ${direction} ${f.to_symbol || f.to_token?.slice(0, 8)}  $${Math.abs(Number(f.net_flow_usd)).toFixed(0)}  (${f.tx_count} tx)`,
          });
        }
        output.push({ type: "divider" });
        setLines((prev) => [...prev, ...output]);
      } catch {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Error fetching flows", color: "muted" },
          { type: "divider" },
        ]);
      }
      return;
    }

    if (cmd === "pellet status" || cmd === "status") {
      try {
        const res = await fetch("/api/v1/health");
        const data = res.ok ? await res.json() : null;
        if (data) {
          setLines((prev) => [
            ...prev,
            { type: "output", text: `chain: ${data.chain || "tempo"}`, color: "green" },
            { type: "output", text: `block: ${data.block || "—"}` },
            { type: "output", text: `status: ${data.status || "ok"}`, color: "green" },
            { type: "divider" },
          ]);
        }
      } catch {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Health check failed", color: "muted" },
          { type: "divider" },
        ]);
      }
      return;
    }

    // Unknown command
    setLines((prev) => [
      ...prev,
      {
        type: "output",
        text: `Unknown command: ${input}. Type "help" for commands.`,
        color: "muted",
      },
      { type: "divider" },
    ]);
  }, []);

  return (
    <div style={{ background: "var(--color-terminal)", minHeight: "100vh" }}>
      <Terminal lines={lines} interactive onCommand={handleCommand} />
    </div>
  );
}
```

- [ ] **Step 2: Verify terminal page**

Visit `http://localhost:3000/terminal`. Test:
- Type `help` — should show command list
- Type `pellet tokens` — should fetch and display real token data
- Type `pellet status` — should show health check
- Type `pellet analyze 0x20c0000000000000000000000000000000000000` — should show pathUSD analysis
- Type `clear` — should clear terminal
- Type garbage — should show "Unknown command" message

- [ ] **Step 3: Commit**

```bash
git add app/terminal/page.tsx
git commit -m "feat: interactive terminal page — full CLI experience"
```

---

### Task 9: About / Thesis Page (`/about`)

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Create about page**

Create `app/about/page.tsx`:

```tsx
import Image from "next/image";

export default function AboutPage() {
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "96px 48px" }}>
      {/* Pixel strip accent */}
      <div style={{ display: "flex", gap: "3px", marginBottom: "32px" }}>
        {[
          "#0a0a0a",
          "#333",
          "#555",
          "#888",
          "#aaa",
          "#ccc",
          "#aaa",
          "#888",
          "#555",
          "#333",
          "#0a0a0a",
        ].map((color, i) => (
          <div
            key={i}
            style={{
              width: "8px",
              height: "8px",
              background: color,
              imageRendering: "pixelated" as const,
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "var(--color-muted)",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        About Pellet — Built on
        <Image
          src="/tempo-logo.svg"
          alt="Tempo"
          width={56}
          height={14}
          style={{ opacity: 0.5 }}
        />
      </div>

      <h1
        style={{
          fontSize: "44px",
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-1px",
          marginBottom: "32px",
        }}
      >
        The intelligence layer for the payments chain.
      </h1>

      <div
        style={{
          fontSize: "17px",
          color: "var(--color-secondary)",
          lineHeight: 1.8,
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <p>
          Tempo is the first blockchain designed for payments at scale —
          incubated by Stripe and Paradigm, launched March 2026. It introduced
          TIP-20 stablecoins with enshrined compliance, a native DEX, and the
          Micropayment Protocol for machine-to-machine payments.
        </p>

        <p>
          The chain is live. Tokens are trading. Stablecoins are flowing. MPP
          services are coming online. But there&apos;s no analytical layer making
          any of it legible.
        </p>

        <p style={{ color: "var(--color-text)", fontWeight: 500 }}>
          That&apos;s what Pellet is building.
        </p>

        <p>
          We examine every token on Tempo — safety, compliance, holder
          distribution, deployer origin. We track every TIP-20 stablecoin —
          peg stability, supply headroom, cross-pair flows. We map every MPP
          service as the machine economy takes shape.
        </p>

        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--color-text)",
            marginTop: "16px",
          }}
        >
          Why Tempo
        </h2>

        <p>
          Most chains optimize for speed or cost. Tempo optimizes for payments.
          That means enshrined stablecoin standards, built-in compliance
          policies, and a micropayment protocol that lets machines pay machines
          at the HTTP layer.
        </p>

        <p>
          This isn&apos;t another EVM fork. Tempo&apos;s architecture creates
          data structures that don&apos;t exist anywhere else — TIP-403
          compliance policies, enshrined DEX orderbooks, MPP payment graphs.
          Pellet is built to read these native structures, not to retrofit
          generic tools.
        </p>

        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--color-text)",
            marginTop: "16px",
          }}
        >
          How it works
        </h2>

        <p>
          Pellet runs an 8-stage pipeline on every token: market data from the
          enshrined DEX, bytecode safety analysis, TIP-403 compliance
          verification, holder distribution from event replay, identity
          resolution, deployer origin tracing, and AI-powered synthesis.
        </p>

        <p>
          Deep briefings are paid via MPP — $0.05 in pathUSD, settled at the
          protocol layer. No accounts, no API keys. Just a payment and a
          report.
        </p>

        <p>
          Everything is available as an API, an MCP server for AI assistants,
          and this site.
        </p>

        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--color-text)",
            marginTop: "16px",
          }}
        >
          Built from day one
        </h2>

        <p>
          We didn&apos;t wait for the ecosystem to mature. Pellet was tracking
          Tempo from the first block. When the chain has 10 tokens, we examine
          all 10. When it has 10,000, we&apos;ll examine all 10,000. First
          mover, native builder, here to stay.
        </p>
      </div>

      {/* Pixel strip footer accent */}
      <div
        style={{
          display: "flex",
          gap: "3px",
          marginTop: "64px",
        }}
      >
        {[
          "#ccc",
          "#aaa",
          "#888",
          "#555",
          "#333",
          "#0a0a0a",
          "#333",
          "#555",
          "#888",
          "#aaa",
          "#ccc",
        ].map((color, i) => (
          <div
            key={i}
            style={{
              width: "8px",
              height: "8px",
              background: color,
              imageRendering: "pixelated" as const,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify about page**

Visit `http://localhost:3000/about`. Should render as a clean editorial page with pixel strip accents, Tempo logo, generous whitespace. Read through to confirm the copy makes sense.

- [ ] **Step 3: Commit**

```bash
git add app/about/page.tsx
git commit -m "feat: about/thesis page — editorial statement"
```

---

### Task 10: Final Polish + Cleanup

**Files:**
- Remove: old `app/page.tsx` references to token list (already replaced in Task 3)
- Verify: all pages render, all links work, no dark theme remnants

- [ ] **Step 1: Remove old Geist font imports**

Check `package.json` — the `geist` package (v1.7.0) is no longer needed for the UI since we switched to Google Fonts. However, if any `lib/` or API code imports it, leave it. If it's only used in the old layout, remove it:

```bash
npm uninstall geist
```

- [ ] **Step 2: Verify all navigation links**

Click through every nav link on dev server:
- `/` (homepage) → hero + terminal + stats
- `/tokens` → token list with search
- `/token/0x20c0000000000000000000000000000000000000` → token detail
- `/stablecoins` → stablecoin matrix
- `/stablecoins/flows` → flow matrix
- `/services` → MPP directory
- `/terminal` → interactive terminal
- `/about` → thesis page

Check footer links render and point correctly.

- [ ] **Step 3: Check for dark theme remnants**

Search for any remaining old color references that shouldn't be there:

```bash
grep -r "#0f0f11\|#13131a\|#1a1a1f\|#e8e8e8\|#888888" --include="*.tsx" --include="*.css" app/ components/
```

If any found, replace with the appropriate CSS variable.

- [ ] **Step 4: Verify mobile responsiveness**

Check the homepage hero at narrow widths — the grid should stack vertically. The token table should be scrollable or stack. The terminal should work on small screens.

If the homepage hero grid breaks on mobile, add a media query or switch to `grid-template-columns: 1fr` below a breakpoint. The implementation agent should test at ~375px width and fix any layout issues.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup — remove old theme, verify all pages"
```
