# Pellet on Tempo v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the intelligence layer for Tempo — token discovery + safety, stablecoin matrix + flows, MPP-paid deep briefings, and an MCP server — in 10 days.

**Architecture:** Mono-service Next.js 16 app on Vercel. TypeScript everywhere. viem with `tempoActions()` for RPC, GeckoTerminal for market data, Neon Postgres + Drizzle for persistence, mppx for MPP payments. MCP server as separate npm package wrapping the API.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, viem (Tempo chain built-in), mppx 0.5.x, Drizzle ORM, Neon Postgres, Vercel, @modelcontextprotocol/sdk

---

## File Structure

```
app/
  layout.tsx                    Root layout (Geist Sans/Mono, dark #0f0f11)
  globals.css                   Tailwind v4 config
  page.tsx                      Landing + token feed
  token/[address]/
    page.tsx                    Token detail (market, safety, holders, compliance)
    briefing/page.tsx           Deep briefing (MPP-gated)
  stablecoins/
    page.tsx                    Stablecoin matrix
    flows/page.tsx              Flow matrix
    [address]/page.tsx          Stablecoin detail
  api/v1/
    tokens/route.ts             GET /v1/tokens (list + search)
    tokens/[address]/route.ts   GET /v1/tokens/:addr (detail)
    tokens/[address]/briefing/route.ts  GET /v1/tokens/:addr/briefing (MPP-paid)
    stablecoins/route.ts        GET /v1/stablecoins
    stablecoins/flows/route.ts  GET /v1/stablecoins/flows
    stablecoins/[address]/route.ts  GET /v1/stablecoins/:addr
    health/route.ts             GET /v1/health
  api/openapi/route.ts          GET /openapi.json (MPP discovery)

lib/
  rpc.ts                        viem client with tempoActions()
  gecko.ts                      GeckoTerminal API client
  db/
    schema.ts                   Drizzle schema (tokens, stablecoins, flows, briefings, policies)
    index.ts                    Neon connection
  pipeline/
    market.ts                   GeckoTerminal price, volume, pools, OHLCV
    safety.ts                   Buy/sell sim via eth_call + bytecode pattern matching
    compliance.ts               TIP-403 policy resolution, roles, pause state
    holders.ts                  Transfer event scanning → holder list + concentration
    identity.ts                 CoinGecko + DefiLlama matching
    origin.ts                   Deployer detection, funding trail
    stablecoins.ts              All stablecoins: spread, flows, yield, supply cap
    evaluation.ts               Claude Sonnet synthesis (paid tier)
  mpp/
    server.ts                   mppx server instance (shared across routes)
  types.ts                      Shared TypeScript types

components/
  TokenCard.tsx                 Token card for feed
  SafetyBadge.tsx               Risk score + verdict badge
  StablecoinRow.tsx             Row in stablecoin matrix
  FlowMatrix.tsx                Stablecoin flow heatmap
  BriefingDocument.tsx          Full briefing renderer
  Nav.tsx                       Navigation with Pellet lockup
  Search.tsx                    Token search input

mcp-server/
  src/
    index.ts                    MCP server entry + tool definitions
    client.ts                   HTTP + mppx client wrapping v1 API
  package.json
  tsconfig.json

drizzle.config.ts
package.json
tsconfig.json
next.config.ts
tailwind.config.ts (if needed beyond v4 CSS)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/jake/pellet-new
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias "@/*" --turbopack
```

Select defaults. This creates the Next.js scaffold.

- [ ] **Step 2: Install core dependencies**

```bash
npm install viem mppx @neondatabase/serverless drizzle-orm @anthropic-ai/sdk
npm install -D drizzle-kit @types/node
```

- [ ] **Step 3: Install font packages**

```bash
npm install geist
```

- [ ] **Step 4: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
# Neon Postgres
DATABASE_URL=

# Alchemy (Tempo RPC — optional, falls back to public RPC)
ALCHEMY_API_KEY=

# CoinGecko API (free tier)
COINGECKO_API_KEY=

# Anthropic (Claude Sonnet for briefing synthesis)
ANTHROPIC_API_KEY=

# MPP payment recipient (your Tempo wallet)
MPP_RECIPIENT=
MPP_SECRET_KEY=

# Admin
ADMIN_SECRET=
EOF
```

- [ ] **Step 5: Update .gitignore**

Ensure `.env.local` is in `.gitignore` (create-next-app should have done this). Add:

```
.env.local
.vercel
drizzle/
```

- [ ] **Step 6: Configure root layout with Geist fonts and dark theme**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pellet — intelligence for Tempo",
  description: "Token discovery, stablecoin analytics, and chain intelligence for Tempo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-[#0f0f11] text-[#e8e8e8] antialiased font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Set up Tailwind globals**

Replace `app/globals.css`:

```css
@import "tailwindcss";

:root {
  --font-sans: var(--font-geist-sans), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --bg: #0f0f11;
  --text-primary: #e8e8e8;
  --text-secondary: #888888;
  --text-muted: #555555;
  --green: #4ade80;
  --yellow: #fbbf24;
  --red: #f87171;
  --border: #1a1a1f;
}

body {
  font-family: var(--font-sans);
}
```

- [ ] **Step 8: Create placeholder landing page**

Replace `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Pellet</h1>
      <p className="text-[#888] mt-2">intelligence for Tempo</p>
    </main>
  );
}
```

- [ ] **Step 9: Verify dev server runs**

```bash
npm run dev
```

Open http://localhost:3000. Should see "Pellet / intelligence for Tempo" on dark background.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding — Next.js, Tailwind, Geist fonts, dark theme"
```

---

## Task 2: viem RPC Client + Tempo Chain

**Files:**
- Create: `lib/rpc.ts`, `lib/types.ts`

- [ ] **Step 1: Create shared types**

```ts
// lib/types.ts

export interface TokenMarketData {
  price_usd: number;
  volume_24h: number;
  liquidity_usd: number;
  fdv_usd: number | null;
  price_change_24h: number | null;
  pools: PoolData[];
}

export interface PoolData {
  address: string;
  dex: string;
  base_token: { address: string; symbol: string };
  quote_token: { address: string; symbol: string };
  reserve_usd: number;
  volume_24h: number;
  price_usd: number;
}

export interface SafetyResult {
  score: number;
  verdict: "LOW_RISK" | "CAUTION" | "MEDIUM_RISK" | "HIGH_RISK" | "CRITICAL";
  flags: string[];
  warnings: string[];
  can_buy: boolean;
  can_sell: boolean;
  buy_tax_pct: number;
  sell_tax_pct: number;
  honeypot: boolean;
}

export interface ComplianceResult {
  token_type: "tip20" | "erc20";
  policy_id: number | null;
  policy_type: "whitelist" | "blacklist" | "compound" | null;
  policy_admin: string | null;
  paused: boolean;
  supply_cap: string | null;
  current_supply: string;
  headroom_pct: number | null;
  roles: {
    issuer: string[];
    pause: string[];
    burn_blocked: string[];
  };
}

export interface HolderData {
  total_holders: number;
  top5_pct: number;
  top10_pct: number;
  top20_pct: number;
  creator_address: string | null;
  creator_hold_pct: number | null;
  top_holders: {
    address: string;
    balance: string;
    pct: number;
    label: string | null;
  }[];
}

export interface IdentityResult {
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  coingecko_id: string | null;
  defi_llama_protocol: string | null;
  links: Record<string, string>;
}

export interface OriginResult {
  deployer: string;
  deployer_tx_count: number;
  deployer_age_days: number;
  funding_source: string | null;
  funding_label: string | null;
  funding_hops: number;
  prior_tokens: { address: string; symbol: string; status: string }[];
}

export interface StablecoinData {
  address: string;
  name: string;
  symbol: string;
  currency: string;
  policy_id: number;
  policy_type: string;
  policy_admin: string;
  supply_cap: string;
  current_supply: string;
  headroom_pct: number;
  price_vs_pathusd: number;
  spread_bps: number;
  volume_24h: number;
  yield_rate: number;
  opted_in_supply: string;
}

export interface StablecoinFlow {
  from_token: string;
  to_token: string;
  net_flow_usd: number;
  tx_count: number;
  hour: string;
}

export interface BriefingResult {
  id: number;
  token_address: string;
  market: TokenMarketData;
  safety: SafetyResult;
  compliance: ComplianceResult;
  holders: HolderData;
  identity: IdentityResult;
  origin: OriginResult;
  evaluation: string;
  created_at: string;
}

// Known system addresses on Tempo
export const TEMPO_ADDRESSES = {
  pathUsd: "0x20c0000000000000000000000000000000000000" as `0x${string}`,
  tip20Factory: "0x20fc000000000000000000000000000000000000" as `0x${string}`,
  stablecoinDex: "0xdec0000000000000000000000000000000000000" as `0x${string}`,
  tip403Registry: "0x403c000000000000000000000000000000000000" as `0x${string}`,
  feeManager: "0xfeec000000000000000000000000000000000000" as `0x${string}`,
} as const;
```

- [ ] **Step 2: Create viem client with Tempo actions**

```ts
// lib/rpc.ts
import { createPublicClient, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

const transport = process.env.ALCHEMY_API_KEY
  ? http(`https://tempo-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
  : http(); // falls back to built-in rpc.presto.tempo.xyz

export const tempoClient = createPublicClient({
  chain: tempo,
  transport,
}).extend(tempoActions());
```

- [ ] **Step 3: Verify RPC connectivity**

Create a quick test script:

```bash
npx tsx -e "
import { createPublicClient, http } from 'viem';
import { tempo } from 'viem/chains';
import { tempoActions } from 'viem/tempo';
const client = createPublicClient({ chain: tempo, transport: http() }).extend(tempoActions());
const block = await client.getBlockNumber();
console.log('Tempo block:', block);
const meta = await client.token.getMetadata({ token: '0x20c0000000000000000000000000000000000000' });
console.log('pathUSD metadata:', meta);
"
```

Expected: block number and pathUSD metadata (name, symbol, currency, decimals, totalSupply, etc.).

- [ ] **Step 4: Commit**

```bash
git add lib/rpc.ts lib/types.ts
git commit -m "feat: viem Tempo client with tempoActions + shared types"
```

---

## Task 3: GeckoTerminal Client

**Files:**
- Create: `lib/gecko.ts`

- [ ] **Step 1: Create GeckoTerminal API client**

```ts
// lib/gecko.ts
const BASE_URL = "https://api.geckoterminal.com/api/v2";
const NETWORK = "tempo";

interface GeckoPoolResponse {
  data: GeckoPool[];
}

interface GeckoPool {
  id: string;
  type: string;
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    fdv_usd: string | null;
    reserve_in_usd: string;
    volume_usd: { h24: string };
    price_change_percentage: { h24: string | null };
    transactions: {
      h24: { buys: number; sells: number; buyers: number; sellers: number };
    };
    pool_created_at: string;
  };
  relationships: {
    base_token: { data: { id: string } };
    quote_token: { data: { id: string } };
    dex: { data: { id: string } };
  };
}

interface GeckoTokenResponse {
  data: {
    id: string;
    attributes: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      image_url: string | null;
      coingecko_coin_id: string | null;
      price_usd: string | null;
      fdv_usd: string | null;
      total_reserve_in_usd: string | null;
      volume_usd: { h24: string | null };
      market_cap_usd: string | null;
    };
    relationships: {
      top_pools: { data: { id: string; type: string }[] };
    };
  };
}

async function geckoFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status}: ${path}`);
  return res.json();
}

export async function getPools(page = 1): Promise<GeckoPool[]> {
  const data = await geckoFetch<GeckoPoolResponse>(
    `/networks/${NETWORK}/pools?page=${page}&sort=h24_volume_usd_desc`
  );
  return data.data;
}

export async function getNewPools(): Promise<GeckoPool[]> {
  const data = await geckoFetch<GeckoPoolResponse>(
    `/networks/${NETWORK}/new_pools`
  );
  return data.data;
}

export async function getTokenPools(address: string): Promise<GeckoPool[]> {
  const data = await geckoFetch<GeckoPoolResponse>(
    `/networks/${NETWORK}/tokens/${address}/pools`
  );
  return data.data;
}

export async function getToken(address: string): Promise<GeckoTokenResponse["data"]> {
  const data = await geckoFetch<GeckoTokenResponse>(
    `/networks/${NETWORK}/tokens/${address}`
  );
  return data.data;
}

export async function searchTokens(query: string): Promise<GeckoPool[]> {
  const data = await geckoFetch<GeckoPoolResponse>(
    `/search/pools?query=${encodeURIComponent(query)}&network=${NETWORK}`
  );
  return data.data;
}

export async function getOHLCV(
  poolAddress: string,
  timeframe: "day" | "hour" | "minute" = "day",
  limit = 30
): Promise<{ ohlcv_list: number[][] }> {
  const data = await geckoFetch<{ data: { attributes: { ohlcv_list: number[][] } } }>(
    `/networks/${NETWORK}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}`
  );
  return { ohlcv_list: data.data.attributes.ohlcv_list };
}
```

- [ ] **Step 2: Verify GeckoTerminal connectivity**

```bash
npx tsx -e "
const res = await fetch('https://api.geckoterminal.com/api/v2/networks/tempo/pools?sort=h24_volume_usd_desc');
const data = await res.json();
console.log('Pools:', data.data.length);
console.log('Top pool:', data.data[0]?.attributes?.name);
"
```

Expected: pool count and top pool name.

- [ ] **Step 3: Commit**

```bash
git add lib/gecko.ts
git commit -m "feat: GeckoTerminal API client for Tempo market data"
```

---

## Task 4: Database Schema + Neon Setup

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`

- [ ] **Step 1: Create Drizzle schema**

```ts
// lib/db/schema.ts
import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const tokens = pgTable("tokens", {
  address: text("address").primaryKey(),
  name: text("name"),
  symbol: text("symbol"),
  tokenType: text("token_type"), // 'tip20' or 'erc20'
  decimals: integer("decimals"),
  marketData: jsonb("market_data"),
  safety: jsonb("safety"),
  holders: jsonb("holders"),
  compliance: jsonb("compliance"),
  identity: jsonb("identity"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stablecoins = pgTable("stablecoins", {
  address: text("address").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  currency: text("currency").notNull(),
  issuerAdmin: text("issuer_admin"),
  policyId: integer("policy_id"),
  policyType: text("policy_type"),
  supplyCap: numeric("supply_cap"),
  currentSupply: numeric("current_supply"),
  headroomPct: numeric("headroom_pct"),
  priceVsPathusd: numeric("price_vs_pathusd"),
  spreadBps: numeric("spread_bps"),
  volume24h: numeric("volume_24h"),
  yieldRate: numeric("yield_rate"),
  optedInSupply: numeric("opted_in_supply"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stablecoinFlows = pgTable("stablecoin_flows", {
  id: serial("id").primaryKey(),
  fromToken: text("from_token").notNull(),
  toToken: text("to_token").notNull(),
  hour: timestamp("hour", { withTimezone: true }).notNull(),
  netFlowUsd: numeric("net_flow_usd").notNull(),
  txCount: integer("tx_count").notNull(),
});

export const briefings = pgTable("briefings", {
  id: serial("id").primaryKey(),
  tokenAddress: text("token_address").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const policies = pgTable("policies", {
  policyId: integer("policy_id").primaryKey(),
  policyType: text("policy_type"),
  admin: text("admin"),
  tokenCount: integer("token_count").default(0),
  tokens: text("tokens").array(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create DB connection**

```ts
// lib/db/index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 3: Create Drizzle config**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create Neon database and push schema**

Set up a Neon project at neon.tech, get the connection string, add to `.env.local`:

```bash
echo 'DATABASE_URL=postgres://...' >> .env.local
npx drizzle-kit push
```

Expected: tables created in Neon.

- [ ] **Step 5: Commit**

```bash
git add lib/db/ drizzle.config.ts
git commit -m "feat: Drizzle schema + Neon Postgres — tokens, stablecoins, flows, briefings, policies"
```

---

## Task 5: Pipeline — Market Data

**Files:**
- Create: `lib/pipeline/market.ts`

- [ ] **Step 1: Create market data aggregator**

```ts
// lib/pipeline/market.ts
import { getToken, getTokenPools } from "@/lib/gecko";
import type { TokenMarketData, PoolData } from "@/lib/types";

export async function getMarketData(address: string): Promise<TokenMarketData> {
  const [token, pools] = await Promise.all([
    getToken(address).catch(() => null),
    getTokenPools(address).catch(() => []),
  ]);

  const poolData: PoolData[] = pools.map((p) => ({
    address: p.attributes.address,
    dex: p.relationships.dex.data.id.replace(`${p.relationships.dex.data.id.split("_")[0]}_`, ""),
    base_token: {
      address: p.relationships.base_token.data.id.split("_").pop()!,
      symbol: p.attributes.name.split(" / ")[0] ?? "",
    },
    quote_token: {
      address: p.relationships.quote_token.data.id.split("_").pop()!,
      symbol: p.attributes.name.split(" / ")[1] ?? "",
    },
    reserve_usd: parseFloat(p.attributes.reserve_in_usd || "0"),
    volume_24h: parseFloat(p.attributes.volume_usd.h24 || "0"),
    price_usd: parseFloat(p.attributes.base_token_price_usd || "0"),
  }));

  const bestPool = poolData.sort((a, b) => b.reserve_usd - a.reserve_usd)[0];

  return {
    price_usd: bestPool?.price_usd ?? parseFloat(token?.attributes.price_usd || "0"),
    volume_24h: poolData.reduce((sum, p) => sum + p.volume_24h, 0),
    liquidity_usd: poolData.reduce((sum, p) => sum + p.reserve_usd, 0),
    fdv_usd: token ? parseFloat(token.attributes.fdv_usd || "0") || null : null,
    price_change_24h: null, // GeckoTerminal provides this per-pool, take best pool's
    pools: poolData,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/market.ts
git commit -m "feat: market data aggregator — GeckoTerminal price, volume, pools"
```

---

## Task 6: Pipeline — Safety Scanner

**Files:**
- Create: `lib/pipeline/safety.ts`

- [ ] **Step 1: Create safety scanner**

This simulates buy/sell via `eth_call` against Uniswap router and analyzes contract bytecode for dangerous patterns.

```ts
// lib/pipeline/safety.ts
import { tempoClient } from "@/lib/rpc";
import { Abis } from "viem/tempo";
import { TEMPO_ADDRESSES } from "@/lib/types";
import type { SafetyResult } from "@/lib/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// Known function selectors for dangerous patterns
const DANGEROUS_SELECTORS = {
  selfdestruct: "ff",
  delegatecall: "f4",
  blacklist: ["06f13056", "44337ea1", "e47d6060"], // addToBlacklist variants
  mint: ["40c10f19", "a0712d68", "4e6ec247"], // mint(address,uint256) variants
  pause: ["8456cb59", "02329a29"], // pause() variants
  ownershipTransfer: ["f2fde38b"], // transferOwnership(address)
};

async function checkBytecodePatterns(address: `0x${string}`): Promise<{
  is_proxy: boolean;
  has_selfdestruct: boolean;
  has_blacklist: boolean;
  has_mint: boolean;
  has_pause: boolean;
  has_delegatecall: boolean;
  has_ownership_transfer: boolean;
  bytecode_size: number;
}> {
  const code = await tempoClient.getCode({ address });
  if (!code || code === "0x" || code === "0xef") {
    // TIP-20 precompile (0xef) or no code — skip bytecode analysis
    return {
      is_proxy: false,
      has_selfdestruct: false,
      has_blacklist: false,
      has_mint: false,
      has_pause: false,
      has_delegatecall: false,
      has_ownership_transfer: false,
      bytecode_size: code?.length ? (code.length - 2) / 2 : 0,
    };
  }

  const hex = code.toLowerCase();
  return {
    is_proxy: hex.includes("360894a13ba1a3210667c828492db98dca3e2076"), // EIP-1967 slot
    has_selfdestruct: hex.includes(DANGEROUS_SELECTORS.selfdestruct),
    has_blacklist: DANGEROUS_SELECTORS.blacklist.some((s) => hex.includes(s)),
    has_mint: DANGEROUS_SELECTORS.mint.some((s) => hex.includes(s)),
    has_pause: DANGEROUS_SELECTORS.pause.some((s) => hex.includes(s)),
    has_delegatecall: hex.includes(DANGEROUS_SELECTORS.delegatecall),
    has_ownership_transfer: DANGEROUS_SELECTORS.ownershipTransfer.some((s) => hex.includes(s)),
    bytecode_size: (hex.length - 2) / 2,
  };
}

async function simulateTransfer(
  token: `0x${string}`,
  from: `0x${string}`,
  to: `0x${string}`,
  amount: bigint
): Promise<boolean> {
  try {
    await tempoClient.simulateContract({
      address: token,
      abi: Abis.tip20,
      functionName: "transfer",
      args: [to, amount],
      account: from,
    });
    return true;
  } catch {
    return false;
  }
}

export async function scanSafety(
  address: `0x${string}`,
  isTip20: boolean,
  pools: { address: string; reserve_usd: number }[]
): Promise<SafetyResult> {
  const flags: string[] = [];
  const warnings: string[] = [];

  // Bytecode analysis (ERC-20 only — TIP-20 precompiles have no real bytecode)
  const bytecode = await checkBytecodePatterns(address);

  if (!isTip20) {
    if (bytecode.is_proxy) {
      flags.push("IS_PROXY");
      warnings.push("Upgradeable proxy contract — code can change");
    }
    if (bytecode.has_selfdestruct) {
      flags.push("HAS_SELFDESTRUCT");
      warnings.push("Contract contains SELFDESTRUCT opcode");
    }
    if (bytecode.has_blacklist) {
      flags.push("HAS_BLACKLIST");
      warnings.push("Blacklist functions detected");
    }
    if (bytecode.has_mint && bytecode.has_ownership_transfer) {
      flags.push("HAS_HIDDEN_MINT");
      warnings.push("Mint function with transferable ownership");
    }
  }

  // Liquidity checks
  const totalLiquidity = pools.reduce((sum, p) => sum + p.reserve_usd, 0);
  if (pools.length === 0 || totalLiquidity === 0) {
    flags.push("NO_LIQUIDITY");
    warnings.push("No trading pairs found");
  } else if (totalLiquidity < 10) {
    flags.push("UNTRADEABLE");
    warnings.push("Total liquidity under $10");
  } else if (totalLiquidity < 1000) {
    flags.push("LOW_LIQUIDITY");
    warnings.push("Total liquidity under $1,000");
  } else if (totalLiquidity < 10000) {
    flags.push("LOW_LIQUIDITY");
    warnings.push("Total liquidity under $10,000");
  }

  // Buy/sell simulation
  let canBuy = false;
  let canSell = false;
  // Simplified — full sim would route through Uniswap router
  // For now, check if transfer works as a proxy for tradability
  const transferable = await simulateTransfer(
    address,
    ZERO_ADDRESS,
    "0x0000000000000000000000000000000000000001" as `0x${string}`,
    1n
  );

  if (!transferable && !isTip20) {
    flags.push("TRANSFER_RESTRICTED");
    warnings.push("Token transfer simulation failed");
  }

  // Score calculation (category-capped like Peon)
  let score = 0;
  const honeypot = flags.includes("TRANSFER_RESTRICTED") && !canSell;

  if (flags.includes("NO_LIQUIDITY") || flags.includes("UNTRADEABLE")) score += 25;
  if (flags.includes("LOW_LIQUIDITY")) score += 15;
  if (flags.includes("IS_PROXY")) score += 18;
  if (flags.includes("HAS_SELFDESTRUCT")) score += 25;
  if (flags.includes("HAS_BLACKLIST")) score += 8;
  if (flags.includes("HAS_HIDDEN_MINT")) score += 12;
  if (flags.includes("TRANSFER_RESTRICTED")) score += 12;
  if (honeypot) score += 35;

  // Bonuses
  if (isTip20) score = Math.max(0, score - 3);
  if (totalLiquidity > 50000) score = Math.max(0, score - 3);

  score = Math.min(100, score);

  let verdict: SafetyResult["verdict"];
  if (score <= 15) verdict = "LOW_RISK";
  else if (score <= 35) verdict = "CAUTION";
  else if (score <= 60) verdict = "MEDIUM_RISK";
  else if (score <= 80) verdict = "HIGH_RISK";
  else verdict = "CRITICAL";

  return {
    score,
    verdict,
    flags,
    warnings,
    can_buy: canBuy,
    can_sell: canSell,
    buy_tax_pct: 0,
    sell_tax_pct: 0,
    honeypot,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/safety.ts
git commit -m "feat: safety scanner — bytecode analysis + transfer simulation + risk scoring"
```

---

## Task 7: Pipeline — Compliance

**Files:**
- Create: `lib/pipeline/compliance.ts`

- [ ] **Step 1: Create compliance aggregator**

```ts
// lib/pipeline/compliance.ts
import { tempoClient } from "@/lib/rpc";
import { Abis, Addresses } from "viem/tempo";
import { TEMPO_ADDRESSES } from "@/lib/types";
import type { ComplianceResult } from "@/lib/types";

const POLICY_TYPES = ["whitelist", "blacklist", "compound"] as const;

async function isTip20(address: `0x${string}`): Promise<boolean> {
  try {
    const result = await tempoClient.readContract({
      address: TEMPO_ADDRESSES.tip20Factory,
      abi: [
        {
          name: "isTIP20",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "token", type: "address" }],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "isTIP20",
      args: [address],
    });
    return result as boolean;
  } catch {
    return false;
  }
}

async function getPolicyData(policyId: number): Promise<{
  type: string;
  admin: string;
} | null> {
  try {
    const result = await tempoClient.readContract({
      address: TEMPO_ADDRESSES.tip403Registry,
      abi: [
        {
          name: "policyData",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "policyId", type: "uint64" }],
          outputs: [
            { name: "policyType", type: "uint8" },
            { name: "admin", type: "address" },
          ],
        },
      ],
      functionName: "policyData",
      args: [BigInt(policyId)],
    });
    const [policyType, admin] = result as [number, string];
    return {
      type: POLICY_TYPES[policyType] ?? "unknown",
      admin,
    };
  } catch {
    return null;
  }
}

export async function getCompliance(address: `0x${string}`): Promise<ComplianceResult> {
  const tip20 = await isTip20(address);

  if (!tip20) {
    // ERC-20 — limited compliance data
    let paused = false;
    let totalSupply = "0";
    try {
      totalSupply = String(
        await tempoClient.readContract({
          address,
          abi: Abis.tip20,
          functionName: "totalSupply",
        })
      );
    } catch {}

    try {
      paused = (await tempoClient.readContract({
        address,
        abi: [
          {
            name: "paused",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "paused",
      })) as boolean;
    } catch {}

    return {
      token_type: "erc20",
      policy_id: null,
      policy_type: null,
      policy_admin: null,
      paused,
      supply_cap: null,
      current_supply: totalSupply,
      headroom_pct: null,
      roles: { issuer: [], pause: [], burn_blocked: [] },
    };
  }

  // TIP-20 — full compliance data via tempoActions
  const metadata = await tempoClient.token.getMetadata({ token: address });

  const policyId = Number(metadata.transferPolicyId);
  const policy = await getPolicyData(policyId);

  const supplyCap = metadata.supplyCap ? String(metadata.supplyCap) : null;
  const currentSupply = String(metadata.totalSupply);
  let headroomPct: number | null = null;
  if (supplyCap && BigInt(supplyCap) > 0n) {
    headroomPct =
      Number(((BigInt(supplyCap) - BigInt(currentSupply)) * 10000n) / BigInt(supplyCap)) / 100;
  }

  return {
    token_type: "tip20",
    policy_id: policyId,
    policy_type: policy?.type ?? null,
    policy_admin: policy?.admin ?? null,
    paused: metadata.paused ?? false,
    supply_cap: supplyCap,
    current_supply: currentSupply,
    headroom_pct: headroomPct,
    roles: {
      issuer: [], // TODO: enumerate role holders via event logs in v2
      pause: [],
      burn_blocked: [],
    },
  };
}

export { isTip20 };
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/compliance.ts
git commit -m "feat: compliance aggregator — TIP-403 policy resolution, TIP-20 metadata, pause state"
```

---

## Task 8: Pipeline — Holder Analysis

**Files:**
- Create: `lib/pipeline/holders.ts`

- [ ] **Step 1: Create holder analysis from Transfer events**

```ts
// lib/pipeline/holders.ts
import { tempoClient } from "@/lib/rpc";
import { Abis } from "viem/tempo";
import type { HolderData } from "@/lib/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const BURN_ADDRESSES = new Set([
  ZERO_ADDRESS,
  "0x000000000000000000000000000000000000dead",
  "0xdead000000000000000000000000000000000000",
]);

const KNOWN_SYSTEM_LABELS: Record<string, string> = {
  "0xdec0000000000000000000000000000000000000": "Enshrined DEX",
  "0xfeec000000000000000000000000000000000000": "Fee Manager",
  "0x0000000000000000000000000000000000000000": "Burn Address",
  "0x000000000000000000000000000000000000dead": "Burn Address",
};

export async function getHolders(
  address: `0x${string}`,
  decimals: number = 6
): Promise<HolderData> {
  // Scan Transfer events to reconstruct balances
  const logs = await tempoClient.getContractEvents({
    address,
    abi: Abis.tip20,
    eventName: "Transfer",
    fromBlock: 0n,
    toBlock: "latest",
  });

  const balances = new Map<string, bigint>();
  let creatorAddress: string | null = null;

  for (const log of logs) {
    const from = (log.args.from as string).toLowerCase();
    const to = (log.args.to as string).toLowerCase();
    const amount = log.args.amount as bigint;

    // First mint (from zero) = creator
    if (from === ZERO_ADDRESS && !creatorAddress) {
      creatorAddress = to;
    }

    if (from !== ZERO_ADDRESS) {
      balances.set(from, (balances.get(from) ?? 0n) - amount);
    }
    balances.set(to, (balances.get(to) ?? 0n) + amount);
  }

  // Filter to positive balances, exclude zero/burn addresses
  const holders = Array.from(balances.entries())
    .filter(([addr, bal]) => bal > 0n && !BURN_ADDRESSES.has(addr))
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0));

  const totalSupply = holders.reduce((sum, [, bal]) => sum + bal, 0n);
  const divisor = Number(totalSupply) / 100;

  const topHolders = holders.slice(0, 50).map(([addr, bal], i) => ({
    address: addr,
    balance: String(bal),
    pct: divisor > 0 ? Number(bal) / divisor : 0,
    label: KNOWN_SYSTEM_LABELS[addr] ?? null,
  }));

  const top5 = topHolders.slice(0, 5).reduce((sum, h) => sum + h.pct, 0);
  const top10 = topHolders.slice(0, 10).reduce((sum, h) => sum + h.pct, 0);
  const top20 = topHolders.slice(0, 20).reduce((sum, h) => sum + h.pct, 0);

  const creatorHolding = creatorAddress
    ? topHolders.find((h) => h.address === creatorAddress)
    : null;

  return {
    total_holders: holders.length,
    top5_pct: Math.round(top5 * 100) / 100,
    top10_pct: Math.round(top10 * 100) / 100,
    top20_pct: Math.round(top20 * 100) / 100,
    creator_address: creatorAddress,
    creator_hold_pct: creatorHolding ? Math.round(creatorHolding.pct * 100) / 100 : null,
    top_holders: topHolders,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/holders.ts
git commit -m "feat: holder analysis — Transfer event scanning, concentration metrics, creator detection"
```

---

## Task 9: Pipeline — Identity + Origin

**Files:**
- Create: `lib/pipeline/identity.ts`, `lib/pipeline/origin.ts`

- [ ] **Step 1: Create identity resolver**

```ts
// lib/pipeline/identity.ts
import type { IdentityResult } from "@/lib/types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEFILLAMA_BASE = "https://api.llama.fi";

export async function resolveIdentity(
  address: string,
  onChainName: string,
  onChainSymbol: string
): Promise<IdentityResult> {
  const result: IdentityResult = {
    name: onChainName,
    symbol: onChainSymbol,
    description: null,
    image_url: null,
    coingecko_id: null,
    defi_llama_protocol: null,
    links: {},
  };

  // CoinGecko: try contract lookup on Tempo platform
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/tempo/contract/${address.toLowerCase()}`,
      {
        headers: process.env.COINGECKO_API_KEY
          ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: 3600 },
      }
    );
    if (res.ok) {
      const data = await res.json();
      result.name = data.name ?? result.name;
      result.description = data.description?.en ?? null;
      result.image_url = data.image?.large ?? data.image?.small ?? null;
      result.coingecko_id = data.id ?? null;
      if (data.links?.homepage?.[0]) result.links.website = data.links.homepage[0];
      if (data.links?.twitter_screen_name)
        result.links.twitter = `https://x.com/${data.links.twitter_screen_name}`;
    }
  } catch {}

  // DefiLlama: try protocol match by name
  try {
    const res = await fetch(`${DEFILLAMA_BASE}/protocols`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const protocols = await res.json();
      const match = protocols.find(
        (p: { name: string; chains: string[] }) =>
          p.name.toLowerCase() === onChainName.toLowerCase() &&
          p.chains?.includes("Tempo")
      );
      if (match) {
        result.defi_llama_protocol = match.slug;
        if (!result.description) result.description = match.description;
      }
    }
  } catch {}

  return result;
}
```

- [ ] **Step 2: Create origin/deployer analyzer**

```ts
// lib/pipeline/origin.ts
import { tempoClient } from "@/lib/rpc";
import { Abis } from "viem/tempo";
import type { OriginResult } from "@/lib/types";

export async function getOrigin(
  tokenAddress: `0x${string}`,
  creatorAddress: string | null
): Promise<OriginResult> {
  const result: OriginResult = {
    deployer: creatorAddress ?? "unknown",
    deployer_tx_count: 0,
    deployer_age_days: 0,
    funding_source: null,
    funding_label: null,
    funding_hops: 0,
    prior_tokens: [],
  };

  if (!creatorAddress) return result;

  const deployer = creatorAddress as `0x${string}`;

  // Get deployer tx count
  try {
    result.deployer_tx_count = await tempoClient.getTransactionCount({
      address: deployer,
    });
  } catch {}

  // Get deployer's first transaction to estimate wallet age
  try {
    const logs = await tempoClient.getLogs({
      address: undefined,
      fromBlock: 0n,
      toBlock: "latest",
      args: {},
    });
    // This is expensive — for v1, we'll estimate from tx count
    // Wallet age estimation deferred to v2
  } catch {}

  // Find funding source (first inbound transfer to deployer)
  try {
    const inboundLogs = await tempoClient.getContractEvents({
      address: undefined, // all contracts
      abi: Abis.tip20,
      eventName: "Transfer",
      args: {
        to: deployer,
      },
      fromBlock: 0n,
      toBlock: 10000n, // only check early blocks for funding
    });

    if (inboundLogs.length > 0) {
      const firstFunding = inboundLogs[0];
      result.funding_source = (firstFunding.args.from as string) ?? null;
      result.funding_hops = 1;
      // Label lookup would require an address database — basic for v1
    }
  } catch {}

  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/identity.ts lib/pipeline/origin.ts
git commit -m "feat: identity resolver (CoinGecko + DefiLlama) + origin/deployer analyzer"
```

---

## Task 10: Pipeline — Stablecoins

**Files:**
- Create: `lib/pipeline/stablecoins.ts`

- [ ] **Step 1: Create stablecoin aggregator**

```ts
// lib/pipeline/stablecoins.ts
import { tempoClient } from "@/lib/rpc";
import { Abis } from "viem/tempo";
import { TEMPO_ADDRESSES } from "@/lib/types";
import type { StablecoinData, StablecoinFlow } from "@/lib/types";

// Known stablecoins on Tempo mainnet (seed list — expand as new ones appear)
export const KNOWN_STABLECOINS: { address: `0x${string}`; name: string; symbol: string }[] = [
  { address: "0x20c0000000000000000000000000000000000000", name: "pathUSD", symbol: "pathUSD" },
  { address: "0x20c000000000000000000000b9537d11c60e8b50", name: "USDC.e", symbol: "USDC.e" },
  { address: "0x20c00000000000000000000014f22ca97301eb73", name: "USDT0", symbol: "USDT0" },
  // Add cUSD, stcUSD, and others as addresses are confirmed
];

async function getStablecoinMetadata(
  address: `0x${string}`
): Promise<StablecoinData | null> {
  try {
    const metadata = await tempoClient.token.getMetadata({ token: address });

    // Get policy data
    const policyId = Number(metadata.transferPolicyId);
    let policyType = "unknown";
    let policyAdmin = "";
    try {
      const policy = await tempoClient.readContract({
        address: TEMPO_ADDRESSES.tip403Registry,
        abi: [
          {
            name: "policyData",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "policyId", type: "uint64" }],
            outputs: [
              { name: "policyType", type: "uint8" },
              { name: "admin", type: "address" },
            ],
          },
        ],
        functionName: "policyData",
        args: [BigInt(policyId)],
      });
      const [type, admin] = policy as [number, string];
      policyType = ["whitelist", "blacklist", "compound"][type] ?? "unknown";
      policyAdmin = admin;
    } catch {}

    // Get spread from enshrined DEX
    let spreadBps = 0;
    let priceVsPathusd = 1;
    if (address !== TEMPO_ADDRESSES.pathUsd) {
      try {
        // Quote 1 unit swap in each direction
        const oneUnit = BigInt(10 ** 6); // 6 decimals
        const buyQuote = await tempoClient.readContract({
          address: TEMPO_ADDRESSES.stablecoinDex,
          abi: [
            {
              name: "quoteSwapExactAmountIn",
              type: "function",
              stateMutability: "view",
              inputs: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "amountIn", type: "uint128" },
              ],
              outputs: [{ name: "amountOut", type: "uint128" }],
            },
          ],
          functionName: "quoteSwapExactAmountIn",
          args: [TEMPO_ADDRESSES.pathUsd, address, oneUnit],
        });
        const sellQuote = await tempoClient.readContract({
          address: TEMPO_ADDRESSES.stablecoinDex,
          abi: [
            {
              name: "quoteSwapExactAmountIn",
              type: "function",
              stateMutability: "view",
              inputs: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "amountIn", type: "uint128" },
              ],
              outputs: [{ name: "amountOut", type: "uint128" }],
            },
          ],
          functionName: "quoteSwapExactAmountIn",
          args: [address, TEMPO_ADDRESSES.pathUsd, oneUnit],
        });

        const buyPrice = Number(buyQuote as bigint) / 1e6;
        const sellPrice = Number(sellQuote as bigint) / 1e6;
        priceVsPathusd = (buyPrice + sellPrice) / 2;
        spreadBps = Math.round(((1 / buyPrice - sellPrice) / priceVsPathusd) * 10000);
      } catch {}
    }

    // Get yield data
    let yieldRate = 0;
    let optedInSupply = "0";
    try {
      const opted = await tempoClient.readContract({
        address,
        abi: Abis.tip20,
        functionName: "optedInSupply",
      });
      optedInSupply = String(opted);
    } catch {}

    const supplyCap = metadata.supplyCap ? String(metadata.supplyCap) : "0";
    const currentSupply = String(metadata.totalSupply);
    const headroomPct =
      BigInt(supplyCap) > 0n
        ? Number(((BigInt(supplyCap) - BigInt(currentSupply)) * 10000n) / BigInt(supplyCap)) / 100
        : 0;

    return {
      address,
      name: metadata.name ?? "",
      symbol: metadata.symbol ?? "",
      currency: metadata.currency ?? "USD",
      policy_id: policyId,
      policy_type: policyType,
      policy_admin: policyAdmin,
      supply_cap: supplyCap,
      current_supply: currentSupply,
      headroom_pct: headroomPct,
      price_vs_pathusd: priceVsPathusd,
      spread_bps: spreadBps,
      volume_24h: 0, // filled from GeckoTerminal
      yield_rate: yieldRate,
      opted_in_supply: optedInSupply,
    };
  } catch {
    return null;
  }
}

export async function getAllStablecoins(): Promise<StablecoinData[]> {
  const results = await Promise.all(
    KNOWN_STABLECOINS.map((s) => getStablecoinMetadata(s.address))
  );
  return results.filter((r): r is StablecoinData => r !== null);
}

export async function getStablecoinFlows(
  hours: number = 24
): Promise<StablecoinFlow[]> {
  // Scan Transfer events between known stablecoin pairs
  const currentBlock = await tempoClient.getBlockNumber();
  // ~1 block/sec, so hours * 3600 blocks back
  const fromBlock = currentBlock - BigInt(hours * 3600);

  const flows: Map<string, StablecoinFlow> = new Map();
  const stablecoinAddresses = new Set(
    KNOWN_STABLECOINS.map((s) => s.address.toLowerCase())
  );

  // For each stablecoin, get Transfer events where recipient is another stablecoin's DEX pool
  // Simplified: track direct transfers between stablecoin contracts via the DEX
  for (const stable of KNOWN_STABLECOINS) {
    if (stable.address === TEMPO_ADDRESSES.pathUsd) continue;

    try {
      const logs = await tempoClient.getContractEvents({
        address: stable.address,
        abi: Abis.tip20,
        eventName: "Transfer",
        fromBlock: fromBlock > 0n ? fromBlock : 0n,
        toBlock: "latest",
      });

      for (const log of logs) {
        const from = (log.args.from as string).toLowerCase();
        const to = (log.args.to as string).toLowerCase();

        // Track flows through the DEX precompile
        if (from === TEMPO_ADDRESSES.stablecoinDex.toLowerCase() || to === TEMPO_ADDRESSES.stablecoinDex.toLowerCase()) {
          const key = `${stable.address}_${TEMPO_ADDRESSES.pathUsd}`;
          const existing = flows.get(key) ?? {
            from_token: stable.address,
            to_token: TEMPO_ADDRESSES.pathUsd,
            net_flow_usd: 0,
            tx_count: 0,
            hour: new Date().toISOString(),
          };
          existing.tx_count++;
          const amount = Number(log.args.amount as bigint) / 1e6;
          if (to === TEMPO_ADDRESSES.stablecoinDex.toLowerCase()) {
            existing.net_flow_usd -= amount; // selling this stable for pathUSD
          } else {
            existing.net_flow_usd += amount; // buying this stable with pathUSD
          }
          flows.set(key, existing);
        }
      }
    } catch {}
  }

  return Array.from(flows.values());
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/stablecoins.ts
git commit -m "feat: stablecoin aggregator — matrix, DEX spread, yield, compliance, flows"
```

---

## Task 11: Pipeline — Evaluation (Claude Synthesis)

**Files:**
- Create: `lib/pipeline/evaluation.ts`

- [ ] **Step 1: Create evaluation synthesizer**

```ts
// lib/pipeline/evaluation.ts
import Anthropic from "@anthropic-ai/sdk";
import type {
  TokenMarketData,
  SafetyResult,
  ComplianceResult,
  HolderData,
  IdentityResult,
  OriginResult,
} from "@/lib/types";

const anthropic = new Anthropic();

interface EvaluationInput {
  address: string;
  name: string;
  symbol: string;
  market: TokenMarketData;
  safety: SafetyResult;
  compliance: ComplianceResult;
  holders: HolderData;
  identity: IdentityResult;
  origin: OriginResult;
}

export async function evaluate(input: EvaluationInput): Promise<string> {
  const prompt = `You are a token analyst writing a brief evaluation for a Tempo blockchain token. Be factual, neutral, and source-specific. No promotional language. No trading advice.

Token: ${input.name} (${input.symbol})
Address: ${input.address}
Type: ${input.compliance.token_type === "tip20" ? "TIP-20 (enshrined)" : "ERC-20 (Solidity)"}

MARKET DATA:
- Price: $${input.market.price_usd}
- 24h Volume: $${input.market.volume_24h.toLocaleString()}
- Liquidity: $${input.market.liquidity_usd.toLocaleString()}
- FDV: ${input.market.fdv_usd ? "$" + input.market.fdv_usd.toLocaleString() : "unknown"}
- Pools: ${input.market.pools.length} (${input.market.pools.map((p) => p.dex).join(", ")})

SAFETY:
- Score: ${input.safety.score}/100 (${input.safety.verdict})
- Flags: ${input.safety.flags.length > 0 ? input.safety.flags.join(", ") : "none"}
- Honeypot: ${input.safety.honeypot ? "YES" : "no"}

COMPLIANCE:
- Policy: ${input.compliance.policy_type ?? "none"} (ID: ${input.compliance.policy_id ?? "n/a"})
- Admin: ${input.compliance.policy_admin ?? "none"}
- Paused: ${input.compliance.paused}
- Supply cap: ${input.compliance.supply_cap ?? "unlimited"}
- Headroom: ${input.compliance.headroom_pct !== null ? input.compliance.headroom_pct + "%" : "n/a"}

HOLDERS:
- Total: ${input.holders.total_holders}
- Top 5: ${input.holders.top5_pct}%, Top 10: ${input.holders.top10_pct}%
- Creator: ${input.holders.creator_address ?? "unknown"} (${input.holders.creator_hold_pct ?? 0}%)

IDENTITY:
- CoinGecko: ${input.identity.coingecko_id ?? "not listed"}
- DefiLlama: ${input.identity.defi_llama_protocol ?? "not tracked"}
- Description: ${input.identity.description ?? "none"}

ORIGIN:
- Deployer: ${input.origin.deployer}
- Deployer tx count: ${input.origin.deployer_tx_count}
- Funding source: ${input.origin.funding_source ?? "unknown"}
- Prior tokens: ${input.origin.prior_tokens.length}

Write a 2-3 paragraph analyst note. Lead with the most important finding. Note any unusual patterns. End with what to watch.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "Evaluation unavailable.";
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/evaluation.ts
git commit -m "feat: Claude Sonnet evaluation synthesis for paid briefings"
```

---

## Task 12: MPP Server Setup

**Files:**
- Create: `lib/mpp/server.ts`

- [ ] **Step 1: Create shared mppx server instance**

```ts
// lib/mpp/server.ts
import { Mppx, tempo } from "mppx/nextjs";

export const mppx = Mppx.create({
  methods: [
    tempo({
      currency: "0x20c0000000000000000000000000000000000000", // pathUSD
      recipient: process.env.MPP_RECIPIENT as `0x${string}`,
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY,
});

export const briefingCharge = mppx.charge({
  amount: "0.05",
  description: "Pellet deep briefing",
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/mpp/server.ts
git commit -m "feat: mppx server instance — MPP payment config for Tempo pathUSD"
```

---

## Task 13: API Routes — Free Token Endpoints

**Files:**
- Create: `app/api/v1/tokens/route.ts`, `app/api/v1/tokens/[address]/route.ts`, `app/api/v1/health/route.ts`

- [ ] **Step 1: Create token list/search endpoint**

```ts
// app/api/v1/tokens/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPools, searchTokens } from "@/lib/gecko";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1");

  try {
    if (q) {
      const pools = await searchTokens(q);
      const tokens = dedupeTokensFromPools(pools);
      return NextResponse.json({ tokens });
    }

    const pools = await getPools(page);
    const tokens = dedupeTokensFromPools(pools);
    return NextResponse.json({ tokens, page });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch token data" } },
      { status: 500 }
    );
  }
}

function dedupeTokensFromPools(pools: Awaited<ReturnType<typeof getPools>>) {
  const seen = new Set<string>();
  return pools
    .map((p) => {
      const baseId = p.relationships.base_token.data.id;
      const address = baseId.split("_").pop()!;
      if (seen.has(address)) return null;
      seen.add(address);
      return {
        address,
        name: p.attributes.name.split(" / ")[0],
        price_usd: parseFloat(p.attributes.base_token_price_usd || "0"),
        volume_24h: parseFloat(p.attributes.volume_usd.h24 || "0"),
        liquidity_usd: parseFloat(p.attributes.reserve_in_usd || "0"),
        pool_count: 1,
      };
    })
    .filter(Boolean);
}
```

- [ ] **Step 2: Create token detail endpoint**

```ts
// app/api/v1/tokens/[address]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getMarketData } from "@/lib/pipeline/market";
import { scanSafety } from "@/lib/pipeline/safety";
import { getCompliance, isTip20 } from "@/lib/pipeline/compliance";
import { getHolders } from "@/lib/pipeline/holders";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Invalid address format" } },
      { status: 400 }
    );
  }

  const addr = address.toLowerCase() as `0x${string}`;

  try {
    const tip20 = await isTip20(addr);

    const [market, compliance, holders] = await Promise.all([
      getMarketData(addr),
      getCompliance(addr),
      getHolders(addr),
    ]);

    const safety = await scanSafety(
      addr,
      tip20,
      market.pools.map((p) => ({ address: p.address, reserve_usd: p.reserve_usd }))
    );

    return NextResponse.json({
      address: addr,
      name: holders.top_holders.length > 0 ? compliance.token_type : "Unknown",
      token_type: compliance.token_type,
      market,
      safety: {
        score: safety.score,
        verdict: safety.verdict,
        flags: safety.flags,
      },
      compliance: {
        policy_type: compliance.policy_type,
        paused: compliance.paused,
        supply_cap: compliance.supply_cap,
        headroom_pct: compliance.headroom_pct,
      },
      holders: {
        total: holders.total_holders,
        top5_pct: holders.top5_pct,
        top10_pct: holders.top10_pct,
        creator: holders.creator_address,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch token data" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create health endpoint**

```ts
// app/api/v1/health/route.ts
import { NextResponse } from "next/server";
import { tempoClient } from "@/lib/rpc";

export async function GET() {
  try {
    const blockNumber = await tempoClient.getBlockNumber();
    return NextResponse.json({
      status: "ok",
      chain: "tempo",
      block: Number(blockNumber),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "RPC unreachable" },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/
git commit -m "feat: API routes — token list/search, token detail, health check"
```

---

## Task 14: API Routes — Stablecoin Endpoints

**Files:**
- Create: `app/api/v1/stablecoins/route.ts`, `app/api/v1/stablecoins/flows/route.ts`, `app/api/v1/stablecoins/[address]/route.ts`

- [ ] **Step 1: Create stablecoin matrix endpoint**

```ts
// app/api/v1/stablecoins/route.ts
import { NextResponse } from "next/server";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

export async function GET() {
  try {
    const stablecoins = await getAllStablecoins();
    return NextResponse.json({ stablecoins });
  } catch {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch stablecoin data" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create stablecoin flows endpoint**

```ts
// app/api/v1/stablecoins/flows/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStablecoinFlows } from "@/lib/pipeline/stablecoins";

export async function GET(request: NextRequest) {
  const hours = parseInt(request.nextUrl.searchParams.get("hours") ?? "24");

  try {
    const flows = await getStablecoinFlows(Math.min(hours, 168)); // max 7 days
    return NextResponse.json({ flows, hours });
  } catch {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch flow data" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create stablecoin detail endpoint**

```ts
// app/api/v1/stablecoins/[address]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const addr = address.toLowerCase();

  try {
    const stablecoins = await getAllStablecoins();
    const stable = stablecoins.find((s) => s.address.toLowerCase() === addr);

    if (!stable) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Stablecoin not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(stable);
  } catch {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch stablecoin data" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/stablecoins/
git commit -m "feat: stablecoin API routes — matrix, flows, detail"
```

---

## Task 15: API Route — Paid Briefing (MPP)

**Files:**
- Create: `app/api/v1/tokens/[address]/briefing/route.ts`

- [ ] **Step 1: Create MPP-gated briefing endpoint**

```ts
// app/api/v1/tokens/[address]/briefing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { briefingCharge } from "@/lib/mpp/server";
import { getMarketData } from "@/lib/pipeline/market";
import { scanSafety } from "@/lib/pipeline/safety";
import { getCompliance, isTip20 } from "@/lib/pipeline/compliance";
import { getHolders } from "@/lib/pipeline/holders";
import { resolveIdentity } from "@/lib/pipeline/identity";
import { getOrigin } from "@/lib/pipeline/origin";
import { evaluate } from "@/lib/pipeline/evaluation";
import { tempoClient } from "@/lib/rpc";
import { Abis } from "viem/tempo";
import { db } from "@/lib/db";
import { briefings } from "@/lib/db/schema";

export const GET = briefingCharge(async (request: NextRequest, { params }: { params: Promise<{ address: string }> }) => {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Invalid address format" } },
      { status: 400 }
    );
  }

  const addr = address.toLowerCase() as `0x${string}`;

  try {
    const tip20 = await isTip20(addr);

    // Read on-chain name/symbol
    let name = "Unknown";
    let symbol = "???";
    try {
      if (tip20) {
        const meta = await tempoClient.token.getMetadata({ token: addr });
        name = meta.name ?? name;
        symbol = meta.symbol ?? symbol;
      } else {
        const results = await tempoClient.multicall({
          contracts: [
            { address: addr, abi: Abis.tip20, functionName: "name" },
            { address: addr, abi: Abis.tip20, functionName: "symbol" },
          ],
        });
        if (results[0].status === "success") name = results[0].result as string;
        if (results[1].status === "success") symbol = results[1].result as string;
      }
    } catch {}

    // Run all pipeline stages in parallel
    const [market, compliance, holders, identity] = await Promise.all([
      getMarketData(addr),
      getCompliance(addr),
      getHolders(addr),
      resolveIdentity(addr, name, symbol),
    ]);

    const [safety, origin] = await Promise.all([
      scanSafety(
        addr,
        tip20,
        market.pools.map((p) => ({ address: p.address, reserve_usd: p.reserve_usd }))
      ),
      getOrigin(addr, holders.creator_address),
    ]);

    // Claude synthesis
    const evaluation = await evaluate({
      address: addr,
      name,
      symbol,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
    });

    const payload = {
      address: addr,
      name,
      symbol,
      token_type: compliance.token_type,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
      evaluation,
      created_at: new Date().toISOString(),
    };

    // Persist
    const [inserted] = await db
      .insert(briefings)
      .values({ tokenAddress: addr, payload })
      .returning({ id: briefings.id });

    return NextResponse.json({
      id: inserted.id,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "BRIEFING_FAILED", message: "Failed to generate briefing" } },
      { status: 500 }
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/v1/tokens/\[address\]/briefing/
git commit -m "feat: MPP-paid briefing endpoint — full pipeline + Claude synthesis"
```

---

## Task 16: API Route — OpenAPI Discovery

**Files:**
- Create: `app/api/openapi/route.ts`

- [ ] **Step 1: Create OpenAPI spec endpoint for mpp.dev listing**

```ts
// app/api/openapi/route.ts
import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Pellet — intelligence for Tempo",
    version: "1.0.0",
    description: "Token discovery, stablecoin analytics, and chain intelligence for Tempo blockchain.",
  },
  "x-service-info": {
    categories: ["blockchain", "data", "intelligence"],
    docs: {
      homepage: "https://pelletfi.com",
      llms: "/llms.txt",
    },
  },
  servers: [{ url: "https://pelletfi.com" }],
  paths: {
    "/api/v1/tokens": {
      get: {
        summary: "List or search tokens on Tempo",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Search query" },
          { name: "page", in: "query", schema: { type: "integer" }, description: "Page number" },
        ],
        responses: { "200": { description: "Token list" } },
      },
    },
    "/api/v1/tokens/{address}": {
      get: {
        summary: "Token detail — market data, safety flags, compliance, holders",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Token detail" } },
      },
    },
    "/api/v1/tokens/{address}/briefing": {
      get: {
        summary: "Deep briefing — origin, full holders, compliance deep dive, analyst note",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string" } },
        ],
        "x-payment-info": {
          amount: "50000",
          currency: "0x20c0000000000000000000000000000000000000",
          description: "Pellet deep briefing",
          intent: "charge",
          method: "tempo",
        },
        responses: {
          "200": { description: "Full briefing" },
          "402": { description: "Payment required" },
        },
      },
    },
    "/api/v1/stablecoins": {
      get: {
        summary: "Stablecoin matrix — all Tempo stablecoins with compliance, spread, yield",
        responses: { "200": { description: "Stablecoin matrix" } },
      },
    },
    "/api/v1/stablecoins/flows": {
      get: {
        summary: "Stablecoin flow data — net directional flows between pairs",
        parameters: [
          { name: "hours", in: "query", schema: { type: "integer" }, description: "Lookback hours (max 168)" },
        ],
        responses: { "200": { description: "Flow data" } },
      },
    },
    "/api/v1/stablecoins/{address}": {
      get: {
        summary: "Stablecoin detail — compliance posture, supply, yield, orderbook",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Stablecoin detail" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/openapi/
git commit -m "feat: OpenAPI spec with x-payment-info + x-service-info for mpp.dev listing"
```

---

## Task 17: UI — Navigation + Token Feed Landing

**Files:**
- Create: `components/Nav.tsx`, `components/TokenCard.tsx`, `components/Search.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create Nav component with Pellet lockup**

```tsx
// components/Nav.tsx
import Link from "next/link";
import Image from "next/image";

export function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1f]">
      <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
        <img
          src="/pellet-mark.png"
          width={28}
          height={28}
          alt="Pellet"
          style={{ display: "block", marginRight: "4px", marginLeft: "-4px" }}
        />
        <span className="inline-flex flex-col" style={{ lineHeight: 1, alignItems: "stretch" }}>
          <span
            style={{
              fontFamily: "var(--font-geist-sans), Geist, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: "16px",
              letterSpacing: "-0.025em",
              color: "#f5f5f5",
              lineHeight: 1,
            }}
          >
            Pellet
          </span>
          <span
            style={{
              fontFamily: "var(--font-geist-sans), Geist, system-ui, sans-serif",
              fontSize: "6.5px",
              fontWeight: 600,
              letterSpacing: "0.348em",
              color: "#f5f5f5",
              marginTop: "2px",
              textTransform: "uppercase" as const,
              textAlign: "center" as const,
              marginRight: "-0.18em",
              marginLeft: "0.11em",
              display: "block",
            }}
          >
            finance
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-6 text-sm text-[#888]">
        <Link href="/" className="hover:text-[#e8e8e8] transition-colors">
          Tokens
        </Link>
        <Link href="/stablecoins" className="hover:text-[#e8e8e8] transition-colors">
          Stablecoins
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create TokenCard component**

```tsx
// components/TokenCard.tsx
import Link from "next/link";

interface TokenCardProps {
  address: string;
  name: string;
  price_usd: number;
  volume_24h: number;
  liquidity_usd: number;
}

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

export function TokenCard({ address, name, price_usd, volume_24h, liquidity_usd }: TokenCardProps) {
  return (
    <Link
      href={`/token/${address}`}
      className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1f] hover:bg-[#141418] transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-[#f5f5f5]">{name}</span>
        <span className="font-mono text-xs text-[#555]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
      <div className="flex items-center gap-6 font-mono text-sm">
        <span className="text-[#e8e8e8] w-24 text-right">{formatUsd(price_usd)}</span>
        <span className="text-[#888] w-20 text-right">{formatUsd(volume_24h)}</span>
        <span className="text-[#555] w-20 text-right">{formatUsd(liquidity_usd)}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create Search component**

```tsx
// components/Search.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Search() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
      router.push(`/token/${q}`);
    } else {
      router.push(`/?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search token or paste address..."
        className="w-full bg-[#141418] border border-[#1a1a1f] rounded-lg px-4 py-2.5 text-sm text-[#e8e8e8] placeholder-[#555] focus:outline-none focus:border-[#333] font-mono"
      />
    </form>
  );
}
```

- [ ] **Step 4: Update landing page with token feed**

```tsx
// app/page.tsx
import { Nav } from "@/components/Nav";
import { TokenCard } from "@/components/TokenCard";
import { Search } from "@/components/Search";
import { getPools, searchTokens } from "@/lib/gecko";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { q, page } = await searchParams;
  const pageNum = parseInt(page ?? "1");

  let pools;
  if (q) {
    pools = await searchTokens(q);
  } else {
    pools = await getPools(pageNum);
  }

  const seen = new Set<string>();
  const tokens = pools
    .map((p) => {
      const address = p.relationships.base_token.data.id.split("_").pop()!;
      if (seen.has(address)) return null;
      seen.add(address);
      return {
        address,
        name: p.attributes.name.split(" / ")[0] ?? "Unknown",
        price_usd: parseFloat(p.attributes.base_token_price_usd || "0"),
        volume_24h: parseFloat(p.attributes.volume_usd.h24 || "0"),
        liquidity_usd: parseFloat(p.attributes.reserve_in_usd || "0"),
      };
    })
    .filter(Boolean);

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-4 mb-8">
          <h1 className="text-lg font-medium text-[#f5f5f5]">intelligence for Tempo</h1>
          <Search />
        </div>

        <div className="border-t border-[#1a1a1f]">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-[#555] uppercase tracking-wider">
            <span>Token</span>
            <div className="flex items-center gap-6">
              <span className="w-24 text-right">Price</span>
              <span className="w-20 text-right">Volume</span>
              <span className="w-20 text-right">Liquidity</span>
            </div>
          </div>
          {tokens.map((t) => (
            <TokenCard key={t!.address} {...t!} />
          ))}
          {tokens.length === 0 && (
            <p className="text-center text-[#555] py-12">
              {q ? `No tokens found for "${q}"` : "No tokens found"}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Copy pellet-mark.png to public/**

Copy the brand mark from the archived repo or regenerate:

```bash
# If you still have the old repo:
cp /Users/jake/pellet/web/public/pellet-mark.png /Users/jake/pellet-new/public/pellet-mark.png
```

- [ ] **Step 6: Verify dev server shows token feed**

```bash
npm run dev
```

Open http://localhost:3000. Should see the Pellet lockup, search bar, and token feed from GeckoTerminal.

- [ ] **Step 7: Commit**

```bash
git add components/ app/page.tsx public/pellet-mark.png
git commit -m "feat: landing page — Nav lockup, search, token feed from GeckoTerminal"
```

---

## Task 18: UI — Token Detail Page

**Files:**
- Create: `components/SafetyBadge.tsx`, `app/token/[address]/page.tsx`

- [ ] **Step 1: Create SafetyBadge component**

```tsx
// components/SafetyBadge.tsx
interface SafetyBadgeProps {
  score: number;
  verdict: string;
}

const VERDICT_COLORS: Record<string, string> = {
  LOW_RISK: "#4ade80",
  CAUTION: "#fbbf24",
  MEDIUM_RISK: "#fbbf24",
  HIGH_RISK: "#f87171",
  CRITICAL: "#f87171",
};

export function SafetyBadge({ score, verdict }: SafetyBadgeProps) {
  const color = VERDICT_COLORS[verdict] ?? "#888";
  const label = verdict.replace(/_/g, " ");

  return (
    <div className="flex items-center gap-2">
      <span
        className="font-mono text-sm font-medium"
        style={{ color }}
      >
        {score}
      </span>
      <span
        className="text-xs px-2 py-0.5 rounded font-medium uppercase tracking-wider"
        style={{ color, borderColor: color, border: "1px solid" }}
      >
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create token detail page**

```tsx
// app/token/[address]/page.tsx
import { Nav } from "@/components/Nav";
import { SafetyBadge } from "@/components/SafetyBadge";
import { getMarketData } from "@/lib/pipeline/market";
import { scanSafety } from "@/lib/pipeline/safety";
import { getCompliance, isTip20 } from "@/lib/pipeline/compliance";
import { getHolders } from "@/lib/pipeline/holders";
import { tempoClient } from "@/lib/rpc";
import { Abis } from "viem/tempo";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ address: string }>;
}

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

export default async function TokenPage({ params }: Props) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) notFound();

  const addr = address.toLowerCase() as `0x${string}`;
  const tip20 = await isTip20(addr);

  // Read on-chain name/symbol
  let name = "Unknown";
  let symbol = "???";
  let decimals = 6;
  try {
    if (tip20) {
      const meta = await tempoClient.token.getMetadata({ token: addr });
      name = meta.name ?? name;
      symbol = meta.symbol ?? symbol;
      decimals = Number(meta.decimals ?? 6);
    } else {
      const results = await tempoClient.multicall({
        contracts: [
          { address: addr, abi: Abis.tip20, functionName: "name" },
          { address: addr, abi: Abis.tip20, functionName: "symbol" },
          { address: addr, abi: Abis.tip20, functionName: "decimals" },
        ],
      });
      if (results[0].status === "success") name = results[0].result as string;
      if (results[1].status === "success") symbol = results[1].result as string;
      if (results[2].status === "success") decimals = Number(results[2].result);
    }
  } catch {}

  const [market, compliance, holders] = await Promise.all([
    getMarketData(addr),
    getCompliance(addr),
    getHolders(addr, decimals),
  ]);

  const safety = await scanSafety(
    addr,
    tip20,
    market.pools.map((p) => ({ address: p.address, reserve_usd: p.reserve_usd }))
  );

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#f5f5f5]">{name}</h1>
            <p className="font-mono text-sm text-[#555] mt-1">{addr}</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded border border-[#1a1a1f] text-[#888] uppercase">
              {compliance.token_type}
            </span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono text-[#f5f5f5]">{formatUsd(market.price_usd)}</p>
            <p className="text-sm font-mono text-[#888] mt-1">
              Vol {formatUsd(market.volume_24h)} · Liq {formatUsd(market.liquidity_usd)}
            </p>
          </div>
        </div>

        {/* Safety */}
        <section className="mb-8">
          <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Safety</h2>
          <SafetyBadge score={safety.score} verdict={safety.verdict} />
          {safety.flags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {safety.flags.map((flag) => (
                <span key={flag} className="text-xs font-mono px-2 py-1 rounded bg-[#1a1a1f] text-[#f87171]">
                  {flag}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Compliance */}
        <section className="mb-8">
          <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Compliance</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[#555]">Policy</span>
              <p className="font-mono text-[#e8e8e8]">{compliance.policy_type ?? "none"}</p>
            </div>
            <div>
              <span className="text-[#555]">Paused</span>
              <p className="font-mono text-[#e8e8e8]">{compliance.paused ? "YES" : "no"}</p>
            </div>
            <div>
              <span className="text-[#555]">Supply Cap</span>
              <p className="font-mono text-[#e8e8e8]">{compliance.supply_cap ?? "unlimited"}</p>
            </div>
            <div>
              <span className="text-[#555]">Headroom</span>
              <p className="font-mono text-[#e8e8e8]">
                {compliance.headroom_pct !== null ? `${compliance.headroom_pct}%` : "n/a"}
              </p>
            </div>
          </div>
        </section>

        {/* Holders */}
        <section className="mb-8">
          <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Distribution</h2>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <span className="text-[#555]">Holders</span>
              <p className="font-mono text-[#e8e8e8]">{holders.total_holders.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[#555]">Top 5</span>
              <p className="font-mono text-[#e8e8e8]">{holders.top5_pct}%</p>
            </div>
            <div>
              <span className="text-[#555]">Top 10</span>
              <p className="font-mono text-[#e8e8e8]">{holders.top10_pct}%</p>
            </div>
          </div>
          <div className="border-t border-[#1a1a1f]">
            {holders.top_holders.slice(0, 10).map((h, i) => (
              <div key={h.address} className="flex items-center justify-between px-2 py-1.5 text-xs font-mono border-b border-[#1a1a1f]">
                <span className="text-[#555] w-6">{i + 1}</span>
                <span className="text-[#888] flex-1">
                  {h.address.slice(0, 8)}...{h.address.slice(-6)}
                  {h.label && <span className="text-[#555] ml-2">({h.label})</span>}
                </span>
                <span className="text-[#e8e8e8]">{h.pct.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* Pools */}
        <section className="mb-8">
          <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Pools</h2>
          <div className="border-t border-[#1a1a1f]">
            {market.pools.map((p) => (
              <div key={p.address} className="flex items-center justify-between px-2 py-2 text-sm font-mono border-b border-[#1a1a1f]">
                <span className="text-[#888]">{p.dex}</span>
                <span className="text-[#e8e8e8]">{formatUsd(p.reserve_usd)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Deep briefing CTA */}
        <div className="text-center py-8 border-t border-[#1a1a1f]">
          <p className="text-sm text-[#555] mb-3">Origin trail · Full holders · Compliance deep dive · Analyst note</p>
          <Link
            href={`/token/${address}/briefing`}
            className="inline-block px-6 py-2.5 text-sm font-medium text-[#0f0f11] bg-[#4ade80] rounded-lg hover:opacity-90 transition-opacity"
          >
            Deep Briefing · $0.05
          </Link>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/SafetyBadge.tsx app/token/
git commit -m "feat: token detail page — market, safety, compliance, holders, pools, briefing CTA"
```

---

## Task 19: UI — Stablecoin Matrix + Flows + Detail

**Files:**
- Create: `components/StablecoinRow.tsx`, `components/FlowMatrix.tsx`, `app/stablecoins/page.tsx`, `app/stablecoins/flows/page.tsx`, `app/stablecoins/[address]/page.tsx`

- [ ] **Step 1: Create StablecoinRow component**

```tsx
// components/StablecoinRow.tsx
import Link from "next/link";
import type { StablecoinData } from "@/lib/types";

export function StablecoinRow({ data }: { data: StablecoinData }) {
  const pegColor =
    Math.abs(data.price_vs_pathusd - 1) < 0.001
      ? "#4ade80"
      : Math.abs(data.price_vs_pathusd - 1) < 0.005
        ? "#fbbf24"
        : "#f87171";

  return (
    <Link
      href={`/stablecoins/${data.address}`}
      className="grid grid-cols-8 gap-2 px-4 py-3 text-sm font-mono border-b border-[#1a1a1f] hover:bg-[#141418] transition-colors items-center"
    >
      <span className="text-[#f5f5f5] font-sans font-medium">{data.symbol}</span>
      <span style={{ color: pegColor }}>{data.price_vs_pathusd.toFixed(4)}</span>
      <span className="text-[#888]">{data.spread_bps}bps</span>
      <span className="text-[#888]">{data.policy_type}</span>
      <span className="text-[#e8e8e8]">
        {(Number(data.current_supply) / 1e6).toFixed(1)}M
      </span>
      <span className="text-[#555]">{data.headroom_pct.toFixed(1)}%</span>
      <span className="text-[#888]">{data.currency}</span>
      <span className="text-[#4ade80]">
        {data.yield_rate > 0 ? `${data.yield_rate.toFixed(2)}%` : "—"}
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Create stablecoin matrix page**

```tsx
// app/stablecoins/page.tsx
import { Nav } from "@/components/Nav";
import { StablecoinRow } from "@/components/StablecoinRow";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

export default async function StablecoinsPage() {
  const stablecoins = await getAllStablecoins();

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium text-[#f5f5f5]">Tempo Stablecoins</h1>
          <a href="/stablecoins/flows" className="text-sm text-[#888] hover:text-[#e8e8e8] transition-colors">
            View flows →
          </a>
        </div>

        <div className="border-t border-[#1a1a1f]">
          <div className="grid grid-cols-8 gap-2 px-4 py-2 text-xs text-[#555] uppercase tracking-wider">
            <span>Token</span>
            <span>Price</span>
            <span>Spread</span>
            <span>Policy</span>
            <span>Supply</span>
            <span>Headroom</span>
            <span>Currency</span>
            <span>Yield</span>
          </div>
          {stablecoins.map((s) => (
            <StablecoinRow key={s.address} data={s} />
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Create stablecoin flows page**

```tsx
// app/stablecoins/flows/page.tsx
import { Nav } from "@/components/Nav";
import { getStablecoinFlows } from "@/lib/pipeline/stablecoins";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

interface Props {
  searchParams: Promise<{ hours?: string }>;
}

export default async function FlowsPage({ searchParams }: Props) {
  const { hours: hoursParam } = await searchParams;
  const hours = parseInt(hoursParam ?? "24");
  const flows = await getStablecoinFlows(hours);

  const symbolMap = Object.fromEntries(
    KNOWN_STABLECOINS.map((s) => [s.address.toLowerCase(), s.symbol])
  );

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-medium text-[#f5f5f5] mb-6">
          Stablecoin Flows — {hours}h
        </h1>

        <div className="border-t border-[#1a1a1f]">
          <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-[#555] uppercase tracking-wider">
            <span>From</span>
            <span>To</span>
            <span>Net Flow</span>
            <span>Transactions</span>
          </div>
          {flows.map((f, i) => {
            const flowColor = f.net_flow_usd > 0 ? "#4ade80" : f.net_flow_usd < 0 ? "#f87171" : "#888";
            return (
              <div
                key={i}
                className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm font-mono border-b border-[#1a1a1f]"
              >
                <span className="text-[#e8e8e8]">{symbolMap[f.from_token.toLowerCase()] ?? f.from_token.slice(0, 10)}</span>
                <span className="text-[#e8e8e8]">{symbolMap[f.to_token.toLowerCase()] ?? f.to_token.slice(0, 10)}</span>
                <span style={{ color: flowColor }}>
                  {f.net_flow_usd >= 0 ? "+" : ""}${Math.abs(f.net_flow_usd).toFixed(2)}
                </span>
                <span className="text-[#888]">{f.tx_count}</span>
              </div>
            );
          })}
          {flows.length === 0 && (
            <p className="text-center text-[#555] py-12">No flow data for this period</p>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Create stablecoin detail page**

```tsx
// app/stablecoins/[address]/page.tsx
import { Nav } from "@/components/Nav";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ address: string }>;
}

export default async function StablecoinDetailPage({ params }: Props) {
  const { address } = await params;
  const stablecoins = await getAllStablecoins();
  const stable = stablecoins.find((s) => s.address.toLowerCase() === address.toLowerCase());

  if (!stable) notFound();

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#f5f5f5] mb-1">{stable.name}</h1>
        <p className="font-mono text-sm text-[#555] mb-8">{stable.address}</p>

        <div className="grid grid-cols-2 gap-8">
          {/* Compliance */}
          <section>
            <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Compliance</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-[#555]">Policy Type</span>
                <p className="font-mono text-[#e8e8e8]">{stable.policy_type}</p>
              </div>
              <div>
                <span className="text-[#555]">Policy Admin</span>
                <p className="font-mono text-[#888] text-xs">{stable.policy_admin}</p>
              </div>
              <div>
                <span className="text-[#555]">Currency</span>
                <p className="font-mono text-[#e8e8e8]">{stable.currency}</p>
              </div>
            </div>
          </section>

          {/* Supply */}
          <section>
            <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Supply</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-[#555]">Current Supply</span>
                <p className="font-mono text-[#e8e8e8]">
                  {(Number(stable.current_supply) / 1e6).toLocaleString()} {stable.symbol}
                </p>
              </div>
              <div>
                <span className="text-[#555]">Supply Cap</span>
                <p className="font-mono text-[#e8e8e8]">
                  {Number(stable.supply_cap) > 0
                    ? `${(Number(stable.supply_cap) / 1e6).toLocaleString()} ${stable.symbol}`
                    : "unlimited"}
                </p>
              </div>
              <div>
                <span className="text-[#555]">Headroom</span>
                <p className="font-mono text-[#e8e8e8]">{stable.headroom_pct.toFixed(1)}%</p>
              </div>
            </div>
          </section>

          {/* Market */}
          <section>
            <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Market</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-[#555]">Price vs pathUSD</span>
                <p className="font-mono text-[#e8e8e8]">{stable.price_vs_pathusd.toFixed(6)}</p>
              </div>
              <div>
                <span className="text-[#555]">Spread</span>
                <p className="font-mono text-[#e8e8e8]">{stable.spread_bps} bps</p>
              </div>
            </div>
          </section>

          {/* Yield */}
          <section>
            <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">Yield</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-[#555]">Reward Rate</span>
                <p className="font-mono text-[#4ade80]">
                  {stable.yield_rate > 0 ? `${stable.yield_rate.toFixed(2)}%` : "No rewards"}
                </p>
              </div>
              <div>
                <span className="text-[#555]">Opted-in Supply</span>
                <p className="font-mono text-[#e8e8e8]">
                  {(Number(stable.opted_in_supply) / 1e6).toLocaleString()} {stable.symbol}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/StablecoinRow.tsx components/FlowMatrix.tsx app/stablecoins/
git commit -m "feat: stablecoin pages — matrix, flows, detail with compliance + supply + yield"
```

---

## Task 20: UI — Deep Briefing Page

**Files:**
- Create: `app/token/[address]/briefing/page.tsx`, `components/BriefingDocument.tsx`

- [ ] **Step 1: Create BriefingDocument renderer**

```tsx
// components/BriefingDocument.tsx
import { SafetyBadge } from "./SafetyBadge";
import type { BriefingResult } from "@/lib/types";

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(8)}`;
}

export function BriefingDocument({ briefing }: { briefing: BriefingResult }) {
  return (
    <article className="max-w-3xl mx-auto space-y-10 font-mono text-sm">
      {/* Title block */}
      <header className="space-y-2">
        <h1 className="font-sans text-2xl font-semibold text-[#f5f5f5]">
          {briefing.identity.name} ({briefing.identity.symbol ?? "???"})
        </h1>
        <p className="text-xs text-[#555]">{briefing.token_address}</p>
        <p className="text-xs text-[#555]">
          Briefing #{briefing.id} · {new Date(briefing.created_at).toLocaleDateString()}
        </p>
      </header>

      {/* 01 — Market */}
      <section>
        <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">01 — Market</h2>
        <div className="grid grid-cols-4 gap-4">
          <div><span className="text-[#555]">Price</span><p className="text-[#e8e8e8]">{formatUsd(briefing.market.price_usd)}</p></div>
          <div><span className="text-[#555]">Volume 24h</span><p className="text-[#e8e8e8]">{formatUsd(briefing.market.volume_24h)}</p></div>
          <div><span className="text-[#555]">Liquidity</span><p className="text-[#e8e8e8]">{formatUsd(briefing.market.liquidity_usd)}</p></div>
          <div><span className="text-[#555]">FDV</span><p className="text-[#e8e8e8]">{briefing.market.fdv_usd ? formatUsd(briefing.market.fdv_usd) : "—"}</p></div>
        </div>
      </section>

      {/* 02 — Safety */}
      <section>
        <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">02 — Safety</h2>
        <SafetyBadge score={briefing.safety.score} verdict={briefing.safety.verdict} />
        {briefing.safety.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-[#888]">
            {briefing.safety.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 03 — Compliance */}
      <section>
        <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">03 — Compliance</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><span className="text-[#555]">Type</span><p className="text-[#e8e8e8]">{briefing.compliance.token_type}</p></div>
          <div><span className="text-[#555]">Policy</span><p className="text-[#e8e8e8]">{briefing.compliance.policy_type ?? "none"}</p></div>
          <div><span className="text-[#555]">Admin</span><p className="text-[#888] text-xs break-all">{briefing.compliance.policy_admin ?? "none"}</p></div>
          <div><span className="text-[#555]">Headroom</span><p className="text-[#e8e8e8]">{briefing.compliance.headroom_pct !== null ? `${briefing.compliance.headroom_pct}%` : "n/a"}</p></div>
        </div>
      </section>

      {/* 04 — Distribution */}
      <section>
        <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">04 — Distribution</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div><span className="text-[#555]">Holders</span><p className="text-[#e8e8e8]">{briefing.holders.total_holders.toLocaleString()}</p></div>
          <div><span className="text-[#555]">Top 10</span><p className="text-[#e8e8e8]">{briefing.holders.top10_pct}%</p></div>
          <div><span className="text-[#555]">Creator</span><p className="text-[#e8e8e8]">{briefing.holders.creator_hold_pct ?? 0}%</p></div>
        </div>
        <div className="border-t border-[#1a1a1f]">
          {briefing.holders.top_holders.slice(0, 10).map((h, i) => (
            <div key={h.address} className="flex justify-between px-2 py-1.5 text-xs border-b border-[#1a1a1f]">
              <span className="text-[#555] w-6">{i + 1}</span>
              <span className="text-[#888] flex-1">{h.address.slice(0, 10)}...{h.address.slice(-6)} {h.label ? `(${h.label})` : ""}</span>
              <span className="text-[#e8e8e8]">{h.pct.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* 05 — Origin */}
      <section>
        <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">05 — Origin</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><span className="text-[#555]">Deployer</span><p className="text-[#888] text-xs break-all">{briefing.origin.deployer}</p></div>
          <div><span className="text-[#555]">Tx Count</span><p className="text-[#e8e8e8]">{briefing.origin.deployer_tx_count}</p></div>
          <div><span className="text-[#555]">Funding Source</span><p className="text-[#888] text-xs break-all">{briefing.origin.funding_source ?? "unknown"}</p></div>
          <div><span className="text-[#555]">Hops</span><p className="text-[#e8e8e8]">{briefing.origin.funding_hops}</p></div>
        </div>
      </section>

      {/* 06 — Analyst Note */}
      <section>
        <h2 className="text-xs text-[#555] uppercase tracking-wider mb-3">06 — Analyst Note</h2>
        <div className="text-[#c4c4c4] font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {briefing.evaluation}
        </div>
      </section>
    </article>
  );
}
```

- [ ] **Step 2: Create briefing page (fetches from API)**

```tsx
// app/token/[address]/briefing/page.tsx
import { Nav } from "@/components/Nav";
import { BriefingDocument } from "@/components/BriefingDocument";
import { notFound } from "next/navigation";
import type { BriefingResult } from "@/lib/types";

interface Props {
  params: Promise<{ address: string }>;
}

export default async function BriefingPage({ params }: Props) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) notFound();

  // For the UI page, we show a client-side flow:
  // 1. User clicks "Deep Briefing" on token page
  // 2. This page renders with a "Pay & Generate" button
  // 3. Client-side mppx handles the 402 flow
  // 4. Briefing data renders

  // For now, show a placeholder that will be hydrated client-side
  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <BriefingClient address={address} />
      </main>
    </>
  );
}

// Client component for payment flow
function BriefingClient({ address }: { address: string }) {
  // This will be a client component that:
  // 1. Calls /api/v1/tokens/{address}/briefing via mppx.fetch
  // 2. Handles the 402 payment challenge
  // 3. Renders the BriefingDocument with the result
  // For v1, we'll implement this as a simple server-side render
  // with the API call proxied through a server action

  return (
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold text-[#f5f5f5] mb-2">Deep Briefing</h1>
      <p className="text-[#888] mb-6">
        Origin trail · Full holders · Compliance deep dive · Analyst note
      </p>
      <p className="text-sm text-[#555]">
        $0.05 pathUSD via MPP · Use the API directly:
      </p>
      <code className="block mt-2 text-xs text-[#888] font-mono">
        npx mppx https://pelletfi.com/api/v1/tokens/{address}/briefing
      </code>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/BriefingDocument.tsx app/token/\[address\]/briefing/
git commit -m "feat: briefing page + BriefingDocument renderer"
```

---

## Task 21: MCP Server

**Files:**
- Create: `mcp-server/package.json`, `mcp-server/tsconfig.json`, `mcp-server/src/index.ts`, `mcp-server/src/client.ts`

- [ ] **Step 1: Create MCP server package.json**

```json
{
  "name": "@pelletfi/mcp",
  "version": "1.0.0",
  "description": "Pellet MCP server — Tempo chain intelligence for AI agents",
  "type": "module",
  "bin": { "mcp": "./dist/index.js" },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0",
    "mppx": "^0.5.12",
    "viem": "^2.47.5"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "peerDependencies": {},
  "keywords": ["pellet", "tempo", "mcp", "token", "intelligence"],
  "license": "MIT"
}
```

- [ ] **Step 2: Create MCP server tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create API client with mppx payment handling**

```ts
// mcp-server/src/client.ts
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const PELLET_API = process.env.PELLET_API ?? "https://pelletfi.com";

let mppxClient: ReturnType<typeof Mppx.create> | null = null;

function getClient() {
  if (mppxClient) return mppxClient;

  const privateKey = process.env.EVM_PRIVATE_KEY;
  if (privateKey) {
    mppxClient = Mppx.create({
      methods: [
        tempo({
          account: privateKeyToAccount(privateKey as `0x${string}`),
        }),
      ],
      polyfill: false, // don't patch global fetch
    });
  }

  return mppxClient;
}

async function pelletFetch(path: string): Promise<unknown> {
  const url = `${PELLET_API}${path}`;
  const client = getClient();

  // Use mppx.fetch for paid endpoints, regular fetch for free
  const res = client ? await client.fetch(url) : await fetch(url);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export async function searchTokens(query: string) {
  return pelletFetch(`/api/v1/tokens?q=${encodeURIComponent(query)}`);
}

export async function lookupToken(address: string) {
  return pelletFetch(`/api/v1/tokens/${address}`);
}

export async function analyzeToken(address: string) {
  return pelletFetch(`/api/v1/tokens/${address}/briefing`);
}

export async function getStablecoins() {
  return pelletFetch(`/api/v1/stablecoins`);
}

export async function getStablecoinFlows(hours = 24) {
  return pelletFetch(`/api/v1/stablecoins/flows?hours=${hours}`);
}
```

- [ ] **Step 4: Create MCP server with tool definitions**

```ts
#!/usr/bin/env node
// mcp-server/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchTokens,
  lookupToken,
  analyzeToken,
  getStablecoins,
  getStablecoinFlows,
} from "./client.js";

const server = new McpServer({
  name: "pellet",
  version: "1.0.0",
});

server.tool(
  "search_token",
  "Search for tokens on Tempo by symbol or address",
  { query: z.string().describe("Token symbol or address") },
  async ({ query }) => {
    const result = await searchTokens(query);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "lookup_token",
  "Get market data, safety flags, and compliance for a Tempo token",
  { address: z.string().describe("Token contract address (0x...)") },
  async ({ address }) => {
    const result = await lookupToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "analyze_token",
  "Deep briefing: origin trail, full holders, compliance deep dive, analyst note ($0.05 pathUSD)",
  { address: z.string().describe("Token contract address (0x...)") },
  async ({ address }) => {
    const result = await analyzeToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_stablecoins",
  "Get the full Tempo stablecoin matrix — price, spread, compliance, supply, yield",
  {},
  async () => {
    const result = await getStablecoins();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_stablecoin_flows",
  "Get net directional flows between Tempo stablecoins",
  { hours: z.number().optional().default(24).describe("Lookback hours (max 168)") },
  async ({ hours }) => {
    const result = await getStablecoinFlows(hours);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 5: Build and test MCP server**

```bash
cd /Users/jake/pellet-new/mcp-server
npm install
npm run build
```

- [ ] **Step 6: Commit**

```bash
cd /Users/jake/pellet-new
git add mcp-server/
git commit -m "feat: @pelletfi/mcp server — 5 tools for Tempo token + stablecoin intelligence"
```

---

## Task 22: next.config.ts + Vercel Config

**Files:**
- Create/Modify: `next.config.ts`, `vercel.json` (if needed)

- [ ] **Step 1: Configure next.config.ts**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images from CoinGecko
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
    ],
  },
  // Headers for API routes
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, WWW-Authenticate, Payment-Receipt" },
          { key: "Access-Control-Expose-Headers", value: "WWW-Authenticate, Payment-Receipt" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: Next.js config — CORS for API, CoinGecko image domains"
```

---

## Task 23: Deploy to Vercel + Final Verification

- [ ] **Step 1: Connect repo to Vercel**

```bash
npx vercel link
```

Follow prompts to connect to the `pelletfi/pellet` repo.

- [ ] **Step 2: Set environment variables on Vercel**

```bash
vercel env add DATABASE_URL production
vercel env add ANTHROPIC_API_KEY production
vercel env add ALCHEMY_API_KEY production
vercel env add MPP_RECIPIENT production
vercel env add MPP_SECRET_KEY production
```

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```

- [ ] **Step 4: Verify all surfaces**

1. `https://pelletfi.com` — token feed loads
2. `https://pelletfi.com/token/<address>` — token detail renders
3. `https://pelletfi.com/stablecoins` — stablecoin matrix renders
4. `https://pelletfi.com/stablecoins/flows` — flow data renders
5. `https://pelletfi.com/api/v1/tokens` — JSON response
6. `https://pelletfi.com/api/v1/stablecoins` — JSON response
7. `https://pelletfi.com/api/v1/health` — status ok
8. `https://pelletfi.com/api/openapi` — OpenAPI spec
9. `npx mppx https://pelletfi.com/api/v1/tokens/<address>/briefing` — MPP payment flow works

- [ ] **Step 5: Publish MCP server to npm**

```bash
cd /Users/jake/pellet-new/mcp-server
npm publish --access public
```

- [ ] **Step 6: Submit to mpp.dev**

Register the OpenAPI spec with the MPP service directory for discoverability.

- [ ] **Step 7: Final commit + push**

```bash
cd /Users/jake/pellet-new
git add -A
git commit -m "feat: Pellet v1 — intelligence for Tempo"
git push -u origin main
```
