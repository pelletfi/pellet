# Pellet on Tempo — Complete Visual Rebuild

**Date:** 2026-04-12
**Status:** Design approved

## Summary

Complete visual rebuild of pelletfi.com to establish Pellet as a major player in the Tempo ecosystem. Moving from dark crypto-dashboard aesthetic to a light, mpp.dev-clean analytical layer with pixel art identity elements. Not an explorer — a statement about Tempo as a chain.

## Identity

**The Tempo Microscope.** Pellet is the analytical lens on Tempo. Every token examined, every stablecoin tracked, every MPP service mapped. The intelligence layer the first payments chain deserves.

**Brand:** "Pellet" — no "Finance" suffix. The pixel pellet icon + "Pellet" wordmark in the nav.

**Tempo logo:** Use the real Tempo logo/wordmark when referencing the chain (e.g., "Built on Tempo" badges, about page, footer). Don't substitute with text or a custom mark.

## Aesthetic

### Color Palette

| Token       | Value     | Usage                        |
|-------------|-----------|------------------------------|
| `bg`        | `#ffffff` | Page background              |
| `surface`   | `#fafafa` | Cards, stat bars, sections   |
| `text`      | `#0a0a0a` | Primary text, headings       |
| `secondary` | `#555555` | Body text, descriptions      |
| `muted`     | `#aaaaaa` | Labels, placeholders         |
| `border`    | `#eeeeee` | Borders, dividers            |
| `positive`  | `#16a34a` | Price up, safe, stable       |
| `negative`  | `#dc2626` | Price down, risk, critical   |
| `terminal`  | `#0a0a0a` | Terminal panel background    |

Achromatic everywhere except green/red for price movement and safety signals. Color is reserved for meaning, never decoration.

### Typography

Two-font system, no exceptions.

| Role       | Font            | Weight     | Size range  | Usage                                    |
|------------|-----------------|------------|-------------|------------------------------------------|
| Prose      | Inter           | 400–700    | 14–48px     | Headings, body, navigation, descriptions |
| Data       | JetBrains Mono  | 400–600    | 10–24px     | Prices, addresses, labels, stats, terminal |

**Scale:**
- Hero: 44px / 700 / -1px tracking / 1.1 line-height
- H2: 24px / 600
- Body: 16–17px / 400 / 1.7 line-height
- Mono data: 14px / 500
- Labels: 10px / 500 / uppercase / 1.5px tracking

### Spacing & Layout

- Content max-width: 720px for prose, 1100px for tables/grids
- Tempo-level whitespace — generous padding (48px+ horizontal, 72–96px vertical hero)
- 1px solid `#eeeeee` borders, subtle
- Border-radius: 6–8px for cards/buttons, 4px for small elements
- Transitions: 0.15s ease for interactive states

### Pixel Art Identity

Pixel art appears in UI chrome and decorative elements:
- Pellet logo/icon (pixel pellet mark)
- Section dividers / accent strips
- Loading states and empty states
- Illustrations on the about/thesis page
- NOT token icons — those use real images from chain/DEX metadata

## Pages

### 1. Homepage

**Hero — Builder's Statement (split layout)**

Left panel:
- Overline: "Pellet on Tempo" (with real Tempo logo)
- Headline: "We're building the intelligence Tempo needs."
- Body: The first payments chain deserves more than a block explorer. Pellet examines every token, tracks every stablecoin, and maps every payment service — natively, from day one.
- CTAs: "Explore tokens" (primary) / "Read the thesis" (secondary)

Right panel:
- Dark terminal (`#0a0a0a` background) showing real API output
- Semi-live: fetches from Pellet API on page load, formats as terminal commands
- Shows: `pellet analyze` (token data), `pellet stablecoins --flows` (flow data), `pellet services list` (MPP count)
- "Try the terminal →" button linking to `/terminal`

**Below hero:**
- Stats bar: Tokens tracked, Stablecoins, 24h Volume, MPP Services, Total Liquidity
- Preview sections teasing Tokens, Stablecoins, Services pages

### 2. Tokens (`/tokens`)

- "If it's on Tempo, it's on Pellet" confidence
- Search bar (token name or address)
- Clean table: real token icon, name, truncated address, price, 24h change, volume, liquidity
- Rows link to token detail
- Token icons pulled from chain/DEX metadata (not pixel art)

### 3. Token Detail (`/token/[address]`)

- The microscope view
- Token identity header: icon, name, symbol, address
- Key metrics: price, volume, liquidity
- Sections: Safety, Compliance (TIP-403), Distribution (holder concentration), Origin (deployer)
- Deep Briefing CTA ($0.05 via MPP) — full analyst report

### 4. Stablecoins (`/stablecoins`)

- TIP-20 stablecoin matrix: symbol, price vs pathUSD, spread, policy type, supply, headroom, yield
- Flow matrix sub-page: net directional flows between stablecoins over time windows (1h, 6h, 24h, 48h, 7d)
- Stablecoin detail pages

### 5. MPP Services (`/services`)

- Directory of payment services registered on Tempo
- Source: mpp.dev/services data or on-chain MPP registry
- Card or table layout: service name, description, accepted currencies, pricing
- Links out to service endpoints

### 6. Terminal (`/terminal`)

- Full interactive terminal experience
- Dark background, full-width
- Users can type Pellet commands and get real API responses
- Command palette / help system
- The statement piece — shows Pellet is a real tool, not just a website

### 7. About / Thesis (`/about`)

- Editorial page — "The Thesis" hero style (left-aligned, generous whitespace)
- Why Pellet exists on Tempo
- What Tempo means as the first payments chain
- Pellet's conviction: intelligence layer, MPP-native, built from day one
- Pixel art illustrations throughout

## Navigation

Top nav, fixed:
- Left: Pixel pellet icon + "Pellet" wordmark
- Center/Right: Tokens, Stablecoins, Services, Terminal, About
- Clean, Inter font, minimal

Footer:
- Pellet branding
- "Built on Tempo" with real Tempo logo
- Links: GitHub, API docs, MCP server, X (@pelletfinance), Farcaster (@pellet)

## Technical Notes

- Framework: Next.js 16 (already in place)
- Styling: Tailwind CSS 4 — complete reskin of globals.css and all components
- Token icons: Pull from chain metadata, DEX pools, or CoinGecko where available. Fallback to a generic placeholder (not pixel art).
- Terminal: Client component with command parser, fetches from existing API routes
- Semi-live hero terminal: Server component or client fetch on mount, formats API responses as terminal output
- Tempo logo: SVG asset, sourced from tempo.xyz branding
- All existing API routes remain unchanged — this is a frontend rebuild only
