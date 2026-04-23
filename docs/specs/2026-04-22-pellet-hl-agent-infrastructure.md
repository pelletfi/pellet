# Pellet on Hyperliquid — Agent Infrastructure Layer

**Date:** 2026-04-22
**Status:** Design approved, implementation pending
**Author:** Jake (founder) + Claude (design partner)

## Summary

Pellet expands from "TIP-20 Intelligence Layer on Tempo" to "agent infrastructure layer for on-chain finance, starting on Hyperliquid." Tempo stays on maintenance mode; active build shifts to HL. Brand refresh lands alongside this expansion.

The product is middleware that AI agents trading on Hyperliquid use to place orders, mint verifiable identities, and accrue public reputation. Revenue comes from HL's native builder-code fee rail on routed order flow, with HIP-3 deployer services as an adjacent revenue stream.

## Positioning

**"Pellet — the agent infrastructure layer for Hyperliquid. Identity, execution, accountability."**

Three-word shorthand: **Identity. Execution. Accountability.**

- **Identity** — every autonomous agent on HL mints a Pellet-issued ERC-8004 ID. Portable across platforms.
- **Execution** — agents call Pellet's SDK to execute intents on HL. Pellet's CoreWriter router attaches a builder code and returns block-pinned settlement receipts.
- **Accountability** — every intent → execution → settlement is logged on-chain and tied to the agent's ID. Reputation accrues from attested outcomes, readable by any platform.

The Stripe parallel: Stripe = payment infrastructure for internet commerce; Pellet = agent infrastructure for on-chain finance.

## Why this positioning

Validated by two rounds of research (ecosystem scan + protocol deep-read) and volume analysis:

1. **Blue ocean.** Agent trading products (Senpi, NickAI, Katoshi, HyperAgent, Based) are user-facing frontends. Pellet is the infrastructure layer beneath them. Senpi/NickAI become customers, not competitors. No direct incumbent on the middleware layer.
2. **HL primitive fit.** HL's API wallets, CoreWriter, and builder codes were designed for this role. CoreWriter at `0x3333...3333` is the precompile an intent SDK should compile down to.
3. **Trend-following bet.** Agent-originated volume grew 0 → ~$200M/day in ~100 days (2-4% of HL total). Binance baseline is 65%. Headroom is real; being the default identity layer before HIP-4 mainnet is the window.
4. **Leverages Pellet's existing assets.** SDK publishing, MCP tooling, x402 micropayment experience, block-pinned indexer discipline all transfer. No new category learning curve.
5. **Escapes the "measurement company" trap.** Hero products are *action* (execute) and *registry* (identity), not *analysis*. Measurement becomes adjunct (reputation feeds), not headline.

## What this explicitly isn't

- Not another analytics dashboard (HypurrScan, Hyperdash already crowded)
- Not a user-facing AI trading agent (Senpi, NickAI compete there with funded teams)
- Not an oracle provider (RedStone/HyperStone ahead, capital-intensive)
- Not a full deployer ops business *initially* (deferred to Phase 3 if HIP-3 traction warrants)
- Not custody (Pellet does not hold user API wallet keys; user-held keys + Pellet SDK orchestration)

## Product scope — stair-step

### Phase 1 — Weeks 1-4: Identity + receipts (free/open-source)

**Goal:** become the default agent identity layer. Revenue: $0.

**Ships:**
- ERC-8004 registry contracts on HyperEVM — Identity, Reputation, Validation
- Public registry dashboard at `pellet.fi/hl` showing agent list + public attestations
- TypeScript SDK for minting IDs and reading reputation
- MCP server with 4-5 core tools (mint_id, read_reputation, attach_attestation, query_agents)
- Canonical "Building Agents on Hyperliquid" guide (long-form editorial content)
- Brand v2 launched on this surface — IBM Plex Mono + Inter typography, blocky-P mark, deep saturated blue palette

**Open-source everything** — the reference implementation play. Contracts, SDK, MCP are all MIT licensed. Pellet becomes the standard because there's nothing to compete against.

### Phase 2 — Weeks 5-12: Execution routing (builder-code capture)

**Goal:** meaningful routed volume. Revenue: builder code fees on routed flow.

**Ships:**
- CoreWriter router contract that attaches Pellet's builder code to every routed order
- SDK extensions: `pellet.openPosition()`, `pellet.hedgeExposure()`, `pellet.rebalanceVault()`, `pellet.closeIf()`
- Block-pinned settlement receipts attached to agent IDs
- At least 1 integration partnership live (Senpi, NickAI, HyperAgent, Katoshi, or Based)
- Public dashboard of routed flow + reputation leaderboard

**Revenue mechanics:** HL builder codes pay up to 0.1% on perps, 1% on spot per-order. HL handles accounting; Pellet just collects. At $10M/day routed, Pellet earns $10K/day passively.

### Phase 3 — Months 4-12: Expand or pivot based on signal

**Conditional:**
- IF agent volume compounds → deeper middleware features (risk gates, policy engines, multi-agent coordination)
- IF HIP-4 prediction markets launch mainnet → extend identity + receipts to HIP-4 agents
- IF HIP-3 deployer relationships materialize → add deployer ops stack as adjunct product
- IF none of the above → reassess, consider fundraise or narrower focus

## Parallel during Phase 1 (critical)

Building the product without shipping distribution is how solo founders fail.

- Outreach to Senpi, NickAI, HyperAgent, Katoshi, Based founders within week 1
- Target: 2-3 committed design-partner integrations before Phase 2 launches publicly
- Canonical "Building Agents on HL" guide as content anchor (drives organic discovery)
- Ecosystem touchpoints: HypurrCo ecosystem listing, AwesomeHyperEVM PR, Hyper Foundation (no formal grants but awareness matters)

**Do not lock in Phase 2's 2-month build before at least one partnership signal.** If no platform commits by week 4-6, pull back and reassess.

## Tempo posture during HL focus

Lights-out — Tempo is fully archived.

- Repo moved to `github.com/pelletnetwork/pellet-tempo-archive` (private + archived)
- All Vercel cron pipelines removed from that repo's vercel.json (lights-out commit)
- SDK @pelletfi/sdk + MCP @pelletfi/mcp remain published on npm but receive no updates
- Briefings + MPP endpoints no longer refresh; site is frozen-at-last-deploy until takedown
- Data in Neon DB stays as cold storage
- If DoorDash-scale enterprise stablecoin flows materialize on Tempo (6-12 month horizon), reassess whether to resurrect

**Tempo ongoing cost:** $0/mo (everything off; Neon cold, npm free, repo private).

## Technical stack

### Repository

- **Standalone monorepo:** `pelletnetwork/pellet` at `/Users/jake/pellet/`
- **Structure:** `apps/web/` (Next.js 16 App Router) + `packages/hl-contracts/` (Foundry) + future `packages/hl-sdk/` + `packages/hl-mcp/`
- **HL code tree:** `apps/web/app/hl/` (dashboard routes), `apps/web/lib/hl/` (client + types + indexers), `apps/web/components/hl/` (UI components)
- **No Tempo code in this repo** — Tempo lives in a separate archived repo (`pelletnetwork/pellet-tempo-archive`). No cross-repo imports to worry about.

### Contracts (HyperEVM)

- `IdentityRegistry.sol` — ERC-8004 Identity registry for agents
- `ReputationRegistry.sol` — ERC-8004 Reputation tracker
- `ValidationRegistry.sol` — ERC-8004 Validation attestation
- `BuilderCodeRouter.sol` — CoreWriter-based router that attaches Pellet's builder code to routed orders
- Deployed to HyperEVM mainnet (after audit in Phase 1)
- Open source, MIT license, audited by Phase 1 end

### Indexer

- Cron pipeline at `apps/web/app/api/cron/hl-*` (Vercel crons)
- Indexes:
  - HyperEVM events from the registry contracts (mints, attestations, validations)
  - HL L1 settlement data via HL's public API (for receipt generation)
  - Builder-code fee accruals (for revenue tracking)
- Fresh Postgres tables: `hl_agent_ids`, `hl_attestations`, `hl_routed_orders`, `hl_receipts`
- Dedicated Neon project "pellet-hl" — separate from Tempo's (archived) Neon

### SDK

- New npm package: `@pellet/hl` (published under rebrand; exact name tbd)
- TypeScript-first, ergonomic API for agent developers
- Core methods: `mintAgentId()`, `openPosition()`, `hedgeExposure()`, `readReputation()`, `attachAttestation()`
- Minimal dependencies; works in Node, browser, Deno, edge runtimes

### MCP server

- New npm package: `@pellet/hl-mcp` (name tbd)
- Core tools: `pellet_hl_mint_agent`, `pellet_hl_open_position`, `pellet_hl_read_reputation`, `pellet_hl_attest_outcome`, `pellet_hl_query_agents`
- Auto-discoverable in MCP registries (Claude, Cursor, etc.)

### Dashboard

- `apps/web/app/hl/` route tree in the Next.js app
- Pages:
  - `/hl` — main registry landing, public agent list, reputation leaderboard
  - `/hl/agent/[id]` — per-agent profile: attestations, routed history, reputation score
  - `/hl/platforms` — integration partners + adoption stats
  - `/hl/docs` — canonical "Building Agents on Hyperliquid" guide
  - `/hl/receipts/[tx]` — public settlement receipt page
- Fully static where possible (ISR), server-rendered where needed

## Brand application on HL surfaces

### Typography (locked)

- **IBM Plex Mono** — headlines, titles, chrome, monospace details (replaces Geist Mono)
- **Inter** — body, UI labels, CTAs (replaces Geist Sans)
- No serif layer (Instrument Serif removed from HL surfaces)

### Palette (locked 2026-04-22 from delivered brand assets)

Primary:
- **Pellet Navy** — `#00006D` (delivered mark color, SVG source + designer preview pages)
- **Paper** — `#E8F1F3` (cool pale, very faint cyan lean — paired bg in designer preview pages)
- **White** — `#FFFFFF` (card/panel surfaces; inverted mark fill)
- **Ink** — `#000000` (primary text on paper)

Secondary accents (from NET-inspired system, used sparingly):
- System Green `#34C759` (positive signals: successful executions, confirmed attestations)
- Sky `#70BBFF`, Steel `#8FA2B5`, Cloud `#E6E6E6`, Leaf `#606644`, Sand `#F2E9D8`

### Mark

- Blocky-tile P delivered 2026-04-22 by Logo Branda. Full rights transferred (modify + distribute without restriction).
- Source files in repo at `apps/web/public/brand/`:
  - `pellet-mark.svg` — primary navy on paper
  - `pellet-mark-white.svg` — inverted for dark surfaces
  - `pellet-mark.png` — raster reference
  - `copyright-transfer.pdf` — ownership agreement

### Visual language

- Pixel-art / BBS / DOS aesthetic accents
- Deep saturated blue backgrounds (not neutral dark gray)
- Nature photography juxtaposed with digital chrome where appropriate
- Monospace details, bold headlines, clear CTAs
- Clean editorial grid layout

### Thematic spine

"The world is not binary. It's both digital and natural. Agents are digital entities acting in the real world; their actions have real consequences. Pellet tethers the digital back to the real — verifiable, measurable, accountable."

## Monetization

### Primary revenue: builder-code fees

- Pellet owns a builder code on HL
- Every order routed through Pellet's CoreWriter router auto-attaches the code
- HL pays Pellet up to 0.1% of perp trades, 1% of spot trades
- HL handles accounting; claims via HL's referral endpoint
- Zero billing infrastructure required

**Volume → revenue math:**

| Daily routed volume | Annual revenue @ 0.1% |
|---|---|
| $1M | $365K |
| $10M | $3.65M |
| $100M | $36M |

### Secondary revenue: HIP-3 deployer stack (Phase 3 conditional)

- Platform fee + revenue share on HIP-3 deployer markets
- Only pursued if deployer-partnership signal emerges during Phase 2
- Expected $15-65K MRR per deployer if it lands

### Tertiary revenue: Pro dashboards

- Free public reputation dashboards
- Pro tier ($49-199/mo) for historical replays, custom alerts, drilldowns
- Minor revenue; mostly lead-gen for partnership conversations

## Success metrics + kill criteria

| Milestone | Week | Success signal | Failure signal |
|---|---|---|---|
| Phase 1 launch | 4 | Registry live, 1+ platform in integration conversation | Zero outreach responses |
| Phase 2 start | 5-8 | 1 integration in progress, public "Building Agents" guide published | No partnership commitments by week 6 |
| First routed flow | 12 | >$1M/day routed, 2+ live integrations | <$100K/day, 0 integrations |
| Six-month | 24 | Top-3 platform (Senpi/NickAI/Based) integrated, $20-50K MRR | <$5K MRR, no top-3 platform |
| Twelve-month | 48 | Category-leader positioning, $100-300K MRR, or clear fundraise signal | Below $20K MRR, no strategic traction |

**Kill criteria (pull back if):**
- Month 2: zero agent platform integrations despite outreach
- Month 4: less than $500K/day routed volume
- Month 6: no top-3 platform committed, MRR < $5K

## Fund deployment

Minimal new capital required for Phase 1:

| Item | Cost |
|---|---|
| HyperEVM mainnet deployment gas | $50-100 |
| Contract audit (Phase 1 registry + router) | $5-15K (strongly recommended before mainnet) |
| Domain/DNS (if using subdomain) | ~$20/mo |
| Existing Vercel + Neon | Covered by current budget |

**Total Phase 1 capital need:** ~$5-15K (primarily audit).

Phase 2 ongoing: passive builder-code revenue should cover infrastructure costs within 8-12 weeks if routed volume hits $1M+/day.

No venture capital raised or required for Phase 1-2. Pre-seed fundraise possible at Month 6 if traction materializes ($20-50K MRR + top-3 platform integration = credible seed pitch).

## Runway assumptions

- **Founder runway:** 12 months committed to full-time build
- **Tempo cash flow:** Pellet Pro at $49/mo + MPP endpoints continue as secondary income stream
- **Milestone for extension:** Month 6 traction signals determine whether to raise seed round or extend runway via revenue

## Timeline

| Week | Deliverable |
|---|---|
| 1 | Spec + implementation plan committed. Contracts scaffolded. Outreach begins to 5 target platforms. |
| 2 | ERC-8004 contracts deployed to HyperEVM testnet. SDK skeleton published. |
| 3 | MCP server working. Basic registry dashboard at `apps/web/app/hl`. First partnership conversation booked. |
| 4 | Phase 1 public launch. Contracts mainnet (post-audit). "Building Agents" guide published. Public X announcement. |
| 5-8 | CoreWriter router shipped. Execution SDK methods. First integration partner work begins. |
| 9-12 | Execution routing live. Routed volume starts. Phase 2 partnership integrations shipping. |
| 13-24 | Iterate on distribution + integration partnerships. Revenue ramps. |
| 25-48 | Phase 3 decisions based on signal. Consider HIP-3 deployer stack, HIP-4 extensions, or fundraise. |

## Open questions (not blocking spec approval)

- Exact blue hex value — finalize with brand asset delivery
- Exact npm package names — depends on whether "Pellet" domain/npm-scope changes in rebrand
- Integration partner priority — target Senpi first (biggest volume) or smaller platform first (faster to ship)?
- Audit firm selection — Certora, OpenZeppelin, Spearbit, or a solo auditor?
- Builder code registration timing — register early to reserve Pellet's code ID, or after Phase 2 router ships?

## References

### Research basis
- Ecosystem gap research (agent #1) — first-pass survey, 2026-04-22
- HL protocol primitives deep read (agent #2) — technical validation, 2026-04-22
- Agent volume analysis (agent #3) — quantitative sizing, 2026-04-22

### HL documentation
- [Hyperliquid Docs](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [HIP-3 builder-deployed perpetuals](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals)
- [Builder codes](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes)
- [CoreWriter interaction](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore)
- [API wallets](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets)

### ERC-8004 references
- [ERC-8004 Developer Guide (QuickNode)](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- [Integrating ERC-8004 into Hyperliquid (Liu, 2026)](https://medium.com/@gwrx2005/integrating-erc-8004-trustless-agents-and-openclaw-into-dydx-hyperliquid-lighter-and-uniswap-9bfa6d4b608b)

### Competitive landscape
- [Senpi launch (The Defiant)](https://thedefiant.io/news/press-releases/senpi-launches-the-first-personal-trading-agents-for-hyperliquid)
- [Based $11.5M Series A (The Block)](https://www.theblock.co/post/390809/hyperliquid-web3-based-funding-pantera)
- [NickAI agentic OS (Decrypt)](https://decrypt.co/360904/nickai-launches-first-agentic-trading-operating-system)
- [HL Frontend Wars (Blockworks)](https://blockworks.com/news/hyperliquid-the-frontend-wars)
