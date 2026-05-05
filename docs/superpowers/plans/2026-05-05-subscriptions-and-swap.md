# Subscriptions & Token Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pro subscription tier ($5/mo, on-chain USDC payment, gates agent count + fee rate) and a token swap UI (any-to-any between pathUSD, USDC.e, and USDT0 via Tempo's native stablecoin DEX precompile).

**Architecture:** Two independent features sharing the same wallet client infrastructure. Subscriptions add a `wallet_subscriptions` table, a payment route, fee-rate lookup in `executePayment`, and a free-tier agent gate in the OAuth token endpoint. Swap adds a quote+execute route and a dashboard card, both using `client.dex.sell` / `client.dex.getSellQuote` from `viem/tempo`.

**Tech Stack:** Next.js App Router, Drizzle ORM (Postgres), viem + viem/tempo (Tempo chain), CSS-in-component (dashboard styling pattern).

---

## File Map

### Subscription tier
| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/wallet/subscriptions.ts` | Subscription queries: `getActiveSubscription`, `countActiveAgentConnections`, `resolveFeeBps` |
| Modify | `lib/db/schema.ts` | Add `walletSubscriptions` table |
| Create | `drizzle/0015_subscriptions.sql` | Migration for new table |
| Create | `app/api/wallet/subscribe/route.ts` | POST — pay 5 USDC, create subscription row |
| Modify | `lib/wallet/execute-payment.ts` | Use `resolveFeeBps` instead of hardcoded `platformFeeConfig` |
| Modify | `app/oauth/token/route.ts` | Gate: reject new agent connection if free tier + already at 1 |
| Modify | `app/wallet/dashboard/Dashboard.tsx` | Subscription card (plan, expiry, upgrade button) |
| Modify | `app/wallet/dashboard/page.tsx` | Pass subscription data to Dashboard |

### Token swap
| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/wallet/tempo-config.ts` | Add `usdt0` address to ChainConfig (Presto only) |
| Modify | `lib/wallet/tempo-balance.ts` | Read USDT0 balance on mainnet |
| Create | `lib/wallet/execute-swap.ts` | Quote + execute swap via DEX precompile |
| Create | `app/api/wallet/swap/route.ts` | POST — quote or execute a swap |
| Modify | `app/wallet/dashboard/Dashboard.tsx` | Swap card with token picker (pathUSD, USDC.e, USDT0) |

---

## Task 1: Subscription schema + migration

**Files:**
- Modify: `lib/db/schema.ts` (after `walletSpendLog`, ~line 246)
- Create: `drizzle/0015_subscriptions.sql`

- [ ] **Step 1: Add walletSubscriptions table to schema**

In `lib/db/schema.ts`, after the `walletSpendLog` table definition (line 246), add:

```ts
export const walletSubscriptions = pgTable(
  "wallet_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => walletUsers.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(), // "pro"
    amountWei: text("amount_wei").notNull(),
    txHash: text("tx_hash").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wallet_subscriptions_user_idx").on(t.userId, t.expiresAt),
  }),
);
```

- [ ] **Step 2: Write migration**

Create `drizzle/0015_subscriptions.sql`:

```sql
CREATE TABLE "wallet_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "plan" text NOT NULL,
  "amount_wei" text NOT NULL,
  "tx_hash" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "wallet_subscriptions_user_idx" ON "wallet_subscriptions" USING btree ("user_id", "expires_at");
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit, no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts drizzle/0015_subscriptions.sql
git commit -m "schema: add wallet_subscriptions table for pro tier billing"
```

---

## Task 2: Subscription query helpers

**Files:**
- Create: `lib/wallet/subscriptions.ts`

- [ ] **Step 1: Create `lib/wallet/subscriptions.ts`**

```ts
import { db } from "@/lib/db/client";
import { walletSubscriptions, walletAgentConnections } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { platformFeeConfig, computeFee } from "./tempo-config";

const PRO_FEE_BPS = 25; // 0.25%

export type ActiveSubscription = {
  id: string;
  plan: string;
  expiresAt: Date;
};

export async function getActiveSubscription(
  userId: string,
): Promise<ActiveSubscription | null> {
  const rows = await db
    .select({
      id: walletSubscriptions.id,
      plan: walletSubscriptions.plan,
      expiresAt: walletSubscriptions.expiresAt,
    })
    .from(walletSubscriptions)
    .where(
      and(
        eq(walletSubscriptions.userId, userId),
        sql`${walletSubscriptions.expiresAt} > now()`,
      ),
    )
    .orderBy(sql`${walletSubscriptions.expiresAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

export async function countActiveAgentConnections(
  userId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(walletAgentConnections)
    .where(
      and(
        eq(walletAgentConnections.userId, userId),
        isNull(walletAgentConnections.revokedAt),
      ),
    );
  return result[0]?.count ?? 0;
}

export async function resolveFeeBps(userId: string): Promise<number> {
  const feeConfig = platformFeeConfig();
  if (!feeConfig.enabled) return 0;
  const sub = await getActiveSubscription(userId);
  if (sub) return PRO_FEE_BPS;
  return feeConfig.bps;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add lib/wallet/subscriptions.ts
git commit -m "feat: subscription query helpers — active sub, agent count, fee resolution"
```

---

## Task 3: Wire dynamic fee rate into executePayment

**Files:**
- Modify: `lib/wallet/execute-payment.ts`

- [ ] **Step 1: Import resolveFeeBps**

At the top of `execute-payment.ts`, update the import:

```ts
// Replace this line:
import { tempoChainConfig, platformFeeConfig, computeFee } from "@/lib/wallet/tempo-config";
// With:
import { tempoChainConfig, platformFeeConfig, computeFee } from "@/lib/wallet/tempo-config";
import { resolveFeeBps } from "@/lib/wallet/subscriptions";
```

- [ ] **Step 2: Replace static fee config with dynamic resolution**

In `executePayment`, replace the fee computation block (lines ~192-199):

```ts
// Replace this:
const feeConfig = platformFeeConfig();
let feeWei = BigInt(0);
let recipientWei = amountWei;
if (feeConfig.enabled) {
  const split = computeFee(amountWei, feeConfig.bps);
  feeWei = split.fee;
  recipientWei = split.remainder;
}

// With:
const feeConfig = platformFeeConfig();
let feeWei = BigInt(0);
let recipientWei = amountWei;
if (feeConfig.enabled) {
  const bps = await resolveFeeBps(session.userId);
  if (bps > 0) {
    const split = computeFee(amountWei, bps);
    feeWei = split.fee;
    recipientWei = split.remainder;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
git add lib/wallet/execute-payment.ts
git commit -m "feat: dynamic fee rate — pro subscribers pay 0.25%, free pays 1%"
```

---

## Task 4: Subscribe API route

**Files:**
- Create: `app/api/wallet/subscribe/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { executePayment } from "@/lib/wallet/execute-payment";
import { getActiveSubscription } from "@/lib/wallet/subscriptions";
import { db } from "@/lib/db/client";
import { walletSubscriptions } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRO_PRICE_WEI = "5000000"; // 5 USDC (6 decimals)
const PRO_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST(req: Request) {
  const resolved = await requireSession(req, { requireOnChainAuthorize: true });
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const rl = rateLimit(`subscribe:${user.id}`, { max: 3, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  const existing = await getActiveSubscription(user.id);
  if (existing) {
    return NextResponse.json(
      { error: "already subscribed", expires_at: existing.expiresAt.toISOString() },
      { status: 409 },
    );
  }

  const treasury = process.env.PLATFORM_TREASURY_ADDRESS;
  if (!treasury || !/^0x[0-9a-fA-F]{40}$/.test(treasury)) {
    return NextResponse.json({ error: "subscriptions not configured" }, { status: 503 });
  }

  if (!user.publicKeyUncompressed) {
    return NextResponse.json({ error: "wallet user missing on-chain identity" }, { status: 500 });
  }

  const result = await executePayment({
    session,
    user: { ...user, publicKeyUncompressed: user.publicKeyUncompressed },
    to: treasury as `0x${string}`,
    amountWei: BigInt(PRO_PRICE_WEI),
    memo: "subscription:pro",
    token: tempoChainConfig().usdcE,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PRO_DURATION_MS);

  const [sub] = await db
    .insert(walletSubscriptions)
    .values({
      userId: user.id,
      plan: "pro",
      amountWei: PRO_PRICE_WEI,
      txHash: result.txHash,
      startsAt: now,
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    subscription: {
      id: sub.id,
      plan: sub.plan,
      starts_at: sub.startsAt.toISOString(),
      expires_at: sub.expiresAt.toISOString(),
      tx_hash: result.txHash,
      explorer_url: result.explorerUrl,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add app/api/wallet/subscribe/route.ts
git commit -m "feat: POST /api/wallet/subscribe — pay 5 USDC for 30-day pro"
```

---

## Task 5: Agent connection gate (free tier = 1 agent max)

**Files:**
- Modify: `app/oauth/token/route.ts`

- [ ] **Step 1: Import helpers**

At the top of `app/oauth/token/route.ts`, add:

```ts
import { getActiveSubscription, countActiveAgentConnections } from "@/lib/wallet/subscriptions";
```

- [ ] **Step 2: Add gate before `recordAgentConnection`**

Before the `recordAgentConnection` call (~line 115), add the free-tier check:

```ts
  // Free tier: 1 agent connection max.
  const sub = await getActiveSubscription(codeRow.userId);
  if (!sub) {
    const count = await countActiveAgentConnections(codeRow.userId);
    if (count >= 1) {
      return NextResponse.json(
        {
          error: "agent_limit_reached",
          error_description: "Free tier allows 1 agent. Upgrade to Pro for unlimited.",
        },
        { status: 403 },
      );
    }
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
git add app/oauth/token/route.ts
git commit -m "feat: free-tier gate — 1 agent max, pro unlocks unlimited"
```

---

## Task 6: Add USDT0 to chain config + balance reader

**Files:**
- Modify: `lib/wallet/tempo-config.ts`
- Modify: `lib/wallet/tempo-balance.ts`

- [ ] **Step 1: Add usdt0 to ChainConfig**

In `lib/wallet/tempo-config.ts`, add `usdt0` to the `ChainConfig` type:

```ts
type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  sponsorUrl: string | null;
  explorerUrl: string;
  usdcE: `0x${string}`;
  usdt0: `0x${string}` | null; // mainnet only — bridged Tether
  demoStable: `0x${string}`;
};
```

Set it on each chain config:

```ts
// MODERATO:
usdt0: null, // not on testnet

// PRESTO:
usdt0: "0x20c00000000000000000000014f22ca97301eb73",
```

- [ ] **Step 2: Add USDT0 to balance reader**

In `lib/wallet/tempo-balance.ts`, after the USDC.e entry in the `tokens` array, add:

```ts
if (chain.usdt0) {
  tokens.push({ address: chain.usdt0, symbol: "USDT0" });
}
```

This shows USDT0 balance on mainnet alongside USDC.e and pathUSD.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
git add lib/wallet/tempo-config.ts lib/wallet/tempo-balance.ts
git commit -m "feat: add USDT0 to chain config and balance reader (Presto mainnet)"
```

---

## Task 7: Token swap execution logic

**Files:**
- Create: `lib/wallet/execute-swap.ts`

- [ ] **Step 1: Create `lib/wallet/execute-swap.ts`**

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, withRelay, tempoActions } from "viem/tempo";
import { decryptSessionKey } from "./session-keys";
import { tempoChainConfig } from "./tempo-config";

type WalletSessionRow = {
  sessionKeyCiphertext: Buffer | null;
  authorizeTxHash: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

type SwapUser = {
  managedAddress: string;
  publicKeyUncompressed: string;
};

export type SwapQuoteInput = {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
};

export type SwapQuoteResult =
  | { ok: true; amountOut: bigint; amountOutDisplay: string }
  | { ok: false; error: string; status: number };

export type SwapExecuteInput = {
  session: WalletSessionRow;
  user: SwapUser;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
};

export type SwapExecuteResult =
  | { ok: true; txHash: `0x${string}`; explorerUrl: string }
  | { ok: false; error: string; detail?: string; status: number };

export async function quoteSwap(input: SwapQuoteInput): Promise<SwapQuoteResult> {
  const chain = tempoChainConfig();
  const viemChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;

  const client = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  }).extend(tempoActions());

  try {
    const amountOut = await client.dex.getSellQuote({
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: input.amountIn,
    });
    const amountOutDisplay = (Number(amountOut) / 1_000_000).toFixed(2);
    return { ok: true, amountOut, amountOutDisplay };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `quote failed: ${detail}`, status: 502 };
  }
}

export async function executeSwap(input: SwapExecuteInput): Promise<SwapExecuteResult> {
  const { session, user, tokenIn, tokenOut, amountIn, minAmountOut } = input;

  if (!session.sessionKeyCiphertext) {
    return { ok: false, error: "session has no agent key", status: 500 };
  }
  if (!session.authorizeTxHash) {
    return { ok: false, error: "session not on-chain authorized", status: 403 };
  }
  if (session.revokedAt) {
    return { ok: false, error: "session revoked", status: 403 };
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "session expired", status: 403 };
  }

  let agentPk: `0x${string}`;
  try {
    agentPk = decryptSessionKey(Buffer.from(session.sessionKeyCiphertext));
  } catch (e) {
    return { ok: false, error: "session key undecryptable", detail: String(e), status: 500 };
  }

  const chain = tempoChainConfig();
  const viemBaseChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const viemChain = { ...viemBaseChain, feeToken: chain.usdcE };

  const userAccount = Account.fromWebAuthnP256(
    { id: "noop", publicKey: user.publicKeyUncompressed as `0x${string}` },
    { rpId: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network" },
  );
  const accessKey = Account.fromSecp256k1(agentPk, { access: userAccount });

  if (!chain.sponsorUrl) {
    return { ok: false, error: "no sponsor configured", status: 500 };
  }

  const client = createWalletClient({
    account: accessKey,
    chain: viemChain,
    transport: withRelay(http(chain.rpcUrl), http(chain.sponsorUrl), { policy: "sign-only" }),
  }).extend(tempoActions());

  try {
    const txHash = await client.dex.sell({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
    });
    return {
      ok: true,
      txHash,
      explorerUrl: `${chain.explorerUrl}/tx/${txHash}`,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: "swap failed", detail, status: 500 };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add lib/wallet/execute-swap.ts
git commit -m "feat: swap execution — quote and execute via Tempo DEX precompile"
```

---

## Task 8: Swap API route

**Files:**
- Create: `app/api/wallet/swap/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { quoteSwap, executeSwap } from "@/lib/wallet/execute-swap";
import { rateLimit } from "@/lib/rate-limit";
import { isAddress, parseUnits } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN_DECIMALS = 6;
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

type SwapBody = {
  token_in: `0x${string}`;
  token_out: `0x${string}`;
  amount: string; // human-readable, e.g. "10.5"
  slippage_bps?: number;
  quote_only?: boolean;
};

export async function POST(req: Request) {
  const resolved = await requireSession(req, { requireOnChainAuthorize: true });
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const rl = rateLimit(`swap:${user.id}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  let body: SwapBody;
  try {
    body = (await req.json()) as SwapBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.token_in || !isAddress(body.token_in)) {
    return NextResponse.json({ error: "token_in must be a hex address" }, { status: 400 });
  }
  if (!body.token_out || !isAddress(body.token_out)) {
    return NextResponse.json({ error: "token_out must be a hex address" }, { status: 400 });
  }
  if (!body.amount) {
    return NextResponse.json({ error: "amount required" }, { status: 400 });
  }

  let amountIn: bigint;
  try {
    amountIn = parseUnits(body.amount, TOKEN_DECIMALS);
    if (amountIn <= BigInt(0)) throw new Error("must be positive");
  } catch {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  // Quote
  const quote = await quoteSwap({
    tokenIn: body.token_in,
    tokenOut: body.token_out,
    amountIn,
  });

  if (!quote.ok) {
    return NextResponse.json({ error: quote.error }, { status: quote.status });
  }

  if (body.quote_only) {
    return NextResponse.json({
      ok: true,
      quote_only: true,
      amount_in: body.amount,
      amount_out: quote.amountOutDisplay,
      amount_out_wei: quote.amountOut.toString(),
    });
  }

  // Execute with slippage
  const slippageBps = body.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
  const minAmountOut = quote.amountOut - (quote.amountOut * BigInt(slippageBps)) / BigInt(10_000);

  if (!user.publicKeyUncompressed) {
    return NextResponse.json({ error: "wallet user missing on-chain identity" }, { status: 500 });
  }

  const result = await executeSwap({
    session,
    user: { ...user, publicKeyUncompressed: user.publicKeyUncompressed },
    tokenIn: body.token_in,
    tokenOut: body.token_out,
    amountIn,
    minAmountOut,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    tx_hash: result.txHash,
    explorer_url: result.explorerUrl,
    amount_in: body.amount,
    amount_out: quote.amountOutDisplay,
    token_in: body.token_in,
    token_out: body.token_out,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add app/api/wallet/swap/route.ts
git commit -m "feat: POST /api/wallet/swap — quote and execute via Tempo DEX"
```

---

## Task 9: Dashboard — subscription card, balances card with inline swap

**Files:**
- Modify: `app/wallet/dashboard/page.tsx` (server component — pass subscription data)
- Modify: `app/wallet/dashboard/Dashboard.tsx` (client component — render cards)

- [ ] **Step 1: Pass subscription data from server component**

In `app/wallet/dashboard/page.tsx`, inside `renderDashboard()`:

Add import at top:
```ts
import { getActiveSubscription } from "@/lib/wallet/subscriptions";
```

After the `balances` block (after line ~97), add:
```ts
  let subscription: { plan: string; expiresAt: string } | null = null;
  try {
    const sub = await getActiveSubscription(user.id);
    if (sub) {
      subscription = { plan: sub.plan, expiresAt: sub.expiresAt.toISOString() };
    }
  } catch {
    /* leave null */
  }
```

Add `subscription` to the `<Dashboard>` props:
```tsx
  <Dashboard
    user={...}
    balances={...}
    chart={chart}
    sessions={...}
    payments={...}
    basePath={basePath}
    subscription={subscription}
  />
```

- [ ] **Step 2: Add subscription + swap types and props to Dashboard**

In `Dashboard.tsx`, add `Subscription` type after the existing types (around line 43):

```ts
type Subscription = {
  plan: string;
  expiresAt: string;
} | null;
```

Add to the `Dashboard` function signature:
```ts
  subscription = null as Subscription,
```

- [ ] **Step 3: Add subscription card to Dashboard JSX**

After the balance card section, add:

```tsx
{/* Subscription */}
<div className="dash-card">
  <div className="dash-card-head">
    <h2 className="dash-card-h2">Plan</h2>
    <span className="dash-card-meta">
      {subscription ? "PRO" : "FREE"}
    </span>
  </div>
  {subscription ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="dash-mono" style={{ fontSize: 14 }}>
        Pro — expires {new Date(subscription.expiresAt).toLocaleDateString()}
      </span>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
        Free tier — 1 agent, 1% fee
      </span>
      <button
        className="dash-btn dash-btn-primary"
        onClick={async () => {
          if (!confirm("Upgrade to Pro for 5 USDC/month?\n\nUnlimited agents, 0.25% fee.")) return;
          const res = await fetch("/api/wallet/subscribe", { method: "POST" });
          const data = await res.json();
          if (!res.ok) {
            alert(`Upgrade failed: ${data.error}`);
            return;
          }
          window.location.reload();
        }}
      >
        Upgrade to Pro — $5/mo
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Add balances card with inline swap to Dashboard JSX**

This replaces the old header-only balance display with a proper Balances card. Each token row shows symbol + amount + a swap icon. Tapping swap opens an inline swap panel pre-filled with that token as "from".

Add state at the top of the `Dashboard` function body:

```ts
const [swapFrom, setSwapFrom] = useState<string | null>(null);
const [swapTo, setSwapTo] = useState("");
const [swapAmt, setSwapAmt] = useState("");
const [swapQuote, setSwapQuote] = useState<string | null>(null);
const [swapQuoteSymbol, setSwapQuoteSymbol] = useState("");
const [swapping, setSwapping] = useState(false);

const swappableTokens = balances.filter((b) =>
  ["pathUSD", "USDC.e", "USDT0"].includes(b.symbol),
);
```

Add styles to the `<style>` block:

```css
.dash-balance-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.dash-balance-row:last-child { border-bottom: none; }
.dash-balance-symbol {
  font-family: var(--font-mono);
  font-size: 14px;
  flex: 1;
}
.dash-balance-amount {
  font-family: var(--font-mono);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}
.dash-swap-icon {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--color-border-subtle);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-tertiary);
  transition: background 0.15s;
}
.dash-swap-icon:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}
.dash-swap-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 0 4px;
  border-top: 1px solid var(--color-border-subtle);
  margin-top: 4px;
}
.dash-select {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-subtle);
  font-size: 14px;
  font-family: var(--font-mono);
  outline: none;
  color: var(--color-text-primary);
}
.dash-swap-input {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-subtle);
  font-size: 14px;
  font-family: var(--font-mono);
  outline: none;
}
```

Add the Balances + Swap card JSX (place after the Plan card):

```tsx
{/* Balances */}
<div className="dash-card">
  <div className="dash-card-head">
    <h2 className="dash-card-h2">Balances</h2>
  </div>
  {balances.map((b) => (
    <div key={b.symbol}>
      <div className="dash-balance-row">
        <span className="dash-balance-symbol">{b.symbol}</span>
        <span className="dash-balance-amount">${b.display}</span>
        {swappableTokens.length >= 2 && swappableTokens.some((t) => t.symbol === b.symbol) && (
          <button
            className="dash-swap-icon"
            title={`Swap ${b.symbol}`}
            onClick={() => {
              if (swapFrom === b.symbol) {
                setSwapFrom(null);
                return;
              }
              setSwapFrom(b.symbol);
              const defaultTo = swappableTokens.find((t) => t.symbol !== b.symbol);
              setSwapTo(defaultTo?.symbol ?? "");
              setSwapAmt("");
              setSwapQuote(null);
            }}
          >
            ↔
          </button>
        )}
      </div>
      {swapFrom === b.symbol && (
        <div className="dash-swap-panel">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="dash-mono" style={{ fontSize: 13, color: "var(--color-text-tertiary)", minWidth: 32 }}>To</span>
            <select
              className="dash-select"
              value={swapTo}
              onChange={(e) => { setSwapTo(e.target.value); setSwapQuote(null); }}
              style={{ flex: 1 }}
            >
              {swappableTokens.filter((t) => t.symbol !== b.symbol).map((t) => (
                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
          <input
            className="dash-swap-input"
            type="text"
            inputMode="decimal"
            placeholder={`Amount in ${b.symbol}`}
            value={swapAmt}
            onChange={(e) => { setSwapAmt(e.target.value); setSwapQuote(null); }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="dash-btn"
              disabled={!swapAmt}
              onClick={async () => {
                const tokenIn = swappableTokens.find((t) => t.symbol === b.symbol);
                const tokenOut = swappableTokens.find((t) => t.symbol === swapTo);
                if (!tokenIn || !tokenOut) return;
                const res = await fetch("/api/wallet/swap", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token_in: tokenIn.address, token_out: tokenOut.address, amount: swapAmt, quote_only: true }),
                });
                const data = await res.json();
                if (data.ok) { setSwapQuote(data.amount_out); setSwapQuoteSymbol(swapTo); }
                else alert(data.error);
              }}
            >
              Quote
            </button>
            <button
              className="dash-btn dash-btn-primary"
              disabled={!swapQuote || swapping}
              onClick={async () => {
                const tokenIn = swappableTokens.find((t) => t.symbol === b.symbol);
                const tokenOut = swappableTokens.find((t) => t.symbol === swapTo);
                if (!tokenIn || !tokenOut) return;
                setSwapping(true);
                try {
                  const res = await fetch("/api/wallet/swap", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token_in: tokenIn.address, token_out: tokenOut.address, amount: swapAmt }),
                  });
                  const data = await res.json();
                  if (!res.ok) { alert(`Swap failed: ${data.error}`); return; }
                  setSwapFrom(null);
                  setSwapAmt("");
                  setSwapQuote(null);
                  window.location.reload();
                } finally {
                  setSwapping(false);
                }
              }}
            >
              {swapping ? "Swapping…" : "Swap"}
            </button>
          </div>
          {swapQuote && (
            <span className="dash-mono" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              ≈ {swapQuote} {swapQuoteSymbol}
            </span>
          )}
        </div>
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 6: Start dev server and verify cards render**

Run: `npm run dev`
Navigate to `http://localhost:3000/oli/wallet/dashboard` (or `/wallet/dashboard`).
Expected: Plan card shows "FREE" with upgrade button. Balances card lists each token with amount and ↔ swap icon. Tapping ↔ expands an inline swap panel below that row with To dropdown, amount input, Quote/Swap buttons.

- [ ] **Step 7: Commit**

```bash
git add app/wallet/dashboard/page.tsx app/wallet/dashboard/Dashboard.tsx
git commit -m "feat: dashboard plan card + balances card with inline swap"
```

---

## Task 10: OLI dashboard mirror

The OLI shell mirrors the wallet dashboard at `/oli/wallet/dashboard`. It uses the same `renderDashboard` function. Verify the subscription data flows through.

**Files:**
- Check: `app/oli/wallet/dashboard/page.tsx` or equivalent

- [ ] **Step 1: Check OLI dashboard uses renderDashboard**

If the OLI dashboard page calls `renderDashboard("/oli/wallet")`, it already picks up the subscription prop from Task 8. Verify by reading the file — no changes should be needed.

- [ ] **Step 2: Verify OLI route renders**

Navigate to `http://localhost:3000/oli/wallet/dashboard`.
Expected: same Plan and Swap cards appear.

---

## Task 11: Verify end-to-end on dev

- [ ] **Step 1: Run migration against local DB**

```bash
psql $DATABASE_URL -f drizzle/0015_subscriptions.sql
```

- [ ] **Step 2: Test swap quote**

```bash
curl -X POST http://localhost:3000/api/wallet/swap \
  -H "Authorization: Bearer <test-token>" \
  -H "Content-Type: application/json" \
  -d '{"token_in":"0x20c0000000000000000000004f3edf3b8cb0001a","token_out":"0x20c0000000000000000000009e8d7eb59b783726","amount":"1.0","quote_only":true}'
```

Expected: `{ ok: true, quote_only: true, amount_out: "..." }`

- [ ] **Step 3: Test subscribe**

```bash
curl -X POST http://localhost:3000/api/wallet/subscribe \
  -H "Authorization: Bearer <test-token>"
```

Expected: `{ ok: true, subscription: { plan: "pro", ... } }`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: pro subscriptions + token swap — complete"
```
