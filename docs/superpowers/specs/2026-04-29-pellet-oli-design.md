# Pellet — Open-Ledger Interface (OLI)

**Spec date:** 2026-04-29 (v2 — supersedes `2026-04-29-pellet-agentics-terminal-design.md`)
**Author:** Jake Maynard (@pelletnetwork)
**Status:** Approved for implementation planning
**Domain:** pellet.network
**Repo:** github.com/pelletnetwork/pellet
**Source archive (carry-forward):** github.com/pelletnetwork/pellet-tempo-archive

---

## 0. The unlock

The prior Tempo build (`pellet-tempo-archive`, 424 commits, Apr 13–23 2026) shipped a substantial product called **OLI — Open-Ledger Interface**: SDK, MCP server, REST API, ingestion pipeline, methodology-versioned data with sourceBlock provenance. What it never had was *an actual interface*. OLI was named after a thing that existed only in the backend.

Tonight's "agentics terminal for Solana" spec described that missing interface — but on the wrong chain. The two are the same product. This spec unifies them.

**The product is OLI. The terminal is OLI's interface. Tempo is the chain that makes the name make sense.** The Solana cross-chain story still happens, deliberately, as v0.5+.

## 1. Product summary

Pellet OLI is the canonical interface for autonomous agent activity on Tempo (and, downstream, every chain that matters for agents). A clean monospace web terminal that watches agents operate in real time, backed by a methodology-versioned data layer with on-chain provenance for every measurement.

It is not a trading tool. Not a wallet. Not a generic block explorer. It is a watchable, sharable, re-verifiable surface for what autonomous agents are actually doing on the open ledger.

The product's name is its thesis. Open ledger → interface for it.

## 2. Continuity with the archive

This is not a fresh start — it's the completion of OLI. Specific assets carry forward from `pellet-tempo-archive`:

| Archive asset | Reuse in this build |
|---|---|
| `lib/ingest/{event-processor,peg-sampler,fee-decoder,flow-anomaly-detector,holder-snapshot-builder,health-monitor,cron-wrapper}.ts` | Adapt patterns for agent event ingestion. |
| Drizzle migrations 0001–0010 (events, holders, webhooks, risk, reserves, flow anomalies, health checks, cron runs, address labels, history snapshots) | Most port directly with minor schema additions for agent_id / agent context. |
| `app/api/v1/{addresses,system,health,tokens,webhooks}` | Reusable as-is; extend with `/agents` and `/feed`. |
| `app/api/cron/*` (15 endpoints) | Pattern reusable; reduce v0 to a smaller subset (event-ingest, agent-registry-sync, pellet-tick). |
| `sdk/src/{index,types}.ts` (`@pelletfi/sdk`) | Republish under unified package; extend with agent endpoints. |
| `mcp-server/src/{client,index}.ts` (`@pelletfi/mcp`) | Same — extend with agent tools. |
| `lib/{rpc,labels,source,reproducibility,types}.ts` | Drop in. Reproducibility is the core OLI discipline (sourceBlock + methodologyVersion). |
| `components/{HeroTerminal,Terminal,Nav,Footer,Search,StatsBar,TokenCard,PixelIcon,SafetyBadge,BriefingDocument}.tsx` | Reusable; reskin to current aesthetic where needed. |
| `lib/stripe.ts`, MPP integration | Carry-forward if/when paid tiers re-enter scope (deferred from v0). |
| Brand mark (navy blocky-tile P → now black/white variants in `/Branding/`) | Already in current repo. |

What we *don't* carry forward:
- TIP-403 admin-specific pipeline (stablecoin-issuer concern, not agent-relevant)
- Fee-economics page + decoder (deferred)
- Stablecoin-editorial copy (deferred)
- The marketing pages tuned for "stablecoin intelligence" framing — replace with the agent-interface framing

## 3. Thesis

- The most consequential blockchain activity over the next 5 years is autonomous (agent-driven, not human-keyboarded).
- Agents that handle real economic activity will live on payments-grade rails — sub-cent fees, sub-second finality, predictable settlement. Tempo is built for exactly that. Stripe-backed institutional plumbing pulls in the agents that Solana's ecosystem repels (corporate treasuries, B2B autonomous payment agents, machine-to-machine commerce).
- Loud-and-fast crypto has agents-as-characters; payments-grade crypto will have agents-as-economic-actors. The latter is the bigger market and currently under-served on the data side.
- A canonical interface for that activity — block-pinned, methodology-versioned, re-verifiable — is the data layer for the next era. Pellet OLI is positioned to be that.

## 4. Scope

### In scope (v0)

- Live activity stream of agent events on Tempo, sourced from the ingestion pipeline.
- Curated allowlist of ~12 watched agents at launch (research pass during impl, leveraging prior Tempo address labels in `lib/labels.ts` from the archive).
- Pellet itself as one of the watched agents (recursive on-brand hook; Pellet was already a Tempo-native entity in the archive).
- Methodology-versioned events: every card carries `sourceBlock` + `methodologyVersion` accessible in detail view.
- Desktop + mobile, both first-class.
- Public, no auth.
- Clean monospace aesthetic per §8.
- Hero video + brand mark already in repo.

### Out of scope (v0)

- Cross-chain coverage (Solana, Hyperliquid, Base) — deferred to v0.5+.
- Trading, swaps, wallet actions.
- Authentication, accounts, paywalls.
- Native mobile app.
- On-chain Pellet token, points, or economy.
- Pellet's own agent personality / behavior loop (deferred — its own design problem).
- Heuristic agent detection (defer; v0 is curated/registry-only).
- Network graph view (v0.5).
- Per-agent profile pages (v0.5).
- Stripe billing + paid API tiers (deferred — re-enter when there's an audience to charge).
- The OLI MCP server + SDK republish (deferred to v0.5 — the interface comes first; the developer surface follows).

## 5. Audience

### Day-one (v0)

- **Tempo-native builders, operators, ecosystem participants.** Smaller audience than CT, but they're already on the chain and care about what's happening on it.
- **Crypto-Twitter via clips.** We post agent-activity clips to X. The audience that watches isn't expected to *be* on Tempo — they're expected to find the content interesting and learn that this is what agents-on-payments-rails looks like. Education becomes part of distribution.

### Secondary (v0.5+)

- **Solana agent-narrative audience** (ai16z, Virtuals, Goat, AIXBT-adjacent). Bridged when cross-chain coverage ships.
- **Institutional / Stripe-curious orgs** watching agent payment flows. Particularly relevant as Tempo onboards Fortune 500 use cases.

### Anti-audience

- Day traders looking for execution tools — go to whatever Tempo's Photon-equivalent becomes.
- Devs needing raw chain data — they have the SDK + MCP (v0.5).

## 6. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (desktop + mobile)                                  │
│  Next.js 16 App Router · Tailwind v4 · Iosevka mono          │
│  ─ Live feed view (vertical stream)                          │
│  ─ SSE for real-time push                                    │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│  Vercel Functions (Node runtime)                             │
│  ─ /api/feed              (SSE stream of recent events)      │
│  ─ /api/agents            (list of watched agents)           │
│  ─ /api/v1/*              (REST surface, ported from archive)│
│  ─ /api/cron/event-ingest (Tempo RPC poller, every N sec)    │
│  ─ /api/cron/pellet-tick  (hourly Pellet observation)        │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│  Postgres (Vercel Marketplace · Neon) · Drizzle ORM          │
│  ─ agents       (id, label, source, wallets, bio, links)     │
│  ─ events       (id, agent_id, ts, kind, summary, tx, raw,   │
│                  source_block, methodology_version)          │
│  ─ Optional: ports of the archive's risk / health / etc.     │
└──────────────────────────────────────────────────────────────┘
                             ↑
                             │
┌──────────────────────────────────────────────────────────────┐
│  Ingestion (ported from archive)                             │
│  ─ Tempo RPC + indexer endpoints                             │
│  ─ event-processor (Tempo events → normalized rows)          │
│  ─ holder-snapshot-builder (active agents tracking)          │
│  ─ flow-anomaly-detector (highlight outlier activity)        │
│  ─ health-monitor (operational visibility)                   │
└──────────────────────────────────────────────────────────────┘
```

### Runtime characteristics

- **Real-time latency target:** event lands in feed ≤10 seconds after Tempo block finality.
- **Throughput target (v0):** ≤5 events/second across watched agents.
- **Cold-start tolerance:** acceptable; first paint shows last-100 events from cache, SSE takes over.

## 7. Data model

Extends the archive's schema (Drizzle migrations 0001–0010) with agent-specific columns. New v0-critical tables:

### `agents`

| field | type | notes |
|---|---|---|
| `id` | text PK | slug (`pellet`, etc.) |
| `label` | text | display name |
| `source` | text | `curated` / `pellet` / future: `registry:*` |
| `wallets` | text[] | Tempo addresses associated with this agent |
| `bio` | text | one-line description |
| `links` | jsonb | optional X handle, site, framework links |
| `created_at` | timestamptz | |
| `active` | boolean | |

### `events` (extends archive's events table)

| field | type | notes |
|---|---|---|
| `id` | bigserial PK | |
| `agent_id` | text FK → agents | matched during ingestion |
| `ts` | timestamptz | block time |
| `kind` | text | `swap` / `transfer` / `mint` / `program_call` / `tip20` / `payment` / `attest` / `custom` |
| `summary` | text | human-legible one-liner |
| `targets` | jsonb | structured targets (counter-agents, tokens, programs) |
| `tx_sig` | text | Tempo tx hash |
| `source_block` | bigint | OLI provenance — block height the data was sourced from |
| `methodology_version` | text | OLI provenance — which version of our normalization produced this row |
| `raw` | jsonb | full event payload (for debugging + future re-rendering) |
| `created_at` | timestamptz | |

UNIQUE constraint on `(tx_sig, agent_id, kind)` for idempotency.

Trigger fires NOTIFY on insert for SSE bus consumption.

## 8. Components (UI)

(Largely unchanged from v1 spec; reframed for OLI.)

### Feed view (`/`)

Single column primary surface; right sidebar (360px on desktop) for the hero video. Vertical scroll; new events slide in at top. Virtualized after ~500 events.

### Event card

Same shape as v1 spec — timestamp + kind glyph header, agent + summary body, tx link footer. Pellet-authored events render the actual mark inline as the agent glyph.

**OLI-specific addition:** subtle hover-state surfaces the OLI provenance (`source_block: 15,348,871 · methodology: v2.1`). On-chain receipt energy. Reinforces the "every measurement is verifiable" brand.

### Header

`pellet // open-ledger interface · tempo` (was `agentics terminal · sol`). Mark + wordmark left, status indicator + agent count right.

### Mobile

Same feed, single column, edge-to-edge. Hero video stacks below.

### Empty / loading / error

- **Loading:** ASCII pulse animation + "syncing feed"
- **Empty:** "no events yet · waiting for agents"
- **Error:** "feed disconnected · retrying in Ns"

## 9. Aesthetic spec

Unchanged from v1. Pure mono palette + muted amber accent. Iosevka. ASCII glyphs. Generous whitespace despite density. See v1 spec §8 for full details — preserved verbatim in the superseded spec file.

## 10. Pellet-the-mascot

Even more coherent under OLI framing. Pellet was already a Tempo-native entity in the archive (had its own brand handle, marketing presence, npm packages). Now:

- Pellet appears as the brand mark in the header chrome (top-left).
- Pellet is registered as `agents.id = 'pellet'` with `source = 'pellet'`.
- Pellet's actions appear in the feed alongside other agents, rendered with the actual mark inline.
- v0 Pellet behavior: minimal "observation" events ("pellet noted: 4 agents active in last hour"). The full Pellet personality is downstream.
- The recursive hook ("Pellet watches Pellet on Pellet") is a brand asset, not a feature to belabor in copy.

## 11. Tech stack

| layer | choice | rationale |
|---|---|---|
| Framework | Next.js 16 App Router | Already scaffolded; matches archive's stack |
| Hosting | Vercel | Already provisioned (project `pellet`) |
| Styling | Tailwind v4 | Already wired |
| Fonts | Iosevka via @fontsource | Already wired |
| DB | Postgres via Neon (Vercel Marketplace) | Matches archive's stack |
| ORM | Drizzle | Matches archive — migrations port directly |
| Cache | Vercel KV (Upstash) | Optional, only if hot-recent-events becomes a bottleneck |
| Tempo data | RPC via Chainstack/Alchemy + ingestion pipeline ported from archive | Re-use the archive's `lib/rpc.ts`, `lib/source.ts` |
| Realtime to client | SSE | Same as v1 |
| Cron | Vercel Cron | Same |
| Analytics | Vercel Analytics | Same |

## 12. Roadmap

| version | scope | trigger |
|---|---|---|
| **v0** | This spec — feed + ~12 Tempo agents + hero + clean mono aesthetic + mobile/desktop | Ship in 2 weekends (slightly longer than original v1 estimate due to ingestion porting). |
| **v0.5** | Cross-chain Solana coverage. Network graph view. Per-agent profile pages. Re-publish `@pelletfi/sdk` + `@pelletfi/mcp` against the unified API. | After v0 has any organic traction (X engagement, Tempo ecosystem mentions). |
| **v1** | Heuristic agent detection (broader coverage). Pellet's own agent loop. Optional auth + saved watchlists. Minimal ambient price ticker (context only, never trade-actionable). Hyperliquid coverage (port from the archive's HL Phase 1 work). | After v0.5 if expansion is warranted. |
| **v2** | Re-introduce paid tiers (Stripe billing from archive). MPP integration for agents to pay for premium feed slots. | After v1 if there's demonstrated demand. |
| **v∞** | OLI absorbs adjacent surfaces (capital flows, launches, identity, payments, reputation) on every chain that matters. The OLI brand becomes the canonical "watch what agents are doing" lens across crypto. | Long-term. |

## 13. Open questions (resolve during impl)

- **Curated agent allowlist:** which ~12 Tempo agents at launch? Mine the archive's `lib/labels.ts` + `data/` for known wallets; supplement with current research.
- **Tempo RPC provider:** Chainstack vs. Alchemy vs. self-hosted node — pick during Task 6.
- **Event-kind taxonomy:** v0 ships with a fixed enum derived from archive's event types; new kinds added via migration.
- **Indexer dependency:** does the prior build's ingestion pipeline rely on an external Tempo indexer service (e.g., a `helius`-equivalent), or pure RPC polling? Verify during port.
- **Agent identification heuristics:** the archive had address-labels infrastructure; figure out which labels qualify a wallet as an "agent" vs a regular Tempo user.
- **Provenance display:** how prominently to surface `source_block` + `methodology_version` in the UI. v0 leans subtle (hover); could surface more loudly later.
- **Cross-chain readiness:** when v0 schema lands, ensure event tables have a `chain` column (default `tempo`) so v0.5 cross-chain expansion doesn't require migration pain.

## 14. Non-goals (explicit)

- Pellet is not a wallet. We do not custody or sign.
- Pellet is not a brokerage. No trade-actionable signals. (Minimal ambient price ticker may appear in v1+ as context only.)
- Pellet is not a social network. No comments, follows, likes.
- Pellet is not a launchpad. We've been here before — Pellet won't surface tokens in a way that picks winners or curates for fee extraction.
- Pellet is not a mobile app. v0 is responsive web only.
- Pellet is not abandoning Solana — it's deferring it. Cross-chain is in the roadmap. v0 is Tempo-primary because the product's name and infrastructure are already there.

---

## Appendix A — Project context

- Repo `pelletnetwork/pellet` is the new home (was wiped 2026-04-28; new build began 2026-04-28/29).
- Vercel project `pellet` exists.
- Domain `pellet.network` owned, currently unattached.
- Brand mark in `assets/pellet-mark.svg` + `/Branding/` (clean Illustrator source).
- Hero video in `public/hero.mp4`.
- Prior Tempo build at `pelletnetwork/pellet-tempo-archive` (private, archived) — actively referenced for code carry-forward. See §2.

## Appendix B — Naming + positioning

- **Pellet** is the brand. The agent. The mark. The umbrella.
- **OLI (Open-Ledger Interface)** is the product line. The terminal is its first interface; SDK + MCP are its developer surfaces.
- Header reads `pellet // open-ledger interface · tempo`. When cross-chain ships, becomes `pellet // open-ledger interface` (chain context surfaces per-event).
- The Pellet-as-agent and Pellet-as-product overlap is intentional. Pellet runs in the system it shows.

## Appendix C — Why not just stay on Solana

For the record, we considered Solana-primary (v1 of this spec) and rejected it because:

1. **The product's name was its thesis** — OLI on Tempo. Solana-primary required either renaming the product or making the name a generic concept divorced from its origin.
2. **The data infrastructure already exists** for Tempo. ~80% of the archive's ingestion patterns + schema ports forward without rewrite.
3. **The chain narrative aligns** — Tempo is built for machine payments; agents are machines; agents-on-payments-rails is the durable thesis.
4. **The audience-building tax is real but worth paying** — being canonical on the right chain beats being seventh-best on a crowded one.
5. **The launchpad incident is a footnote** — not the chain's fault. Strategic conviction won out over the wound. We're not going back to Tempo to settle a score; we're going because the product was already there.

Cross-chain to Solana remains in the roadmap (v0.5+) — bridged from a position of strength rather than dependent on Solana for distribution.
