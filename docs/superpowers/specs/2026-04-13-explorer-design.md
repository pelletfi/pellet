# Pellet Explorer — Design Spec

**Date:** 2026-04-13
**Status:** Design approved

## Summary

Build `/explorer` as the primary operational hub for Pellet. Replaces `/tokens`, `/stablecoins`, and `/terminal`. The explorer combines a universal search, live data dashboard, unique visualizations, and intelligent result pages for addresses, transactions, and blocks.

## Route Structure

| Route | Purpose | Replaces |
|-------|---------|----------|
| `/explorer` | Dashboard: search, stats, graphics, token table, sidebar | `/tokens`, `/stablecoins` |
| `/explorer/token/[address]` | Token detail (existing, moved) | `/token/[address]` |
| `/explorer/token/[address]/briefing` | Briefing (existing, moved) | `/token/[address]/briefing` |
| `/explorer/address/[address]` | Wallet/address page (NEW) | — |
| `/explorer/tx/[hash]` | Transaction page (NEW) | — |
| `/explorer/block/[number]` | Block page (NEW) | — |

Old routes (`/tokens`, `/stablecoins`, `/terminal`) redirect to `/explorer`. Token detail routes redirect to new paths.

## Explorer Dashboard (`/explorer`)

### Search Bar
- Universal input: detects type by pattern
  - `0x` + 40 hex chars → address. Then call `getCode(address)` via RPC: if bytecode exists, it's a contract (check `isTip20()` — if true route to token detail, otherwise still show address page with contract flag). If no bytecode, it's a wallet → address page.
  - `0x` + 64 hex chars → transaction hash
  - Numeric → block number
  - Otherwise → token name search (uses existing `searchTokens()` from GeckoTerminal)
- Search icon on left
- Autocomplete dropdown (future — not v1)

### Stats Row
6 cells with shared-border grid: Tokens, Stablecoins, 24h Volume, Block Height, MPP Txns, Liquidity

Data sources:
- Tokens/Volume/Liquidity: `getPools()` from `lib/gecko.ts`
- Stablecoins: `getAllStablecoins()` from `lib/pipeline/stablecoins.ts`
- Block height: `getBlockNumber()` from viem
- MPP Txns: placeholder for now (future: index MPP events)

### Graphics Row (full width, 2 columns)

**Left: Liquidity Distribution Treemap**
- Nested rectangles sized by liquidity share
- Each cell: percentage, token name, dollar value
- Hover: brighten + border
- Data: from `getPools()`, aggregate liquidity per unique token

**Right: Stablecoin Flow Diagram**
- Sankey-style SVG bezier curves
- Source/target stablecoin nodes (left/right columns)
- Curve thickness = flow volume
- Flow value labels on curves
- Net flow summary at bottom
- Data: from `getStablecoinFlows()` existing endpoint

### Tabbed Table (main column)

Three tabs:
1. **Tokens** — current token table (from getPools), with token icons, price, 24h change, volume, type badge
2. **Stablecoins** — current stablecoin table (from getAllStablecoins), with peg, spread, policy, supply
3. **Recent Txns** — latest transactions on Tempo (from RPC `getBlock` with transactions). Shows: tx hash, from, to, value, block, time

Token rows include a mini 7-day sparkline (small SVG, ~60px wide). Data from GeckoTerminal OHLCV endpoint using the token's best pool (highest liquidity). Sparklines are lazy-loaded client-side to avoid blocking page render — show a placeholder bar, then fetch OHLCV per-token after mount.

### Sidebar (right column, 320px)

Top to bottom:
1. **Volume Chart** — area sparkline, period toggles (24h/7d/30d), current value
2. **Recent Blocks** — 50 vertical bars (height = tx count), block range, timing
3. **Live Feed** — streaming transactions (client component, polls or subscribes). Type badges: TFR, SWAP, MPP. Timestamp, addresses, amount.
4. **Peg Status** — each stablecoin with 24h deviation sparkline, current price, deviation %

### Quote Token Tree (below table, full width)

Interactive node graph showing the TIP-20 `quoteToken()` tree:
- pathUSD at root
- Each stablecoin connected to its quote token
- Directed edges showing the routing path
- Node sizes proportional to supply or volume
- Hover: highlight path from any token to pathUSD
- Animated traveling orb (reuse from landing page pattern)
- Data: read `quoteToken()` from each TIP-20 via RPC

## Address Page (`/explorer/address/[address]`)

When a user searches a wallet address (not a token):

### Header
- Address (full, with copy button)
- Balance summary: pathUSD balance, total USD value
- Activity: transaction count, first seen block

### Sections
1. **Token Balances** — table of TIP-20 tokens held, with amounts and USD values. Read from Transfer event logs or multicall balanceOf.
2. **Transaction History** — paginated list of recent transactions involving this address. From/to, value, token, block, time.
3. **MPP Activity** — if the address has sent/received MPP payments, show those separately with service names.
4. **Policy Status** — check if address is on any TIP-403 whitelist or blacklist. Show which policies affect this address.

### Intelligence Layer
- If the address is a token contract → redirect to token detail page
- If the address is a known system address (DEX, fee manager) → show label
- If the address deployed tokens → show "Deployer" badge + list of deployed tokens

## Transaction Page (`/explorer/tx/[hash]`)

### Header
- Tx hash (full, with copy button)
- Status: confirmed / pending
- Block number + timestamp

### Details
- From → To addresses (linked to address pages)
- Value + token
- Gas used / gas price
- TIP-20 memo (if present, decoded)
- MPP context (if this was an MPP payment: service name, charge amount)

### Intelligence
- Token safety badge on the transferred token
- Policy status of from/to addresses
- Deployer flag if from address has deployed tokens

## Block Page (`/explorer/block/[number]`)

### Header
- Block number
- Timestamp
- Transaction count
- Parent hash

### Body
- Transaction list (same format as address page tx history)
- Block navigation: ← Previous / Next →

## Nav Changes

```
Home | Explorer | Services
```

Terminal removed. Stablecoins absorbed into Explorer tabs. `/about` still exists as a route (same content as homepage).

## Technical Notes

### Data Sources (all existing, no new APIs)
- Token list + prices: `getPools()` from `lib/gecko.ts`
- Token detail: `getMarketData()`, `scanSafety()`, `getCompliance()`, `getHolders()`
- Stablecoins: `getAllStablecoins()`, `getStablecoinFlows()`
- Block data: `getBlock()`, `getBlockNumber()` from viem/Tempo RPC
- Transaction data: `getTransaction()`, `getTransactionReceipt()` from viem
- Address balances: `getLogs()` for Transfer events or `balanceOf()` multicall
- Quote token tree: `readContract()` for `quoteToken()` on each TIP-20
- Token icons: `getTokenIcons()` from `lib/token-icons.ts`

### New Components
- `ExplorerSearch` — universal search with type detection + routing
- `StatsRow` — server component fetching live stats
- `LiquidityTreemap` — SVG treemap visualization
- `StablecoinFlowDiagram` — SVG sankey/bezier flow visualization
- `QuoteTokenTree` — interactive node graph with traveling orb
- `BlockTimeline` — vertical bar chart of recent blocks
- `LiveFeed` — client component polling for new transactions
- `PegSparklines` — mini SVG sparklines per stablecoin
- `TokenSparkline` — mini 7-day price sparkline per token row
- `AddressPage` — wallet detail with balances, history, policy status
- `TransactionPage` — tx detail with intelligence annotations
- `BlockPage` — block detail with tx list

### Styling
- Same dark premium design system (globals.css unchanged)
- Monochrome — white/gray only, color reserved for signal
- All new components follow existing patterns: `var(--color-*)`, `var(--font-mono)`, CSS classes from globals.css
- Framer Motion for scroll reveals and interactive elements
- Mobile responsive: sidebar collapses below table, graphics stack vertically

### What Gets Deleted
- `app/terminal/page.tsx` — killed
- `app/tokens/page.tsx` — absorbed into explorer
- `app/stablecoins/page.tsx` — absorbed into explorer tabs
- `app/stablecoins/flows/page.tsx` — absorbed into flow diagram
- `app/stablecoins/[address]/page.tsx` — redirect to explorer
- Nav link "Terminal" — removed
- Nav link "Stablecoins" — removed (lives inside explorer tabs)
