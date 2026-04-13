# Pellet on Tempo — v1 Design Spec

> The intelligence layer for Tempo. Tokens, stablecoins, compliance, and the machine economy — made legible.

## Context

Tempo is a Stripe/Paradigm-backed L1 (chain ID 4217, mainnet March 18, 2026). 25 days old, ~385 tokens, $170K daily volume, 12 stablecoins, 88+ MPP services, $43M settled. No DexScreener support, no native token explorer, no chain intelligence tooling beyond a basic block explorer and Peon (API-only token safety scanner at $0.06/scan).

Pellet becomes the intelligence layer for the chain — not a token scanner, but the product that makes Tempo's unique architecture legible. Tokens are one lens. Stablecoins, compliance policies, and flows are the others.

## Product Surfaces

### Surface 1: Tokens

The DexScreener that Tempo doesn't have.

**`/` (Landing + Token Feed)**
- Minimal hero: "Pellet — intelligence for Tempo"
- Token feed below: new tokens, trending by volume, searchable
- Data source: GeckoTerminal `/networks/tempo/pools` + `/networks/tempo/tokens`

**`/token/[address]` (Token Detail)**
- Market: price, 24h volume, liquidity, FDV, price chart (OHLCV from GeckoTerminal)
- Pools: breakdown across enshrined DEX / Uniswap v2/v3/v4, reserve sizes
- Safety (free): buy/sell simulation via `eth_call`, bytecode analysis (proxy, selfdestruct, blacklist, mint, pause), risk score + flags
- Holders: top holders from Transfer event scanning, concentration (top 5/10/20%), creator holdings
- Compliance: TIP-20 vs ERC-20 type, transfer policy ID + type (whitelist/blacklist/compound), policy admin, pause state, roles (ISSUER, PAUSE, BURN_BLOCKED), supply cap + headroom
- Deployer: address, wallet age, prior tokens deployed

**`/token/[address]/briefing` (Deep Briefing — MPP-paid $0.05)**
- Origin trail: deployer funding source, hop analysis, labeled exchange/protocol attribution
- Full holder analysis: all discovered holders with labels, Gini coefficient, distribution changes
- Compliance deep dive: full policy chain resolution, compound policy decomposition, authorization sampling
- Claude analyst note: synthesized take across all data

### Surface 2: Stablecoins

The thing nobody else is building. Tempo-native intelligence.

**`/stablecoins` (Matrix)**
- All 12 Tempo stablecoins in one view
- Per stablecoin: price vs pathUSD, spread (from enshrined DEX bid/ask), 24h volume, compliance policy type, issuer/admin, supply cap, current supply, headroom %, yield rate (reward APY for opted-in holders)
- Sort/filter by any column

**`/stablecoins/flows` (Flow Matrix)**
- Net directional flows between stablecoin pairs over configurable time windows (1h, 6h, 24h, 7d)
- Visual: heatmap or sankey diagram showing where value is migrating
- De-peg signal: highlight any stablecoin trading >20bps off pathUSD peg
- Flight-to-quality detection: net outflows from one stablecoin correlating with inflows to another

**`/stablecoins/[address]` (Stablecoin Detail)**
- Full compliance posture: policy chain, admin address, role holders (ISSUER, PAUSE, BURN_BLOCKED), `burnBlocked` event history
- Authorization coverage: policy type interpretation, compound policy decomposition
- Supply dynamics: supply cap, current supply, headroom, mint history, burn history
- Reward data: opted-in supply, reward rate, distribution frequency, pending rewards pool
- DEX presence: enshrined DEX orderbook depth (bid/ask ticks, spread), Uniswap pool positions

### Surface 3: API (MPP-paid where noted)

Agents-first from day 1. OpenAPI spec with `x-payment-info` extensions for mpp.dev listing.

**Free endpoints:**
| Endpoint | Description |
|---|---|
| `GET /v1/tokens` | List tokens (paginated, sortable by volume/liquidity/age) |
| `GET /v1/tokens/search?q=` | Search by symbol or address |
| `GET /v1/tokens/[address]` | Market data + safety flags + compliance summary |
| `GET /v1/stablecoins` | Full stablecoin matrix |
| `GET /v1/stablecoins/flows` | Flow data between stablecoin pairs |
| `GET /v1/stablecoins/[address]` | Stablecoin detail (compliance, supply, yield) |

**Paid endpoints (MPP):**
| Endpoint | Price | Description |
|---|---|---|
| `GET /v1/tokens/[address]/briefing` | $0.05 pathUSD | Deep briefing: origin, holders, compliance, analyst note |

**Discovery:**
| Endpoint | Description |
|---|---|
| `GET /openapi.json` | Full API spec with `x-payment-info` + `x-service-info` for mpp.dev |
| `GET /health` | Service status |

### Surface 4: MCP Server

`@pelletfi/mcp` — installable via `npx`. Wraps v1 API. Handles MPP payment automatically via `mppx` client.

**Tools:**
| Tool | Cost | Description |
|---|---|---|
| `search_token` | Free | Search by symbol or address |
| `lookup_token` | Free | Market data + safety flags + compliance |
| `get_stablecoins` | Free | Full stablecoin matrix |
| `get_stablecoin_flows` | Free | Stablecoin flow data |
| `analyze_token` | $0.05 | Deep briefing |

**Install:** `claude mcp add pellet -e EVM_PRIVATE_KEY=0x... -- npx -y @pelletfi/mcp`

Auth: `EVM_PRIVATE_KEY` env var for MPP payments on Tempo.

## Architecture

### Stack

- **Runtime:** Next.js 16 (app router, server components, API routes)
- **Language:** TypeScript (entire codebase)
- **Database:** Neon Postgres (serverless) + Drizzle ORM
- **Payments:** mppx SDK (MPP charge intent)
- **RPC:** viem (native Tempo chain support since v2.43.0)
- **Deploy:** Vercel
- **MCP:** TypeScript, published to npm as `@pelletfi/mcp`

### Directory layout

```
app/                        Next.js app router
  page.tsx                  Landing + token feed
  token/[address]/
    page.tsx                Token detail
    briefing/page.tsx       Deep briefing (MPP-gated)
  stablecoins/
    page.tsx                Stablecoin matrix
    flows/page.tsx          Flow matrix
    [address]/page.tsx      Stablecoin detail
  api/v1/
    tokens/                 Token API routes
    stablecoins/            Stablecoin API routes
    health/route.ts         Health check
  layout.tsx                Root layout (Geist Sans/Mono, dark theme)
  globals.css               Tailwind v4

lib/
  pipeline/                 Data aggregators
    market.ts               GeckoTerminal: price, volume, pools, OHLCV
    safety.ts               eth_call buy/sell sim + bytecode pattern matching
    holders.ts              Transfer event scanning → holder list + concentration
    origin.ts               Deployer detection, funding trail via tx history
    compliance.ts           TIP-403 policy resolution, role enumeration, pause state
    identity.ts             CoinGecko + DefiLlama protocol matching
    stablecoins.ts          Stablecoin matrix: spread, flows, yield, supply cap
    evaluation.ts           Claude Sonnet synthesis (paid tier only)
  mpp/
    middleware.ts           mppx charge middleware for API routes
    config.ts               Recipient address, pricing, currency (pathUSD)
  rpc.ts                    viem client for Tempo (chain 4217)
  gecko.ts                  GeckoTerminal API client
  db/
    schema.ts               Drizzle schema
    index.ts                Neon connection

mcp-server/                 @pelletfi/mcp source
  src/
    index.ts                MCP server entry
    tools.ts                Tool definitions (search, lookup, analyze, stablecoins)
    client.ts               HTTP client wrapping v1 API + mppx for payments
  package.json

openapi.json                Generated OpenAPI spec with x-payment-info
```

### Data pipeline

Each aggregator is a pure async function: address in, structured data out. No shared state between aggregators.

```
Token detail page:
  market.ts      → GeckoTerminal API (cached 60s)
  safety.ts      → Tempo RPC eth_call simulations (computed per request, cached 5min)
  holders.ts     → Tempo RPC eth_getLogs Transfer events (cached 10min)
  compliance.ts  → Tempo RPC TIP-20 + TIP-403 calls (cached 10min)
  identity.ts    → CoinGecko + DefiLlama (cached 1hr)

Deep briefing (paid):
  origin.ts      → Alchemy/RPC tx history (computed fresh)
  holders.ts     → Full scan, no cache
  compliance.ts  → Full policy chain resolution
  evaluation.ts  → Claude Sonnet 4.6 synthesis

Stablecoin matrix:
  stablecoins.ts → RPC calls to all 12 TIP-20 contracts + enshrined DEX (cached 30s)

Stablecoin flows:
  stablecoins.ts → eth_getLogs Transfer events between stablecoin pairs (cached 5min, hourly aggregation persisted to DB)
```

### Database schema

```sql
-- Cached token data (refreshed on access, TTL-based)
CREATE TABLE tokens (
  address TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  token_type TEXT, -- 'tip20' or 'erc20'
  decimals INT,
  market_data JSONB,
  safety JSONB,
  holders JSONB,
  compliance JSONB,
  identity JSONB,
  updated_at TIMESTAMPTZ
);

-- The 12 TIP-20 stablecoins (seeded, refreshed every 30s)
CREATE TABLE stablecoins (
  address TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  currency TEXT, -- ISO 4217 (USD, EUR)
  issuer_admin TEXT, -- policy admin address
  policy_id INT,
  policy_type TEXT, -- whitelist/blacklist/compound
  supply_cap NUMERIC,
  current_supply NUMERIC,
  headroom_pct NUMERIC,
  price_vs_pathusd NUMERIC,
  spread_bps NUMERIC,
  volume_24h NUMERIC,
  yield_rate NUMERIC, -- annualized reward rate
  updated_at TIMESTAMPTZ
);

-- Hourly net flows between stablecoin pairs
CREATE TABLE stablecoin_flows (
  id SERIAL PRIMARY KEY,
  from_token TEXT REFERENCES stablecoins(address),
  to_token TEXT REFERENCES stablecoins(address),
  hour TIMESTAMPTZ,
  net_flow_usd NUMERIC,
  tx_count INT,
  UNIQUE(from_token, to_token, hour)
);

-- Paid deep briefings
CREATE TABLE briefings (
  id SERIAL PRIMARY KEY,
  token_address TEXT,
  payload JSONB, -- full briefing data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TIP-403 policy cache
CREATE TABLE policies (
  policy_id INT PRIMARY KEY,
  policy_type TEXT,
  admin TEXT,
  token_count INT, -- how many tokens reference this policy
  tokens TEXT[], -- array of token addresses
  updated_at TIMESTAMPTZ
);
```

### MPP payment flow

Uses mppx SDK. The middleware wraps paid API routes:

1. Agent calls `GET /v1/tokens/{addr}/briefing`
2. Middleware returns 402 with `WWW-Authenticate: Payment` header (amount: 50000 pathUSD raw units = $0.05)
3. Agent's mppx client signs pathUSD transfer on Tempo, retries with `Authorization: Payment` credential
4. Middleware verifies on-chain, runs pipeline, returns briefing with `Payment-Receipt` header

Recipient wallet: TBD (Jake's Tempo wallet address).
Currency: pathUSD (`0x20c0000000000000000000000000000000000000`).

### Caching strategy

| Data | TTL | Storage |
|---|---|---|
| Market data (price, volume, pools) | 60s | Vercel edge cache |
| Safety scan | 5min | In-memory + DB |
| Holder snapshot | 10min | DB |
| Compliance data | 10min | DB |
| Identity (CoinGecko/DefiLlama) | 1hr | DB |
| Stablecoin matrix | 30s | Vercel edge cache |
| Stablecoin flows | 5min (live), hourly (persisted) | DB |
| Deep briefing | Permanent | DB |

### Edge cases

- **TIP-20 vs ERC-20 detection:** Call TIP-20 factory `isTIP20(address)`. If true, read compliance fields. If false, fall back to bytecode analysis (same as Peon's approach for ERC-20 contracts).
- **Stablecoin identification:** Seed the 12 known stablecoin addresses. Detect new ones by checking `currency()` call on TIP-20 tokens.
- **Empty holder data:** Transfer event scanning on new tokens may find very few holders. Show what we have, note confidence level.
- **GeckoTerminal gaps:** Some tokens may not have GeckoTerminal pools yet. Show on-chain data only (name, symbol, compliance, deployer) without market data.
- **BlockScout API unavailable:** Confirmed that explore.tempo.xyz has no API. All data comes from RPC + GeckoTerminal + CoinGecko/DefiLlama. No dependency on BlockScout.

## Brand

Pellet brand identity carries over from Base, recontextualized for Tempo:

- **Name:** Pellet
- **Domain:** pelletfi.com
- **Tagline:** "intelligence for Tempo" (replaces "token intelligence on Base")
- **Mark:** Same dual-pellet infinity form (master files preserved in archive)
- **Colors:** Same product palette (#0f0f11 bg, #4ade80 status green, #fbbf24 yellow, #f87171 red)
- **Fonts:** Geist Sans (UI), Geist Mono (data), DM Mono ("MPP" badge if needed)
- **Lockup:** Same pixel-locked lockup, update subtitle from "finance" to TBD (could stay "finance", or shift to "intelligence")
- **Voice:** Neutral, not promotional. "Data and patterns." Never "AI-powered."

## Competition

| Product | What it does | Gap |
|---|---|---|
| Peon | API-only safety scanner, $0.06/scan, 25+ risk flags | No UI, no discovery, no market data, no stablecoins, no compliance depth |
| GeckoTerminal | Generic pool/token data for Tempo | Not Tempo-native, no safety, no compliance, no stablecoins |
| MPPscan | MPP transaction explorer | Different product (payments, not tokens) |
| DexScreener | N/A | Does not support Tempo |

## v2 roadmap (post-launch, not in v1 scope)

- **Policy graph surface** — standalone `/policies` view of the full TIP-403 graph
- **MPP payment graph** — map the machine economy, service health, dependency chains
- **Orderbook depth analytics** — enshrined DEX depth quality scoring, slippage prediction
- **Memo intelligence** — commercial vs speculative activity classification
- **Monitoring / alerts** — MPP sessions for streaming de-peg alerts, safety changes
- **CLI tool** — `npx pelletfi <symbol>` for terminal lookup
- **Pellet Pro** — subscription tier for high-volume agent operators

## Timeline

10 days to v1 launch.

- Days 1-3: Project scaffolding, RPC/GeckoTerminal clients, database schema, pipeline aggregators (market, safety, compliance, holders)
- Days 4-6: Token feed + detail pages, stablecoin matrix + flows, API routes with MPP middleware
- Days 7-8: Deep briefing pipeline (origin, evaluation), paid endpoint
- Days 9-10: MCP server, OpenAPI spec, mpp.dev listing, polish, deploy

## Success criteria

- pelletfi.com live on Vercel showing Tempo tokens and stablecoins
- API at pelletfi.com/v1/* with MPP payment on briefing endpoint
- Listed on mpp.dev service directory
- @pelletfi/mcp installable via npx
- Email to partners@tempo.xyz with the live product
