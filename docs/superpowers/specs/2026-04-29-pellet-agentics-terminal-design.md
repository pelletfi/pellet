# Pellet — Agentics Terminal for Solana

**Spec date:** 2026-04-29
**Author:** Jake Maynard (@pelletnetwork)
**Status:** Approved for implementation planning
**Domain:** pellet.network
**Repo:** github.com/pelletnetwork/pellet

---

## 1. Product summary

Pellet is a clean monospace web terminal that shows AI agents operating on Solana in real time. Spectator-mode for autonomous on-chain activity: who is doing what, to whom, with what outcome.

It is not a trading tool, not a wallet, not a generic block explorer. It is a watchable, sharable surface for the growing population of autonomous agents on Solana.

The product itself is also an agent: Pellet is registered as one of the watched agents in its own feed. The terminal watches the agent that runs the terminal.

## 2. Thesis

- The Solana ecosystem is moving toward agent-mediated activity (autonomous traders, autonomous social, autonomous deployers, autonomous LPs).
- No canonical surface exists today for watching agents at work. Birdeye/Dexscreener show prices, Solscan shows raw txs, Pump.fun shows token launches, ai16z/Eliza dashboards are fragmented and single-framework. Nothing unifies this in a watchable, aesthetic way.
- A clean, opinionated terminal that makes Solana agentics legible at a glance can win the spectator audience first, then expand into the dev/operator/investor audiences as agent activity becomes mainstream.

## 3. Scope

### In scope (v0)

- Vertical activity stream feed of agent events on Solana, updating in real time.
- ~12 watched agents, sourced from existing registries (ai16z/Eliza, Virtuals on Solana, Goat) plus a curated allowlist.
- Pellet itself as one of the watched agents.
- Desktop and mobile, both first-class (responsive, no separate mobile app).
- Public, no auth.
- Clean monospace aesthetic (see §8).

### Out of scope (v0)

- Trading, swaps, or any wallet-touching action.
- Authentication, accounts, paywalls.
- Native mobile app.
- On-chain Pellet token, points, or economy.
- Pellet's own agent personality and behavior loop (deferred — its own design problem).
- Catch-all Solana terminal (deferred to v∞).
- Heuristic agent detection (defer; v0 uses curated/registry-only).
- Agent reputation, attestation, or scoring (defer).
- Network graph visualization (deferred to v0.5).
- Agent profile pages (deferred to v0.5).

## 4. Audience

### Day-one (v0)

**Crypto-Twitter spectators.** Cheapest to acquire (clips post natively to X), high amplification rate, overlap heavily with the secondary audiences. Entertainment + alpha utility.

### Secondary (post-launch organic)

- **Builders** in the Solana agent ecosystem (utility: see what other frameworks/agents are doing).
- **Investors/traders** watching agent capital flows (utility: signal, not execution).
- **Curious public** ("AI is wild") (entertainment).

### Anti-audience

- Day traders looking for execution tools — go to Photon/GMGN.
- Devs needing raw chain data — go to Solscan/Helius.
- Agent operators needing dashboards for their own agents — that's a different product (a v∞ candidate).

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (desktop + mobile)                                  │
│  Next.js App Router · Tailwind · Geist Mono                  │
│  ─ Live feed view (vertical stream)                          │
│  ─ SSE/WebSocket connection for real-time events             │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────┐
│  Vercel Functions (Node runtime)                             │
│  ─ /api/feed (SSE stream of recent events)                   │
│  ─ /api/agents (list of watched agents + metadata)           │
│  ─ /api/ingest/webhook (Helius webhook receiver)             │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────┐
│  Postgres (Vercel Marketplace · Neon)                        │
│  ─ agents (id, label, source, wallet_addresses, metadata)    │
│  ─ events (id, agent_id, ts, kind, summary, raw_tx_sig)      │
│  ─ Optional Redis (Vercel KV) for hot recent-events cache    │
└──────────────────────────────────────────────────────────────┘
                             ↑
                             │
┌──────────────────────────────────────────────────────────────┐
│  Ingestion                                                   │
│  ─ Helius Enhanced Webhook subscribed to watched wallets     │
│  ─ Cron worker (Vercel Cron) for registry sync (hourly)      │
│  ─ Optional: ai16z/Eliza/Virtuals registry pollers           │
└──────────────────────────────────────────────────────────────┘
```

### Runtime characteristics

- **Real-time latency target:** event lands in feed ≤5 seconds after on-chain confirmation.
- **Throughput target (v0):** ≤10 events/second across all watched agents — well within free-tier Helius.
- **Cold-start tolerance:** acceptable; first paint shows last-100 events from cache, then SSE takes over.

## 6. Data model

### `agents`

| field | type | notes |
|---|---|---|
| `id` | text PK | slug (`pellet`, `aixbt`, etc.) |
| `label` | text | display name |
| `source` | text | `registry:ai16z` / `registry:virtuals` / `curated` / `pellet` |
| `wallets` | text[] | Solana addresses associated with this agent |
| `bio` | text | one-line description |
| `links` | jsonb | optional X handle, site, framework links |
| `created_at` | timestamptz | |
| `active` | boolean | |

### `events`

| field | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `agent_id` | text FK → agents | |
| `ts` | timestamptz | block time |
| `kind` | text | `swap` / `transfer` / `mint` / `program_call` / `social` / `attest` / `custom` |
| `summary` | text | human-legible one-liner ("aixbt swapped 3.2 SOL for $WIF") |
| `targets` | jsonb | structured targets (counter-agents, tokens, programs) |
| `tx_sig` | text | Solana tx signature for deeplink |
| `raw` | jsonb | full enriched event payload from Helius (for debugging + future re-rendering) |

### Indexes

- `events(ts desc)` — primary feed query
- `events(agent_id, ts desc)` — per-agent profile (v0.5)
- `agents(active) where active = true` — feed scope

## 7. Components (UI)

### Feed view (`/`)

Single column, full-height, scrollable. Top fixed header with Pellet mark + minimal nav. New events slide in at top with subtle animation. Older events scroll off the visible area but remain in DOM until ~500 events, then virtualized.

### Event card

```
┌─ 02:14:33 ─────────────────────────── ⌁ swap ──┐
│                                                 │
│  ▣ aixbt                                        │
│    swapped 3.2 SOL → 12,400 $WIF                │
│    via Jupiter · ◐ 0.3% slippage                │
│                                                 │
│  ↳ tx 5kF2…aB91                                 │
└─────────────────────────────────────────────────┘
```

- Glyph (`▣`) = agent's mark; for Pellet it's the actual cleaned mark from `assets/pellet-mark.svg`.
- Timestamp top-left, event kind top-right (with kind-specific glyph).
- Summary in two-line monospace block.
- Footer: tx signature linking to Solscan (external).
- Border: ASCII box-drawing characters rendered with CSS borders + corner pseudo-elements (NOT actual ASCII text — preserves layout integrity).

### Header

```
┌────────────────────────────────────────────────────┐
│  [pellet-mark]  pellet // agentics terminal · sol  │
│                                  ● 12 agents · live│
└────────────────────────────────────────────────────┘
```

- Pellet mark on the left.
- Wordmark + tagline.
- Right side: live status indicator (`●` blinking green-muted = healthy) + count of active agents.

### Mobile

- Same vertical feed, edge-to-edge.
- Header collapses to mark + status indicator only.
- Larger touch targets on tx links (44px min).
- Glyphs scale down 1 step in font size; whitespace ratios preserved.
- No hover states; rely on tap.

### Empty / loading / error

- **Loading:** ASCII pulse animation (`▱▱▱▱▱` → `▰▰▰▰▰` cycle) center-screen with "syncing feed" subtitle.
- **Empty:** "no events yet · waiting for agents" centered.
- **Error:** "feed disconnected · retrying in 5s" with countdown; auto-reconnect.

## 8. Aesthetic spec

### Color

- **Background:** `#000000` true black.
- **Foreground:** `#ffffff` true white.
- **Muted:** `#888888` for secondary text, timestamps, less-critical glyphs.
- **Accent (semantic, used sparingly):** desaturated amber `#c9a96e` for warnings, highlighted events, live indicators. Roughly 5% of pixels.
- **No** other colors. No gradients. No shadows. No glows.

### Typography

- **Primary:** Geist Mono (preferred) or JetBrains Mono (fallback). Weights 400 + 500 only.
- **Sizes (px, desktop):** 11 (timestamps, glyphs), 14 (body), 16 (event titles), 20 (header wordmark), 28 (page title if any).
- **Sizes (mobile):** scale -1 step (10/13/15/18/24).
- **Line-height:** 1.5 throughout. Letter-spacing default.
- **No system sans fallback.** Monospace is the brand.

### Layout

- **Max content width:** 720px on desktop. Centered. Generous side gutters.
- **Vertical rhythm:** 8px base unit. All spacing in multiples.
- **Borders:** 1px solid `#1a1a1a` (near-black) for card outlines. ASCII glyphs at corners rendered as text overlays.

### Motion

- **New event slide-in:** 200ms, ease-out, slides from top with opacity 0 → 1.
- **Status indicator blink:** 2s cycle, opacity 0.4 ↔ 1.0.
- **Hover (desktop only):** background shifts to `#0a0a0a`, 100ms ease.
- **No** parallax, no scroll-jacking, no auto-playing sound, no notification toasts.

### Glyph vocabulary

| glyph | meaning |
|---|---|
| `●` | live / active |
| `○` | inactive / idle |
| `◐` | partial / in-progress |
| `▣` | agent marker (default) |
| `⌁` | event kind marker |
| `↳` | tx link / continuation |
| `▲ ▼` | up / down (P&L, status changes) |
| `┌─┐│└┘` | box drawing for cards |
| `▱▰` | progress / loading |

## 9. Pellet-the-mascot

- The Pellet mark (`assets/pellet-mark.svg`, white-on-black, modular monogram P) appears in three places:
  1. Top-left of the header chrome.
  2. Inline as the agent glyph next to Pellet's own events in the feed.
  3. Favicon (rendered from the same SVG).
- Pellet is registered as `agents.id = 'pellet'` with `source = 'pellet'` in the database.
- Pellet's behavior in v0: minimal. It can post a small number of "observation" events per day (e.g., "pellet noted: 4 agents active in last hour"). The full Pellet agent personality is a separate downstream design problem.
- The recursive hook ("Pellet watches Pellet") is a brand asset, not a feature to belabor in copy.

## 10. Tech stack

| layer | choice | rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | Vercel-native, Server Components for initial paint, App Router routes match the simple structure. |
| Hosting | Vercel | Already provisioned (project `pellet`). |
| Styling | Tailwind CSS | Fast iteration, monospace + custom palette via tokens. |
| Fonts | Geist Mono via `next/font` | First-party, no external request. |
| DB | Postgres via Neon (Vercel Marketplace) | Cheap, serverless, scales to zero. |
| Cache | Vercel KV (Upstash Redis) | Optional; only if hot-recent-events query becomes a bottleneck. |
| Solana data | Helius Enhanced Webhooks + RPC | Best parsed-event coverage, free tier sufficient for v0. |
| Realtime to client | SSE | Simpler than WebSockets, fine for one-way feed. |
| Cron | Vercel Cron | Hourly registry sync. |
| Analytics | Vercel Analytics | Built-in, no third-party tracker. |

## 11. Roadmap

| version | scope | trigger |
|---|---|---|
| v0 | This spec — feed + ~12 agents + clean aesthetic + mobile/desktop | Ship in 1–2 weekends. |
| v0.5 | Network graph view (toggle), per-agent profile pages, basic search | After v0 has any organic traction (X engagement signal). |
| v1 | Heuristic agent detection (broaden coverage), Pellet's own agent loop, optional auth + saved watchlists, minimal ambient price feed (a small ticker strip for the most-traded tokens by watched agents — context only, not trade-actionable) | After v0.5 if expansion is warranted. |
| v∞ | Absorb adjacent surfaces (capital flows, launches, social) as Solana becomes agent-mediated. The catch-all terminal we deliberately deferred. | Only if v1 succeeds and the agent-mediated thesis is borne out. |

## 12. Open questions (resolve during implementation)

- **Curated allowlist:** who exactly are the ~12 watched agents at launch? Need to research current top-of-mind Solana agents (ai16z, AIXBT-equivalents, GAME, Goat-deployed agents, etc.) and publish the list during impl.
- **Event-kind taxonomy:** the `kind` column is open-ended in the schema. v0 should ship with a fixed enum (~6–8 kinds) and a migration path for adding more.
- **Helius webhook reliability:** confirm Helius's at-least-once delivery; design ingestion to be idempotent on `tx_sig`.
- **Time zone / timestamp display:** local time vs UTC vs relative? Recommend relative for events <24h ago, UTC for older.
- **SEO / share images:** if a share-this-event flow is needed v0, generate an OG image per event with the same aesthetic. Defer if not needed v0.
- **Rate limits:** what happens at burst >10 events/sec (e.g., one agent goes wild)? Throttle UI animations; log all events to DB regardless.

## 13. Non-goals (for the avoidance of doubt)

- Pellet is not a wallet. We do not custody, sign, or initiate transactions.
- Pellet is not a brokerage. We do not execute trades or surface trade-actionable signals. (A minimal ambient price ticker may appear in v1+ as context for what watched agents are trading; it is never sized, charted, or prompted as execution.)
- Pellet is not a social network. Comments, follows, likes are out of scope.
- Pellet is not an analytics platform. We don't compute agent rankings, leaderboards, or scores in v0.
- Pellet is not a launch venue. We don't list new agents on demand; the watched set is curated.
- Pellet is not a mobile app. v0 is responsive web only.

---

## Appendix A — Project context

- Repo `pelletnetwork/pellet` is wiped to README + .gitignore (as of 2026-04-28).
- Vercel project `pellet` exists, empty.
- Domain `pellet.network` owned, currently unattached.
- Prior chapters at `pelletnetwork/pellet-tempo-archive` (private). Not referenced by this design.
- Brand mark exists at `/Users/jake/pellet/assets/pellet-mark.svg` (vectorized 2026-04-29).

## Appendix B — Naming

Pellet is the brand and the mascot. The terminal is "Pellet" — no separate product name. The Pellet agent (the entity that posts in its own feed) is also "Pellet". Singular brand, singular mark.
