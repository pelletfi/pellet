# Pellet Wallet Demo — Design

Captured from the existing site (`app/globals.css`, project memory). Match this verbatim — no improvising new colors, no gradients on dark backgrounds, no rounded blue accents.

## Style Prompt

Blocky terminal aesthetic on a near-black canvas. Editorial italic serif headlines (Instrument Serif) sit beside mono labels (Commit Mono) for a "data terminal annotated by a print designer" feel. Motion is restrained — step transitions, square caps, no easing flourish. The palette is monochrome with one accent grey; anything else feels off-brand. Imagine a Bloomberg terminal redesigned by someone who reads Werkplaats Typografie.

## Colors

| Role | Hex | Notes |
|---|---|---|
| `--bg` | `#0a0a0a` | Canvas. Never pure black; this slight off-black avoids OLED bloom. |
| `--text-primary` | `rgba(255,255,255,0.93)` | Headlines, primary numerals. |
| `--text-secondary` | `rgba(255,255,255,0.63)` | Body. |
| `--text-tertiary` | `rgba(255,255,255,0.46)` | Mono labels, captions. (a11y-compliant on `#0a0a0a`.) |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Hairlines. |
| `--border-emphasis` | `rgba(255,255,255,0.15)` | Active card borders. |
| `--success` | `#30a46c` | Status dot only — never a fill. |

No accent blue. No accent orange. The site moved off Linear blue to neutral grey 2026-04-29 — do NOT reintroduce chromatic brand colors.

## Typography

| Use | Font | Notes |
|---|---|---|
| Headlines | Instrument Serif | 120px+ display; italic for emphasis (`Wallet`, `OLI`). |
| Body | Geist Sans | 28-42px. |
| Mono labels & data | Commit Mono | 14-22px, uppercase + 0.08em letter-spacing for kickers. |

Tabular numerals on every numeric column (`font-variant-numeric: tabular-nums`).

## Motion

- **Step lines, not curves.** Step transitions on data lines (matching `TokenStackChart` MA line). No smooth interpolation through values.
- **Square caps everywhere.** `shape-rendering: crispEdges` on SVG. No round joins.
- **Restraint.** No bounce, no overshoot, no parallax. Easing is `power2.out` or `expo.out` — never `back`, `elastic`, or `bounce`.
- **No fades to gradient.** Crossfade through black, not through translucent color.

## What NOT to Do

1. No Linear blue (`#6080c0`) as a fill or stroke. It's the old accent.
2. No gradient backgrounds. H.264 banding makes them muddy on dark.
3. No rounded corners larger than 8px. Cards = 8px max. Buttons square or 4px.
4. No emoji in copy.
5. No bouncy/elastic easing on text or numerals — it reads as "crypto promo," not "open ledger."
