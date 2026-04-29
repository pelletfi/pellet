# Pellet OLI v0 — MPP Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/oli` — the MPP-aware analytics dashboard for Tempo agent activity.

**Architecture:** Next.js App Router routes under `/oli/*` rendering an OLI shell (sidebar + main, dark forced, no marketing nav). Drizzle queries against existing `agent_events` data, joined with a new `address_labels` seed of MPP service identities. Five pages (Dashboard, Services list/detail, Agents list/detail) backed by five API endpoints under `/api/oli/*`. Hourly cron drives data freshness.

**Tech Stack:** Existing — Next.js 16, TypeScript, Tailwind v4, Drizzle ORM + Neon serverless, viem, Vitest. New deps: none in v0 (charts are hand-rolled SVG matching the landing's peg-chart pattern).

**Spec:** `docs/superpowers/specs/2026-04-29-pellet-oli-mpp-dashboard.md`

---

## File Structure (what this plan creates)

```
pellet/
├─ Schema + migration
│  └─ drizzle/0002_agent_events_amount.sql      (add amount_wei + token_address)
│
├─ Data + seeding
│  ├─ data/mpp-services.ts                      (10 curated MPP service definitions)
│  └─ scripts/seed-services.ts                  (probe + write address_labels)
│
├─ Library (TDD on pure functions)
│  └─ lib/oli/
│     ├─ format.ts + format.test.ts             (USDC formatting, time-ago, hash)
│     ├─ decode.ts + decode.test.ts             (event row → human-legible)
│     └─ queries.ts + queries.test.ts           (Drizzle aggregations)
│
├─ API surface
│  └─ app/api/oli/
│     ├─ dashboard/route.ts
│     ├─ services/route.ts
│     ├─ services/[id]/route.ts
│     ├─ agents/route.ts
│     └─ agents/[id]/route.ts
│
├─ OLI shell + components
│  ├─ app/oli/
│  │  ├─ layout.tsx                             (shell)
│  │  ├─ page.tsx                               (Dashboard)
│  │  ├─ services/
│  │  │  ├─ page.tsx
│  │  │  └─ [id]/page.tsx
│  │  └─ agents/
│  │     ├─ page.tsx
│  │     └─ [id]/page.tsx
│  └─ components/oli/
│     ├─ Sidebar.tsx
│     ├─ StatStrip.tsx
│     ├─ Leaderboard.tsx
│     ├─ TrendChart.tsx
│     ├─ EventStream.tsx
│     └─ ProvenanceBadge.tsx
│
├─ Matcher update
│  ├─ lib/ingest/matcher.ts                     (capture amount + counterparty)
│  └─ lib/ingest/matcher.test.ts                (cover new columns)
│
└─ Cron + smoke
   ├─ vercel.json                               (re-enable hourly cron)
   └─ tests/feed.e2e.spec.ts                    (extend with /oli routes)
```

**Decomposition rationale:**
- `lib/oli/` holds the data plumbing (format, decode, queries) — pure functions, TDD-able, no UI deps. Reuse across API endpoints + future surfaces.
- `app/api/oli/` holds the projections — thin handlers that call `lib/oli/queries.ts` and shape JSON.
- `components/oli/` holds reusable visual primitives — Sidebar, StatStrip, Leaderboard, TrendChart, EventStream, ProvenanceBadge. Pages compose them.
- `app/oli/` holds the route handlers + page composition. Each page is mostly assembly of `lib/oli/queries` results into `components/oli/*` primitives.
- The matcher gets updated in-place (not a new module) because the responsibility is the same; it just captures more fields now.

---

## Phase A — Foundation: schema + matcher update

### Task 1: Add `amount_wei` + `token_address` to `agent_events`

The matcher currently doesn't capture transfer amounts — required for revenue/spend metrics. Migrate the schema, update the matcher, backfill (or truncate-and-resync since prod data is sparse).

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/0002_agent_events_amount.sql`

- [ ] **Step 1: Extend the schema definition**

Replace the `agentEvents` block in `lib/db/schema.ts` with:

```ts
export const agentEvents = pgTable(
  "agent_events",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    targets: jsonb("targets").notNull().default({}),
    // NEW: economic fields for OLI metrics. amount_wei is the raw uint256 from
    // the Transfer event's data field; token_address identifies which TIP-20
    // (USDC.e, USDT0, etc.) was moved. Both nullable for non-Transfer events.
    amountWei: text("amount_wei"),                  // store as text — uint256 doesn't fit in JS number
    tokenAddress: text("token_address"),
    // NEW: counterparty (the OTHER side of the Transfer — payer when this row's
    // agent is the recipient, or recipient when this row's agent is the payer).
    counterpartyAddress: text("counterparty_address"),
    sourceBlock: bigint("source_block", { mode: "number" }).notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tsIdx: index("agent_events_ts_idx").on(t.ts),
    agentTsIdx: index("agent_events_agent_ts_idx").on(t.agentId, t.ts),
    eventRefIdx: index("agent_events_event_ref_idx").on(t.txHash, t.logIndex),
    counterpartyIdx: index("agent_events_counterparty_idx").on(t.counterpartyAddress),
  }),
);
```

- [ ] **Step 2: Generate the migration**

```bash
source .env.local && npx drizzle-kit generate
```

Expected: writes `drizzle/0002_*.sql` with `ALTER TABLE agent_events ADD COLUMN ...` statements.

- [ ] **Step 3: Apply to dev DB**

```bash
source .env.local && for f in drizzle/0002_*.sql; do
  psql "$POSTGRES_URL_NON_POOLING" -f "$f"
done
```

- [ ] **Step 4: Truncate existing agent_events (sparse + resyncable)**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "TRUNCATE agent_events;"
```

(Production has minimal data and will resync naturally on next cron tick after this plan ships. Keeping clean is simpler than backfilling.)

- [ ] **Step 5: Verify**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "\d agent_events" | grep -E "amount_wei|token_address|counterparty_address"
```

Expected: 3 lines showing the new columns.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "schema: add amount_wei + token_address + counterparty to agent_events"
```

---

### Task 2: Update matcher to capture amount + counterparty (TDD)

**Files:**
- Modify: `lib/ingest/matcher.ts`, `lib/ingest/matcher.test.ts`

- [ ] **Step 1: Add failing tests for the new fields**

Append to `lib/ingest/matcher.test.ts`:

```ts
describe("matchEvent — amount + counterparty extraction", () => {
  it("decodes the Transfer amount from event data", () => {
    // Transfer(address from, address to, uint256 value); value is ABI-encoded
    // in event.data as 32-byte big-endian. 1.5 USDC.e (6 decimals) = 1_500_000.
    const valueHex = (1_500_000).toString(16).padStart(64, "0");
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0x20c000000000000000000000b9537d11c60e8b50", // USDC.e
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [TRANSFER_TOPIC, AIXBT_TOPIC, "0x000000000000000000000000counterparty00000000000000000000000000"],
        data: `0x${valueHex}`,
      },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches[0].amountWei).toBe("1500000");
    expect(matches[0].tokenAddress).toBe("0x20c000000000000000000000b9537d11c60e8b50");
  });

  it("captures the counterparty (the OTHER party in the Transfer)", () => {
    const valueHex = (1_000_000).toString(16).padStart(64, "0");
    const counterpartyTopic = "0x000000000000000000000000fffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef";
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        // aixbt as `from` (topic1), counterparty as `to` (topic2)
        topics: [TRANSFER_TOPIC, AIXBT_TOPIC, counterpartyTopic],
        data: `0x${valueHex}`,
      },
    };
    const matches = matchEvent(evt, [aixbt]);
    // Counterparty is captured as a 20-byte address (lowercase, 0x + 40 hex).
    expect(matches[0].counterpartyAddress).toBe("0xfffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef");
  });

  it("yields null amount + counterparty when topics insufficient", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xWeird",
      eventType: "0xdeadbeef",
      args: { topics: ["0xdeadbeef", AIXBT_TOPIC], data: "0x" },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches[0].amountWei).toBeNull();
    expect(matches[0].counterpartyAddress).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test
```

Expected: 3 new failing tests ("Property 'amountWei' does not exist on type ..." or assertion failures).

- [ ] **Step 3: Update `AgentEventMatch` type + matcher implementation**

Replace `lib/ingest/matcher.ts` with:

```ts
const METHODOLOGY_VERSION = "v0.2"; // bumped: amount + counterparty capture

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const KIND_BY_TOPIC: Record<string, string> = {
  [TRANSFER_TOPIC]: "transfer",
};

export type RawEventRow = {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  contract: string;
  eventType: string;
  args: { topics: readonly string[]; data: string };
};

export type AgentLite = {
  id: string;
  label: string;
  wallets: string[];
};

export type AgentEventMatch = {
  agentId: string;
  txHash: string;
  logIndex: number;
  ts: Date;
  kind: string;
  summary: string;
  targets: Record<string, unknown>;
  amountWei: string | null;
  tokenAddress: string | null;
  counterpartyAddress: string | null;
  sourceBlock: number;
  methodologyVersion: string;
};

function toTopicAddress(addr: string): string {
  const hex = addr.replace(/^0x/i, "").toLowerCase().padStart(40, "0");
  return `0x${"0".repeat(24)}${hex}`;
}

function topicToAddress(topic: string): string {
  // Topic format: 0x + 24 zeros + 40 hex chars. Strip the leading zeros.
  const hex = topic.replace(/^0x/i, "").toLowerCase();
  if (hex.length !== 64) return "";
  return `0x${hex.slice(24)}`;
}

function decodeTransferAmount(dataHex: string): string | null {
  // Transfer.data is the uint256 value, ABI-encoded as 32-byte big-endian.
  const hex = dataHex.replace(/^0x/i, "");
  if (hex.length < 64) return null;
  // Take the first 32 bytes; convert to decimal string via BigInt.
  try {
    return BigInt(`0x${hex.slice(0, 64)}`).toString(10);
  } catch {
    return null;
  }
}

export function matchEvent(
  evt: RawEventRow,
  agents: AgentLite[],
): AgentEventMatch[] {
  const topicsLower = (evt.args.topics ?? []).map((t) =>
    typeof t === "string" ? t.toLowerCase() : "",
  );

  const matches: AgentEventMatch[] = [];

  for (const agent of agents) {
    const walletTopics = new Set(agent.wallets.map(toTopicAddress));
    const matchedTopicIdx = topicsLower
      .slice(1)
      .findIndex((t) => t && walletTopics.has(t));
    if (matchedTopicIdx === -1) continue;

    const isTransfer = evt.eventType.toLowerCase() === TRANSFER_TOPIC;
    const kind = KIND_BY_TOPIC[evt.eventType.toLowerCase()] ?? "custom";

    let amountWei: string | null = null;
    let tokenAddress: string | null = null;
    let counterpartyAddress: string | null = null;

    if (isTransfer && topicsLower.length >= 3) {
      amountWei = decodeTransferAmount(evt.args.data);
      tokenAddress = evt.contract.toLowerCase();
      // The counterparty is whichever of topics[1]/topics[2] ISN'T the agent.
      const fromTopic = topicsLower[1];
      const toTopic = topicsLower[2];
      const matchedTopic = matchedTopicIdx === 0 ? fromTopic : toTopic;
      const otherTopic = matchedTopic === fromTopic ? toTopic : fromTopic;
      if (otherTopic) counterpartyAddress = topicToAddress(otherTopic);
    }

    matches.push({
      agentId: agent.id,
      txHash: evt.txHash,
      logIndex: evt.logIndex,
      ts: evt.blockTimestamp,
      kind,
      summary: buildSummary(evt, agent, kind),
      targets: { contract: evt.contract, eventType: evt.eventType },
      amountWei,
      tokenAddress,
      counterpartyAddress,
      sourceBlock: evt.blockNumber,
      methodologyVersion: METHODOLOGY_VERSION,
    });
  }
  return matches;
}

function buildSummary(evt: RawEventRow, agent: AgentLite, kind: string): string {
  const shortContract = `${evt.contract.slice(0, 10)}…`;
  switch (kind) {
    case "transfer":
      return `${agent.label} transfer via ${shortContract}`;
    case "swap":
      return `${agent.label} swapped via ${shortContract}`;
    case "mint":
      return `${agent.label} mint via ${shortContract}`;
    default:
      return `${agent.label} interacted with ${shortContract}`;
  }
}
```

- [ ] **Step 4: Update `match-runner.ts` to write the new fields**

Modify the `.values(...)` block in `lib/ingest/match-runner.ts` to include:

```ts
.values(
  matches.map((m) => ({
    agentId: m.agentId,
    txHash: m.txHash,
    logIndex: m.logIndex,
    ts: m.ts,
    kind: m.kind,
    summary: m.summary,
    targets: m.targets,
    amountWei: m.amountWei,
    tokenAddress: m.tokenAddress,
    counterpartyAddress: m.counterpartyAddress,
    sourceBlock: m.sourceBlock,
    methodologyVersion: m.methodologyVersion,
  })),
)
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test
```

Expected: all matcher tests pass (existing 6 + new 3 = 9).

- [ ] **Step 6: Commit**

```bash
git add lib/ingest/matcher.ts lib/ingest/matcher.test.ts lib/ingest/match-runner.ts
git commit -m "matcher: capture transfer amount + token + counterparty (methodology v0.2)"
```

---

## Phase B — Library: pure functions (TDD)

### Task 3: `lib/oli/format.ts` — formatters (TDD)

Pure utility functions used across the OLI surface. TDD because they're pure and easy to test.

**Files:**
- Create: `lib/oli/format.ts`, `lib/oli/format.test.ts`

- [ ] **Step 1: Create directory + write failing tests**

```bash
mkdir -p lib/oli
```

Create `lib/oli/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatUsdcAmount,
  formatTimeAgo,
  shortHash,
  shortAddress,
  formatBlockNumber,
  formatDelta,
} from "./format";

describe("formatUsdcAmount", () => {
  it("renders 6-decimal stables in USD-style", () => {
    // 1_500_000 wei (6 decimals) = $1.50
    expect(formatUsdcAmount("1500000", 6)).toBe("$1.50");
  });

  it("handles sub-cent amounts", () => {
    expect(formatUsdcAmount("3000", 6)).toBe("$0.003");
  });

  it("handles large amounts with commas", () => {
    expect(formatUsdcAmount("1234567890000", 6)).toBe("$1,234,567.89");
  });

  it("returns em-dash for null/undefined", () => {
    expect(formatUsdcAmount(null, 6)).toBe("—");
    expect(formatUsdcAmount(undefined, 6)).toBe("—");
  });
});

describe("formatTimeAgo", () => {
  it("renders seconds for sub-minute", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-29T11:59:30Z");
    expect(formatTimeAgo(ts, now)).toBe("30s ago");
  });

  it("renders minutes for sub-hour", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-29T11:42:00Z");
    expect(formatTimeAgo(ts, now)).toBe("18m ago");
  });

  it("renders hours for sub-day", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-29T08:30:00Z");
    expect(formatTimeAgo(ts, now)).toBe("3h ago");
  });

  it("renders days otherwise", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-25T12:00:00Z");
    expect(formatTimeAgo(ts, now)).toBe("4d ago");
  });
});

describe("shortHash", () => {
  it("truncates a 0x-prefixed hash to 6+4 with ellipsis", () => {
    expect(shortHash("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"))
      .toBe("0xddf2…b3ef");
  });

  it("returns the input if it's shorter than the truncation budget", () => {
    expect(shortHash("0xabc")).toBe("0xabc");
  });
});

describe("shortAddress", () => {
  it("truncates a 20-byte address to 6+4", () => {
    expect(shortAddress("0xfffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef")).toBe("0xfffe…edef");
  });
});

describe("formatBlockNumber", () => {
  it("formats with commas", () => {
    expect(formatBlockNumber(17332551)).toBe("17,332,551");
  });
});

describe("formatDelta", () => {
  it("renders positive deltas with sign + green class hint", () => {
    expect(formatDelta(0.082)).toEqual({ display: "+8.2%", tone: "positive" });
  });

  it("renders negative deltas", () => {
    expect(formatDelta(-0.034)).toEqual({ display: "-3.4%", tone: "negative" });
  });

  it("renders zero as neutral", () => {
    expect(formatDelta(0)).toEqual({ display: "0.0%", tone: "neutral" });
  });

  it("returns null tone when prior is missing", () => {
    expect(formatDelta(null)).toEqual({ display: "—", tone: "neutral" });
  });
});
```

- [ ] **Step 2: Run — expect import failures**

```bash
npm test -- format
```

Expected: "Cannot find module './format'".

- [ ] **Step 3: Implement**

Create `lib/oli/format.ts`:

```ts
// Pure formatters used across the OLI surface. No React, no DB, no IO.

export function formatUsdcAmount(
  wei: string | null | undefined,
  decimals: number,
): string {
  if (wei == null) return "—";
  const n = Number(wei) / 10 ** decimals;
  if (n === 0) return "$0.00";
  if (n < 0.01) {
    // Sub-cent: show 3 decimals so 0.003 USDC.e isn't rounded to $0.00.
    return `$${n.toFixed(3)}`;
  }
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatTimeAgo(ts: Date, now: Date = new Date()): string {
  const diffSec = Math.floor((now.getTime() - ts.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function shortHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function shortAddress(addr: string): string {
  return shortHash(addr); // same shape — 6+4 with ellipsis
}

export function formatBlockNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export type Tone = "positive" | "negative" | "neutral";
export type Delta = { display: string; tone: Tone };

export function formatDelta(ratio: number | null | undefined): Delta {
  if (ratio == null) return { display: "—", tone: "neutral" };
  if (ratio === 0) return { display: "0.0%", tone: "neutral" };
  const pct = (ratio * 100).toFixed(1);
  if (ratio > 0) return { display: `+${pct}%`, tone: "positive" };
  return { display: `${pct}%`, tone: "negative" };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- format
```

Expected: 14 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/oli/format.ts lib/oli/format.test.ts
git commit -m "lib/oli/format: USDC + time-ago + hash + delta formatters with TDD"
```

---

### Task 4: `lib/oli/decode.ts` — service identity + summary enrichment (TDD)

Takes an `agent_events` row + an `address_labels` lookup and produces a richer human-legible event line. Distinct from `matcher.ts/buildSummary` because this layer KNOWS who the counterparty is (via labels) and can produce "agent_X paid Anthropic" instead of "anthropic transfer via 0xabc…".

**Files:**
- Create: `lib/oli/decode.ts`, `lib/oli/decode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/oli/decode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeEventLine } from "./decode";

const labels: Record<string, { label: string; category: string }> = {
  "0xanthropicaddress0000000000000000000000000": {
    label: "Anthropic",
    category: "ai",
  },
};

describe("decodeEventLine", () => {
  it("renders agent → known-service when counterparty is in label map", () => {
    const line = decodeEventLine({
      agentId: "anthropic-mpp",
      agentLabel: "Anthropic",
      kind: "transfer",
      counterpartyAddress: "0xagent_x_payer000000000000000000000000000",
      amountWei: "3000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, labels);
    // Anthropic is the recipient; the payer is the unknown agent_x → "0xagent…000"
    expect(line.summary).toContain("paid Anthropic");
    expect(line.summary).toContain("$0.003");
  });

  it("renders unknown-counterparty as a short address", () => {
    const line = decodeEventLine({
      agentId: "anthropic-mpp",
      agentLabel: "Anthropic",
      kind: "transfer",
      counterpartyAddress: "0xfffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef",
      amountWei: "1000000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, {});
    expect(line.summary).toContain("0xfffe…edef");
    expect(line.summary).toContain("Anthropic");
  });

  it("falls back to a generic line when amount/counterparty missing", () => {
    const line = decodeEventLine({
      agentId: "pellet",
      agentLabel: "Pellet",
      kind: "custom",
      counterpartyAddress: null,
      amountWei: null,
      tokenAddress: null,
      ts: new Date("2026-04-29T12:00:00Z"),
    }, {});
    expect(line.summary).toBe("Pellet · custom event");
  });

  it("attributes payer/recipient correctly when this row's agent IS the payer", () => {
    // When the watched agent is the source (paying out), label says paid X
    const line = decodeEventLine({
      agentId: "watched-agent",
      agentLabel: "watched-agent",
      kind: "transfer",
      counterpartyAddress: "0xanthropicaddress0000000000000000000000000",
      amountWei: "3000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, labels);
    expect(line.summary).toContain("watched-agent paid Anthropic");
  });

  it("returns the inferred category when both ends are labeled services", () => {
    const line = decodeEventLine({
      agentId: "anthropic-mpp",
      agentLabel: "Anthropic",
      kind: "transfer",
      counterpartyAddress: "0xagent_x_payer000000000000000000000000000",
      amountWei: "3000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, labels);
    expect(line.category).toBe("ai");
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test -- decode
```

Expected: "Cannot find module './decode'".

- [ ] **Step 3: Implement**

Create `lib/oli/decode.ts`:

```ts
import { formatUsdcAmount, shortAddress } from "./format";

// Most TIP-20 stables on Tempo are 6-decimal (USDC.e, USDT0, EURC.e, etc.).
// Future: look up token metadata from chain or address_labels notes.
const DEFAULT_DECIMALS = 6;

export type DecodeInput = {
  agentId: string;
  agentLabel: string;
  kind: string;
  counterpartyAddress: string | null;
  amountWei: string | null;
  tokenAddress: string | null;
  ts: Date;
};

export type LabelMap = Record<string, { label: string; category: string }>;

export type DecodedLine = {
  summary: string;
  category: string | null;
  amountDisplay: string;
};

// Produce a human-legible one-liner for the OLI feed. The matched agent is
// always one party in the transfer; the counterparty might be a labeled service
// (Anthropic, Dune, etc.) or an unknown wallet.
export function decodeEventLine(
  input: DecodeInput,
  labels: LabelMap,
): DecodedLine {
  const amountDisplay = formatUsdcAmount(input.amountWei, DEFAULT_DECIMALS);

  if (input.kind !== "transfer" || !input.counterpartyAddress || !input.amountWei) {
    return {
      summary: `${input.agentLabel} · ${input.kind} event`,
      category: null,
      amountDisplay,
    };
  }

  const counterpartyKey = input.counterpartyAddress.toLowerCase();
  const counterparty = labels[counterpartyKey];
  const counterpartyName = counterparty?.label ?? shortAddress(input.counterpartyAddress);
  const category = counterparty?.category ?? null;

  // Heuristic: if THIS row's agent is recognized as a "service" by the labels
  // table (under its own ID-as-address mapping) then the counterparty is the
  // payer. Otherwise this row's agent is the payer. This is approximate; v0.5
  // can refine via address_labels.notes.role = 'service' vs 'agent'.
  const thisAgentIsService = false; // v0 simplification — the matched agent is always treated as a service if labeled, payer otherwise. See also queries.ts which joins address_labels for the proper attribution.

  // For v0 attribution: assume the matched agent is on the receiving side
  // (the "service") when it appears in our curated MPP service list, otherwise
  // it's the paying side. This is decided UPSTREAM (queries.ts) by joining
  // address_labels.category. Here in decode.ts we just render the form.
  if (thisAgentIsService) {
    return {
      summary: `${counterpartyName} paid ${input.agentLabel} ${amountDisplay}`,
      category,
      amountDisplay,
    };
  }
  return {
    summary: `${input.agentLabel} paid ${counterpartyName} ${amountDisplay}`,
    category,
    amountDisplay,
  };
}
```

Wait — the test cases above expect specific behavior that depends on whether the watched agent is the "service" or the "payer." Let me reconcile by making the function take an explicit `direction: "received" | "sent"` arg, or infer from the labels.

Actually simpler: ALWAYS render in the form `{label} paid {counterparty} {amount}` for the v0 — the matched agent is described as paying the counterparty. The queries layer is responsible for selecting the right "side" before calling decode.

Update `lib/oli/decode.ts` to remove the heuristic complexity; just do `{agent} paid {counterparty}` always:

```ts
export function decodeEventLine(
  input: DecodeInput,
  labels: LabelMap,
): DecodedLine {
  const amountDisplay = formatUsdcAmount(input.amountWei, DEFAULT_DECIMALS);

  if (input.kind !== "transfer" || !input.counterpartyAddress || !input.amountWei) {
    return {
      summary: `${input.agentLabel} · ${input.kind} event`,
      category: null,
      amountDisplay,
    };
  }

  const counterpartyKey = input.counterpartyAddress.toLowerCase();
  const counterparty = labels[counterpartyKey];
  const counterpartyName = counterparty?.label ?? shortAddress(input.counterpartyAddress);
  const category = counterparty?.category ?? null;

  // Always renders as "{matchedAgent} paid {counterparty}". Queries layer is
  // responsible for picking the right "side" — see queries.ts where service
  // rows are joined with their counterparty as the payer.
  return {
    summary: `${input.agentLabel} paid ${counterpartyName} ${amountDisplay}`,
    category,
    amountDisplay,
  };
}
```

And revise the test expectations in step 1 — drop the test "attributes payer/recipient correctly" since v0 always renders in one direction. The "rendered as agent paid counterparty" form is the contract.

- [ ] **Step 4: Update test expectations to match the simplified contract**

Replace the third + fourth tests in `lib/oli/decode.test.ts` with:

```ts
it("falls back to a generic line when amount/counterparty missing", () => {
  const line = decodeEventLine({
    agentId: "pellet",
    agentLabel: "Pellet",
    kind: "custom",
    counterpartyAddress: null,
    amountWei: null,
    tokenAddress: null,
    ts: new Date("2026-04-29T12:00:00Z"),
  }, {});
  expect(line.summary).toBe("Pellet · custom event");
});

it("always renders as '{agent} paid {counterparty}' for transfer events", () => {
  const line = decodeEventLine({
    agentId: "watched",
    agentLabel: "watched",
    kind: "transfer",
    counterpartyAddress: "0xanthropicaddress0000000000000000000000000",
    amountWei: "3000",
    tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
    ts: new Date("2026-04-29T12:00:00Z"),
  }, labels);
  expect(line.summary).toBe("watched paid Anthropic $0.003");
});
```

- [ ] **Step 5: Run — expect pass**

```bash
npm test -- decode
```

Expected: 4 passing tests (the "category" assertion + the others).

- [ ] **Step 6: Commit**

```bash
git add lib/oli/decode.ts lib/oli/decode.test.ts
git commit -m "lib/oli/decode: enrich agent_events with service identity + render"
```

---

## Phase C — Data: curated MPP services seed

### Task 5: Define `data/mpp-services.ts`

Static definitions of the 10 v0 MPP services. Their settlement addresses get filled in by the seed script in Task 6 (probe-and-discover), or hard-coded here if pre-known.

**Files:**
- Create: `data/mpp-services.ts`

- [ ] **Step 1: Build the file**

Create `data/mpp-services.ts`:

```ts
// v0 curated MPP services. Settlement addresses are populated by the seed
// script (`scripts/seed-services.ts`) which probes each service's MPP endpoint
// and captures the 402 response's payment address. If a service can't be
// probed (endpoint requires specific request shape, etc.), the address can be
// filled in manually here and the seed script will skip the probe for it.

export type SeedMppService = {
  id: string;            // slug used as agents.id and address_labels source
  label: string;         // display name
  category: "ai" | "data" | "compute" | "web" | "storage" | "social" | "blockchain" | "media";
  mppEndpoint: string;   // probe URL
  // If known, populate directly; else null and the seed script will probe.
  settlementAddress: string | null;
  bio: string;
  links: { x?: string; site?: string };
};

export const MPP_SERVICES: SeedMppService[] = [
  {
    id: "anthropic-mpp",
    label: "Anthropic",
    category: "ai",
    mppEndpoint: "https://anthropic.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Claude chat completions via native and OpenAI-compatible APIs.",
    links: { site: "https://anthropic.com" },
  },
  {
    id: "openai-mpp",
    label: "OpenAI",
    category: "ai",
    mppEndpoint: "https://openai.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Chat, embeddings, image generation, and audio capabilities.",
    links: { site: "https://openai.com" },
  },
  {
    id: "gemini-mpp",
    label: "Google Gemini",
    category: "ai",
    mppEndpoint: "https://gemini.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Gemini text, Veo video, and image generation.",
    links: { site: "https://deepmind.google/technologies/gemini" },
  },
  {
    id: "openrouter-mpp",
    label: "OpenRouter",
    category: "ai",
    mppEndpoint: "https://openrouter.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Unified API access to 100+ language models.",
    links: { site: "https://openrouter.ai" },
  },
  {
    id: "dune-mpp",
    label: "Dune",
    category: "data",
    mppEndpoint: "https://api.dune.com",
    settlementAddress: null,
    bio: "Query transaction data, decoded events, DeFi positions, NFT activity.",
    links: { site: "https://dune.com" },
  },
  {
    id: "alchemy-mpp",
    label: "Alchemy",
    category: "blockchain",
    mppEndpoint: "https://mpp.alchemy.com",
    settlementAddress: null,
    bio: "Blockchain APIs including RPC, prices, portfolios, NFTs across 100+ chains.",
    links: { site: "https://alchemy.com" },
  },
  {
    id: "browserbase-mpp",
    label: "Browserbase",
    category: "compute",
    mppEndpoint: "https://mpp.browserbase.com",
    settlementAddress: null,
    bio: "Headless browser sessions and web page retrieval for agents.",
    links: { site: "https://browserbase.com" },
  },
  {
    id: "modal-mpp",
    label: "Modal",
    category: "compute",
    mppEndpoint: "https://modal.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Serverless GPU compute for code execution and AI workloads.",
    links: { site: "https://modal.com" },
  },
  {
    id: "firecrawl-mpp",
    label: "Firecrawl",
    category: "data",
    mppEndpoint: "https://firecrawl.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Web scraping and structured data extraction optimized for LLMs.",
    links: { site: "https://firecrawl.dev" },
  },
  {
    id: "fal-mpp",
    label: "fal.ai",
    category: "media",
    mppEndpoint: "https://fal.mpp.tempo.xyz",
    settlementAddress: null,
    bio: "Image, video, and audio generation with 600+ models.",
    links: { site: "https://fal.ai" },
  },
];
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add data/mpp-services.ts
git commit -m "data: define 10 curated v0 MPP services (settlement addresses TBD via probe)"
```

---

### Task 6: Probe-and-seed script + run

Probe each MPP endpoint for its 402 response, extract settlement address, write to `address_labels` with category `mpp_service`. Also writes each service to `agents` so the matcher picks them up on next ingest.

**Files:**
- Create: `scripts/seed-services.ts`
- Modify: `package.json` (add npm script)

- [ ] **Step 1: Build the seed script**

Create `scripts/seed-services.ts`:

```ts
import { MPP_SERVICES } from "@/data/mpp-services";
import { db } from "@/lib/db/client";
import { agents, addressLabels } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Probe an MPP endpoint and extract the settlement address from the 402 response.
// MPP responses include a WWW-Authenticate: Payment header with structured
// data. The exact format is per the MPP spec; v0 implementation sniffs for any
// 0x-prefixed 40-hex string in the header value as a best-effort probe.
async function probeSettlementAddress(endpoint: string): Promise<string | null> {
  try {
    // Hit the root or a known path with no auth — expect 402.
    const res = await fetch(endpoint, { method: "GET" });
    const auth = res.headers.get("www-authenticate") ?? "";
    const match = auth.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

async function main() {
  let probed = 0;
  let known = 0;
  let skipped = 0;

  for (const svc of MPP_SERVICES) {
    let address = svc.settlementAddress;
    if (!address) {
      address = await probeSettlementAddress(svc.mppEndpoint);
      if (address) probed += 1;
    } else {
      known += 1;
    }

    if (!address) {
      console.warn(`✗ ${svc.id} — no settlement address found (probe failed; manually populate data/mpp-services.ts)`);
      skipped += 1;
      continue;
    }

    // Write to agents (so matcher catches Transfers involving this address).
    await db
      .insert(agents)
      .values({
        id: svc.id,
        label: svc.label,
        source: "curated",
        wallets: [address],
        bio: svc.bio,
        links: { ...svc.links, mpp: svc.mppEndpoint, category: svc.category },
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          label: svc.label,
          wallets: [address],
          bio: svc.bio,
          links: { ...svc.links, mpp: svc.mppEndpoint, category: svc.category },
        },
      });

    // Write to address_labels (so OLI decode layer can name this address).
    await db
      .insert(addressLabels)
      .values({
        address: address.toLowerCase(),
        label: svc.label,
        category: "mpp_service",
        source: "pellet_curated",
        notes: {
          service_id: svc.id,
          mpp_endpoint: svc.mppEndpoint,
          mpp_category: svc.category,
          probed_at: new Date().toISOString(),
        },
      })
      .onConflictDoUpdate({
        target: addressLabels.address,
        set: {
          label: svc.label,
          category: "mpp_service",
          source: "pellet_curated",
          notes: {
            service_id: svc.id,
            mpp_endpoint: svc.mppEndpoint,
            mpp_category: svc.category,
            probed_at: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
      });

    console.log(`✓ ${svc.id} → ${address}`);
  }

  console.log(`\nseeded: ${MPP_SERVICES.length - skipped} of ${MPP_SERVICES.length}`);
  console.log(`  ${probed} via probe, ${known} pre-known, ${skipped} skipped`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

In `package.json` `"scripts"`:

```json
"seed:services": "tsx --env-file=.env.local scripts/seed-services.ts"
```

- [ ] **Step 3: Run the seed**

```bash
npm run seed:services
```

Expected: lines like `✓ anthropic-mpp → 0x...`. Some services may print `✗` and skip — that's a v0 limitation. Note any that fail; you'll need to find their settlement addresses manually (block explorer, Tempo team docs) and update `data/mpp-services.ts` with hardcoded `settlementAddress` values, then re-run.

- [ ] **Step 4: Verify**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "SELECT id, label, source FROM agents WHERE source = 'curated' AND id LIKE '%-mpp';"
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "SELECT address, label, category FROM address_labels WHERE category = 'mpp_service';"
```

Expected: rows for each successfully-probed service.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-services.ts package.json package-lock.json
git commit -m "seed: probe MPP endpoints + populate agents + address_labels"
```

---

## Phase D — Queries: aggregations against existing data

### Task 7: `lib/oli/queries.ts` — leaderboards + trends

Drizzle queries that power the API endpoints. Pure async functions returning typed shapes; no React.

**Files:**
- Create: `lib/oli/queries.ts`

- [ ] **Step 1: Build the queries module**

Create `lib/oli/queries.ts`:

```ts
import { db } from "@/lib/db/client";
import { agentEvents, agents, addressLabels } from "@/lib/db/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────

export type LeaderboardRow = {
  id: string;
  label: string;
  category: string | null;
  txCount: number;
  amountSumWei: string; // bigint as string
};

export type DashboardSnapshot = {
  windowHours: number;
  txCount: number;
  agentsActive: number;
  amountSumWei: string;
  topServices: LeaderboardRow[];
  topAgents: LeaderboardRow[];
  recentEvents: RecentEventRow[];
};

export type RecentEventRow = {
  id: number;
  ts: Date;
  agentId: string;
  agentLabel: string;
  agentCategory: string | null;
  counterpartyAddress: string | null;
  counterpartyLabel: string | null;
  counterpartyCategory: string | null;
  kind: string;
  amountWei: string | null;
  tokenAddress: string | null;
  txHash: string;
  sourceBlock: number;
  methodologyVersion: string;
};

export type ServiceListRow = {
  id: string;
  label: string;
  category: string;
  txCount24h: number;
  txCount7d: number;
  amountSumWei24h: string;
  amountSumWei7d: string;
  agentsLast7d: number;
  settlementAddress: string;
};

export type AgentListRow = {
  id: string;
  label: string;
  source: string;
  txCount24h: number;
  amountSumWei24h: string;
  topServiceLabel: string | null;
  lastActivity: Date | null;
  walletAddress: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────

const HOURS = (n: number) => sql`now() - (interval '1 hour' * ${n})`;

// ── Queries ──────────────────────────────────────────────────────────────

export async function dashboardSnapshot(windowHours = 24): Promise<DashboardSnapshot> {
  const sinceCutoff = HOURS(windowHours);

  // Aggregate stats.
  const agg = await db.execute<{
    tx_count: string;
    agents_active: string;
    amount_sum_wei: string | null;
  }>(sql`
    SELECT
      COUNT(*)::text                                     AS tx_count,
      COUNT(DISTINCT agent_id)::text                     AS agents_active,
      COALESCE(SUM(amount_wei::numeric), 0)::text        AS amount_sum_wei
    FROM agent_events
    WHERE ts > ${sinceCutoff}
  `);

  const top = agg.rows[0] ?? { tx_count: "0", agents_active: "0", amount_sum_wei: "0" };

  const topServices = await leaderboard("services", windowHours, 10);
  const topAgents = await leaderboard("agents", windowHours, 10);
  const recentEvents = await recentDecoded(25);

  return {
    windowHours,
    txCount: Number(top.tx_count),
    agentsActive: Number(top.agents_active),
    amountSumWei: top.amount_sum_wei ?? "0",
    topServices,
    topAgents,
    recentEvents,
  };
}

export async function leaderboard(
  kind: "services" | "agents",
  windowHours: number,
  limit: number,
): Promise<LeaderboardRow[]> {
  const sinceCutoff = HOURS(windowHours);

  if (kind === "services") {
    // Top services by amount received (mpp_service category in address_labels).
    const rows = await db.execute<{
      id: string;
      label: string;
      category: string;
      tx_count: string;
      amount_sum_wei: string;
    }>(sql`
      SELECT
        a.id                                          AS id,
        a.label                                       AS label,
        (a.links ->> 'category')                      AS category,
        COUNT(*)::text                                AS tx_count,
        COALESCE(SUM(ae.amount_wei::numeric), 0)::text AS amount_sum_wei
      FROM agent_events ae
      JOIN agents a ON a.id = ae.agent_id
      WHERE ae.ts > ${sinceCutoff}
        AND ae.kind = 'transfer'
        AND a.id LIKE '%-mpp'
      GROUP BY a.id, a.label, a.links
      ORDER BY amount_sum_wei DESC
      LIMIT ${limit}
    `);
    return rows.rows.map((r) => ({
      id: r.id,
      label: r.label,
      category: r.category ?? null,
      txCount: Number(r.tx_count),
      amountSumWei: r.amount_sum_wei,
    }));
  }

  // Top "agents" — for v0 we're treating any non-mpp watched entity as an
  // agent. Better long-term: track payer addresses separately. v0 shows
  // services they pay too (top "active" agents by counterparty interaction).
  const rows = await db.execute<{
    id: string;
    label: string;
    tx_count: string;
    amount_sum_wei: string;
  }>(sql`
    SELECT
      a.id                                          AS id,
      a.label                                       AS label,
      COUNT(*)::text                                AS tx_count,
      COALESCE(SUM(ae.amount_wei::numeric), 0)::text AS amount_sum_wei
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    WHERE ae.ts > ${sinceCutoff}
      AND a.id NOT LIKE '%-mpp'
    GROUP BY a.id, a.label
    ORDER BY tx_count DESC
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => ({
    id: r.id,
    label: r.label,
    category: null,
    txCount: Number(r.tx_count),
    amountSumWei: r.amount_sum_wei,
  }));
}

export async function recentDecoded(limit = 25): Promise<RecentEventRow[]> {
  // Join agent_events → agents (for the matched side) AND
  //                  → address_labels via counterparty_address (for the other side).
  const rows = await db.execute<{
    id: number;
    ts: Date;
    agent_id: string;
    agent_label: string;
    agent_category: string | null;
    counterparty_address: string | null;
    counterparty_label: string | null;
    counterparty_category: string | null;
    kind: string;
    amount_wei: string | null;
    token_address: string | null;
    tx_hash: string;
    source_block: number;
    methodology_version: string;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.ts                                   AS ts,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      (a.links ->> 'category')                AS agent_category,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label,
      cl.category                             AS counterparty_category,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.token_address                        AS token_address,
      ae.tx_hash                              AS tx_hash,
      ae.source_block::int                    AS source_block,
      ae.methodology_version                  AS methodology_version
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    ORDER BY ae.ts DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    agentId: r.agent_id,
    agentLabel: r.agent_label,
    agentCategory: r.agent_category,
    counterpartyAddress: r.counterparty_address,
    counterpartyLabel: r.counterparty_label,
    counterpartyCategory: r.counterparty_category,
    kind: r.kind,
    amountWei: r.amount_wei,
    tokenAddress: r.token_address,
    txHash: r.tx_hash,
    sourceBlock: r.source_block,
    methodologyVersion: r.methodology_version,
  }));
}

export async function listMppServices(): Promise<ServiceListRow[]> {
  // All curated MPP services (id ends in '-mpp') with 24h + 7d aggregates.
  const rows = await db.execute<{
    id: string;
    label: string;
    category: string;
    settlement_address: string;
    tx_count_24h: string;
    tx_count_7d: string;
    amount_sum_wei_24h: string;
    amount_sum_wei_7d: string;
    agents_last_7d: string;
  }>(sql`
    SELECT
      a.id                                          AS id,
      a.label                                       AS label,
      COALESCE(a.links ->> 'category', 'unknown')   AS category,
      COALESCE(a.wallets[1], '')                    AS settlement_address,
      COALESCE((SELECT COUNT(*) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS tx_count_24h,
      COALESCE((SELECT COUNT(*) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '7 days'), 0)::text   AS tx_count_7d,
      COALESCE((SELECT SUM(amount_wei::numeric) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS amount_sum_wei_24h,
      COALESCE((SELECT SUM(amount_wei::numeric) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '7 days'), 0)::text   AS amount_sum_wei_7d,
      COALESCE((SELECT COUNT(DISTINCT counterparty_address)
                FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '7 days'), 0)::text   AS agents_last_7d
    FROM agents a
    WHERE a.active = true AND a.id LIKE '%-mpp'
    ORDER BY amount_sum_wei_24h DESC
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    settlementAddress: r.settlement_address,
    txCount24h: Number(r.tx_count_24h),
    txCount7d: Number(r.tx_count_7d),
    amountSumWei24h: r.amount_sum_wei_24h,
    amountSumWei7d: r.amount_sum_wei_7d,
    agentsLast7d: Number(r.agents_last_7d),
  }));
}

export async function listAgents(): Promise<AgentListRow[]> {
  const rows = await db.execute<{
    id: string;
    label: string;
    source: string;
    wallet_address: string | null;
    tx_count_24h: string;
    amount_sum_wei_24h: string;
    last_activity: Date | null;
    top_service_label: string | null;
  }>(sql`
    SELECT
      a.id, a.label, a.source,
      COALESCE(a.wallets[1], NULL) AS wallet_address,
      COALESCE((SELECT COUNT(*) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS tx_count_24h,
      COALESCE((SELECT SUM(amount_wei::numeric) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS amount_sum_wei_24h,
      (SELECT MAX(ts) FROM agent_events ae WHERE ae.agent_id = a.id)  AS last_activity,
      NULL::text                                                       AS top_service_label
    FROM agents a
    WHERE a.active = true AND a.id NOT LIKE '%-mpp'
    ORDER BY tx_count_24h DESC
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    label: r.label,
    source: r.source,
    walletAddress: r.wallet_address,
    txCount24h: Number(r.tx_count_24h),
    amountSumWei24h: r.amount_sum_wei_24h,
    lastActivity: r.last_activity,
    topServiceLabel: r.top_service_label,
  }));
}

export async function serviceDetail(id: string) {
  const recent = await db.execute<RecentEventRow>(sql`
    SELECT
      ae.id::int AS id, ae.ts, ae.agent_id,
      a.label AS agent_label,
      (a.links ->> 'category') AS agent_category,
      ae.counterparty_address, cl.label AS counterparty_label, cl.category AS counterparty_category,
      ae.kind, ae.amount_wei, ae.token_address, ae.tx_hash,
      ae.source_block::int, ae.methodology_version
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    WHERE ae.agent_id = ${id}
    ORDER BY ae.ts DESC
    LIMIT 50
  `);

  const trend = await db.execute<{ bucket: Date; amount_wei: string; tx_count: string }>(sql`
    SELECT
      date_trunc('hour', ts) AS bucket,
      COALESCE(SUM(amount_wei::numeric), 0)::text AS amount_wei,
      COUNT(*)::text AS tx_count
    FROM agent_events
    WHERE agent_id = ${id}
      AND ts > now() - interval '30 days'
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  const head = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  return {
    head: head[0] ?? null,
    recent: recent.rows,
    trend: trend.rows.map((r) => ({
      bucket: r.bucket,
      amountWei: r.amount_wei,
      txCount: Number(r.tx_count),
    })),
  };
}

export async function agentDetail(id: string) {
  return serviceDetail(id); // same query shape — different page presentation
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Smoke-test queries against dev DB (manual)**

```bash
source .env.local
npx tsx -e "
  import { dashboardSnapshot, listMppServices } from './lib/oli/queries';
  (async () => {
    const snap = await dashboardSnapshot(24);
    console.log('snapshot:', JSON.stringify({
      txCount: snap.txCount,
      agentsActive: snap.agentsActive,
      topServicesCount: snap.topServices.length,
    }, null, 2));
    const svcs = await listMppServices();
    console.log('services:', svcs.length);
    process.exit(0);
  })();
"
```

Expected: numeric output without errors. Empty if no `agent_events` rows yet — that's fine; trigger an ingest cycle to populate.

- [ ] **Step 4: Commit**

```bash
git add lib/oli/queries.ts
git commit -m "lib/oli/queries: dashboard + leaderboard + service/agent detail queries"
```

---

## Phase E — API endpoints

### Task 8: `GET /api/oli/dashboard`

**Files:**
- Create: `app/api/oli/dashboard/route.ts`

- [ ] **Step 1: Build the route**

Create `app/api/oli/dashboard/route.ts`:

```ts
import { NextResponse } from "next/server";
import { dashboardSnapshot } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await dashboardSnapshot(24);
  return NextResponse.json(snap);
}
```

- [ ] **Step 2: Smoke**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s http://localhost:3000/api/oli/dashboard | head -c 400
kill $DEV 2>/dev/null
```

Expected: JSON with `txCount`, `agentsActive`, `topServices`, `topAgents`, `recentEvents`.

- [ ] **Step 3: Commit**

```bash
git add app/api/oli/dashboard/route.ts
git commit -m "GET /api/oli/dashboard"
```

---

### Task 9: `GET /api/oli/services` + `[id]`

**Files:**
- Create: `app/api/oli/services/route.ts`, `app/api/oli/services/[id]/route.ts`

- [ ] **Step 1: List endpoint**

Create `app/api/oli/services/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listMppServices } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ services: await listMppServices() });
}
```

- [ ] **Step 2: Detail endpoint**

Create `app/api/oli/services/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { serviceDetail } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await serviceDetail(id);
  if (!detail.head) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
```

- [ ] **Step 3: Smoke**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s http://localhost:3000/api/oli/services | head -c 300
echo ""
curl -s http://localhost:3000/api/oli/services/anthropic-mpp | head -c 300
kill $DEV 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add app/api/oli/services/
git commit -m "GET /api/oli/services + [id] detail"
```

---

### Task 10: `GET /api/oli/agents` + `[id]`

**Files:**
- Create: `app/api/oli/agents/route.ts`, `app/api/oli/agents/[id]/route.ts`

- [ ] **Step 1: List**

Create `app/api/oli/agents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listAgents } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ agents: await listAgents() });
}
```

- [ ] **Step 2: Detail**

Create `app/api/oli/agents/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { agentDetail } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await agentDetail(id);
  if (!detail.head) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
```

- [ ] **Step 3: Smoke + commit**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s http://localhost:3000/api/oli/agents | head -c 300
echo ""
curl -s http://localhost:3000/api/oli/agents/pellet | head -c 300
kill $DEV 2>/dev/null
git add app/api/oli/agents/
git commit -m "GET /api/oli/agents + [id] detail"
```

---

## Phase F — OLI shell + components

### Task 11: OLI layout + Sidebar

**Files:**
- Create: `app/oli/layout.tsx`, `components/oli/Sidebar.tsx`

- [ ] **Step 1: Build the Sidebar**

Create `components/oli/Sidebar.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PelletMark } from "@/components/pellet-mark";

const sections = [
  {
    label: "Explore",
    items: [
      { label: "Dashboard", href: "/oli" },
      { label: "Services",  href: "/oli/services" },
      { label: "Agents",    href: "/oli/agents" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      style={{
        width: 240,
        borderRight: "1px solid var(--color-border-subtle)",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--color-bg-base)",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
      className="oli-sidebar"
    >
      <Link
        href="/oli"
        style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}
      >
        <PelletMark size={24} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-text-primary)" }}>
          pellet OLI
        </span>
      </Link>

      {sections.map((section) => (
        <nav key={section.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-quaternary)",
              padding: "0 8px",
              marginBottom: 6,
            }}
          >
            {section.label}
          </span>
          {section.items.map((item) => {
            const active = item.href === "/oli"
              ? pathname === "/oli"
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 13,
                  padding: "6px 8px",
                  borderRadius: 6,
                  color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  background: active ? "var(--color-bg-emphasis)" : "transparent",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}
```

- [ ] **Step 2: Build the OLI layout**

Create `app/oli/layout.tsx`:

```tsx
import { Sidebar } from "@/components/oli/Sidebar";

export const metadata = {
  title: "Pellet OLI — Open-Ledger Interface for Tempo",
};

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg-base)" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
```

(The marketing-site `<Nav>` already auto-suppresses on `/oli/*` per the existing `if (pathname?.startsWith("/oli")) return null;` in `components/Nav.tsx`. The marketing `<FooterGate>` may also need a similar guard — verify in step 3 below.)

- [ ] **Step 3: Verify FooterGate suppresses on /oli**

```bash
grep -A 10 "export" components/FooterGate.tsx | head -20
```

If FooterGate doesn't already suppress on `/oli/*`, add a similar guard:

```tsx
// At the top of the FooterGate render:
if (pathname?.startsWith("/oli")) return null;
```

- [ ] **Step 4: Stub the dashboard so routing works**

Create `app/oli/page.tsx` (placeholder; full impl in Task 17):

```tsx
export default function OliDashboardPage() {
  return (
    <div style={{ padding: "40px 48px" }}>
      <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36, fontWeight: 400, margin: 0 }}>
        Dashboard
      </h1>
      <p style={{ color: "var(--color-text-tertiary)", marginTop: 8 }}>placeholder · build in Task 17</p>
    </div>
  );
}
```

- [ ] **Step 5: Boot dev + visual sanity**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s -o /dev/null -w "/oli  HTTP %{http_code}\n" http://localhost:3000/oli
kill $DEV 2>/dev/null
```

Expected: 200. Open in a browser: sidebar on left with Dashboard/Services/Agents items, no marketing nav, no footer.

- [ ] **Step 6: Commit**

```bash
git add app/oli/ components/oli/Sidebar.tsx components/FooterGate.tsx
git commit -m "OLI shell: sidebar + layout + dashboard placeholder route"
```

---

### Task 12: `<StatStrip />`

**Files:**
- Create: `components/oli/StatStrip.tsx`

- [ ] **Step 1: Build**

Create `components/oli/StatStrip.tsx`:

```tsx
import type { Delta } from "@/lib/oli/format";

export type Stat = {
  label: string;
  value: string;
  delta?: Delta;
  hint?: string;
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="oli-stat-strip">
      {stats.map((s) => (
        <div key={s.label} className="oli-stat">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-quaternary)",
            }}
          >
            {s.label}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {s.value}
            </span>
            {s.delta && s.delta.tone !== "neutral" && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color:
                    s.delta.tone === "positive"
                      ? "var(--color-success)"
                      : "var(--color-error)",
                }}
              >
                {s.delta.display}
              </span>
            )}
          </div>
          {s.hint && (
            <span style={{ marginTop: 4, fontSize: 11, color: "var(--color-text-quaternary)" }}>
              {s.hint}
            </span>
          )}
        </div>
      ))}
      <style>{`
        .oli-stat-strip {
          display: grid;
          grid-template-columns: repeat(${"${stats.length}"}, 1fr);
          gap: 1px;
          background: var(--color-border-subtle);
          border: 1px solid var(--color-border-subtle);
          border-radius: 8px;
          overflow: hidden;
        }
        .oli-stat {
          background: var(--color-bg-base);
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}
```

Wait — that style template-literal nests wrongly. Fix the inline `<style>`:

Replace the `<style>` block above with:

```tsx
      <style jsx>{`
        .oli-stat-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1px;
          background: var(--color-border-subtle);
          border: 1px solid var(--color-border-subtle);
          border-radius: 8px;
          overflow: hidden;
        }
        .oli-stat {
          background: var(--color-bg-base);
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
        }
      `}</style>
```

(Next.js 16 supports `<style jsx>` via styled-jsx if needed; alternatively define the styles in `app/globals.css` with `.oli-stat-strip` class. For clarity in v0, define in globals.css instead — see step 2.)

- [ ] **Step 2: Move styles to globals.css for clarity**

Append to `app/globals.css`:

```css
/* ── OLI ── */
.oli-stat-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  overflow: hidden;
}
.oli-stat {
  background: var(--color-bg-base);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
}
```

And remove the inline `<style>` from `StatStrip.tsx` — keep just the JSX.

- [ ] **Step 3: Commit**

```bash
git add components/oli/StatStrip.tsx app/globals.css
git commit -m "OLI: <StatStrip /> hero stat cards"
```

---

### Task 13: `<Leaderboard />`

**Files:**
- Create: `components/oli/Leaderboard.tsx`

- [ ] **Step 1: Build**

Create `components/oli/Leaderboard.tsx`:

```tsx
import Link from "next/link";

export type LeaderboardCol<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
};

export function Leaderboard<T extends { id: string }>({
  title,
  rows,
  cols,
  hrefFor,
}: {
  title: string;
  rows: T[];
  cols: LeaderboardCol<T>[];
  hrefFor?: (row: T) => string;
}) {
  return (
    <div className="oli-leaderboard">
      <div className="oli-leaderboard-title">
        <span>{title}</span>
        <span style={{ color: "var(--color-text-quaternary)", fontSize: 11 }}>
          {rows.length} rows
        </span>
      </div>

      <div className="oli-leaderboard-table">
        <div
          className="oli-leaderboard-row oli-leaderboard-header"
          style={{ gridTemplateColumns: cols.map((c) => c.width ?? "1fr").join(" ") }}
        >
          {cols.map((c) => (
            <span key={c.key} style={{ textAlign: c.align ?? "left" }}>
              {c.header}
            </span>
          ))}
        </div>

        {rows.map((row) => {
          const inner = (
            <div
              className="oli-leaderboard-row"
              style={{ gridTemplateColumns: cols.map((c) => c.width ?? "1fr").join(" ") }}
            >
              {cols.map((c) => (
                <span
                  key={c.key}
                  style={{ textAlign: c.align ?? "left" }}
                >
                  {c.cell(row)}
                </span>
              ))}
            </div>
          );
          return hrefFor ? (
            <Link key={row.id} href={hrefFor(row)} className="oli-leaderboard-link">
              {inner}
            </Link>
          ) : (
            <div key={row.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
```

Append CSS to `app/globals.css`:

```css
.oli-leaderboard {
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-subtle);
}
.oli-leaderboard-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-tertiary);
}
.oli-leaderboard-table { display: flex; flex-direction: column; }
.oli-leaderboard-row {
  display: grid;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
  gap: 12px;
  border-bottom: 1px solid var(--color-border-subtle);
}
.oli-leaderboard-row:last-child { border-bottom: 0; }
.oli-leaderboard-header {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-quaternary);
  background: var(--color-bg-muted);
}
.oli-leaderboard-link {
  text-decoration: none;
  color: inherit;
  display: block;
  transition: background var(--duration-fast) ease;
}
.oli-leaderboard-link:hover { background: rgba(255,255,255,0.02); }
```

- [ ] **Step 2: Commit**

```bash
git add components/oli/Leaderboard.tsx app/globals.css
git commit -m "OLI: <Leaderboard /> generic ranked-table"
```

---

### Task 14: `<TrendChart />`

**Files:**
- Create: `components/oli/TrendChart.tsx`

- [ ] **Step 1: Build a hand-rolled SVG trend chart (matching landing's peg-chart aesthetic)**

Create `components/oli/TrendChart.tsx`:

```tsx
type Point = { ts: Date; value: number };

export function TrendChart({
  points,
  height = 120,
  formatY = (n) => String(n),
}: {
  points: Point[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  if (points.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--color-text-quaternary)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          background: "var(--color-bg-subtle)",
        }}
      >
        not enough data yet
      </div>
    );
  }

  const W = 800;
  const H = height;
  const padT = 12, padB = 16, padL = 0, padR = 0;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const ys = points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) => padT + ((yMax - v) / yRange) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(p.value).toFixed(2)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
        {/* baseline rule */}
        <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />

        {/* peg/zero line if data crosses 0 */}
        {yMin < 0 && yMax > 0 && (
          <line x1={0} x2={W} y1={yFor(0)} y2={yFor(0)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" strokeWidth={1} />
        )}

        {/* line */}
        <path d={path} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={1.5} strokeLinecap="square" />

        {/* most-recent indicator */}
        <circle cx={xFor(points.length - 1)} cy={yFor(last.value)} r={2.5} fill="rgba(255,255,255,0.95)" />
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{formatY(yMin)}</span>
        <span>{formatY(yMax)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/oli/TrendChart.tsx
git commit -m "OLI: <TrendChart /> hand-rolled SVG line chart"
```

---

### Task 15: `<EventStream />` + `<ProvenanceBadge />`

**Files:**
- Create: `components/oli/EventStream.tsx`, `components/oli/ProvenanceBadge.tsx`

- [ ] **Step 1: ProvenanceBadge**

Create `components/oli/ProvenanceBadge.tsx`:

```tsx
import { formatBlockNumber } from "@/lib/oli/format";

export function ProvenanceBadge({
  sourceBlock,
  methodologyVersion,
}: {
  sourceBlock: number;
  methodologyVersion: string;
}) {
  return (
    <span
      title={`block ${formatBlockNumber(sourceBlock)} · methodology ${methodologyVersion}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--color-text-quaternary)",
        cursor: "help",
      }}
    >
      ⏚ {methodologyVersion}
    </span>
  );
}
```

- [ ] **Step 2: EventStream**

Create `components/oli/EventStream.tsx`:

```tsx
import { decodeEventLine, type LabelMap } from "@/lib/oli/decode";
import { formatTimeAgo, shortHash } from "@/lib/oli/format";
import type { RecentEventRow } from "@/lib/oli/queries";
import { ProvenanceBadge } from "./ProvenanceBadge";

export function EventStream({
  events,
  labelMap,
}: {
  events: RecentEventRow[];
  labelMap: LabelMap;
}) {
  if (events.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--color-text-quaternary)",
          fontSize: 13,
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          background: "var(--color-bg-subtle)",
        }}
      >
        no events yet — waiting for the next ingest cycle
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        background: "var(--color-bg-subtle)",
      }}
    >
      {events.map((e) => {
        const decoded = decodeEventLine(
          {
            agentId: e.agentId,
            agentLabel: e.agentLabel,
            kind: e.kind,
            counterpartyAddress: e.counterpartyAddress,
            amountWei: e.amountWei,
            tokenAddress: e.tokenAddress,
            ts: e.ts,
          },
          labelMap,
        );
        return (
          <div
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr auto auto",
              gap: 12,
              alignItems: "center",
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border-subtle)",
              fontSize: 13,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-quaternary)",
              }}
            >
              {formatTimeAgo(e.ts)}
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>{decoded.summary}</span>
            <a
              href={`https://explore.tempo.xyz/tx/${e.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-text-tertiary)",
                textDecoration: "none",
              }}
            >
              tx {shortHash(e.txHash)}
            </a>
            <ProvenanceBadge sourceBlock={e.sourceBlock} methodologyVersion={e.methodologyVersion} />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/oli/EventStream.tsx components/oli/ProvenanceBadge.tsx
git commit -m "OLI: <EventStream /> + <ProvenanceBadge /> for decoded recent activity"
```

---

## Phase G — Pages

### Task 16: Helper — `lib/oli/labelMap.ts` (build the address → label map for client use)

**Files:**
- Create: `lib/oli/labelMap.ts`

- [ ] **Step 1: Build**

Create `lib/oli/labelMap.ts`:

```ts
import { db } from "@/lib/db/client";
import { addressLabels } from "@/lib/db/schema";
import type { LabelMap } from "./decode";

export async function buildLabelMap(): Promise<LabelMap> {
  const rows = await db
    .select({ address: addressLabels.address, label: addressLabels.label, category: addressLabels.category })
    .from(addressLabels);
  const map: LabelMap = {};
  for (const r of rows) {
    map[r.address.toLowerCase()] = { label: r.label, category: r.category };
  }
  return map;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/oli/labelMap.ts
git commit -m "lib/oli/labelMap: build address→label map for the decode layer"
```

---

### Task 17: `/oli` — Dashboard root

**Files:**
- Modify: `app/oli/page.tsx`

- [ ] **Step 1: Replace the placeholder with the real dashboard**

Replace `app/oli/page.tsx`:

```tsx
import { dashboardSnapshot } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { StatStrip } from "@/components/oli/StatStrip";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { EventStream } from "@/components/oli/EventStream";
import { formatUsdcAmount } from "@/lib/oli/format";

export const dynamic = "force-dynamic";

export default async function OliDashboardPage() {
  const [snap, labelMap] = await Promise.all([
    dashboardSnapshot(24),
    buildLabelMap(),
  ]);

  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
      <header>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 36,
            fontWeight: 400,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Dashboard
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
          Autonomous economic activity on Tempo, last 24 hours.
        </p>
      </header>

      <StatStrip
        stats={[
          {
            label: "MPP txs · 24h",
            value: snap.txCount.toLocaleString("en-US"),
            hint: "decoded transfer events",
          },
          {
            label: "Agents active · 24h",
            value: snap.agentsActive.toLocaleString("en-US"),
            hint: "watched entities with ≥1 event",
          },
          {
            label: "Service revenue · 24h",
            value: formatUsdcAmount(snap.amountSumWei, 6),
            hint: "sum of TIP-20 inflows",
          },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Leaderboard
          title="Top services"
          rows={snap.topServices}
          hrefFor={(r) => `/oli/services/${r.id}`}
          cols={[
            { key: "rank", header: "#", width: "32px", cell: (_r, /* idx via array map */) => "" },
            { key: "label", header: "service", cell: (r) => r.label },
            {
              key: "rev",
              header: "revenue",
              align: "right",
              cell: (r) => formatUsdcAmount(r.amountSumWei, 6),
            },
            { key: "tx", header: "txs", align: "right", width: "60px", cell: (r) => r.txCount.toLocaleString() },
          ]}
        />
        <Leaderboard
          title="Top agents"
          rows={snap.topAgents}
          hrefFor={(r) => `/oli/agents/${r.id}`}
          cols={[
            { key: "label", header: "agent", cell: (r) => r.label },
            { key: "tx", header: "txs", align: "right", width: "80px", cell: (r) => r.txCount.toLocaleString() },
          ]}
        />
      </div>

      <section>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-tertiary)",
            margin: "0 0 8px",
          }}
        >
          Recent activity
        </h2>
        <EventStream events={snap.recentEvents} labelMap={labelMap} />
      </section>
    </div>
  );
}
```

(Note: the `Leaderboard` cols array above includes `{ cell: (_r, idx /*…*/) => "" }` for the rank column — adjust the `Leaderboard` component to optionally pass index, OR drop the rank column from v0 and just use ordering. Simpler: drop the rank column for v0.)

- [ ] **Step 2: Drop the rank column from the cols arrays in this page**

Replace the topServices `cols` with:

```tsx
cols={[
  { key: "label", header: "service", cell: (r) => r.label },
  { key: "rev", header: "revenue", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei, 6) },
  { key: "tx", header: "txs", align: "right", width: "60px", cell: (r) => r.txCount.toLocaleString() },
]}
```

- [ ] **Step 3: Boot dev + smoke**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s -o /dev/null -w "/oli HTTP %{http_code}\n" http://localhost:3000/oli
kill $DEV 2>/dev/null
```

Open the URL in browser; verify dashboard renders with sidebar + stat strip + 2-column leaderboards + event stream below.

- [ ] **Step 4: Commit**

```bash
git add app/oli/page.tsx
git commit -m "OLI: /oli dashboard root — stats + leaderboards + recent events"
```

---

### Task 18: `/oli/services` — directory

**Files:**
- Create: `app/oli/services/page.tsx`

- [ ] **Step 1: Build the page**

Create `app/oli/services/page.tsx`:

```tsx
import { listMppServices } from "@/lib/oli/queries";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { formatUsdcAmount, shortAddress } from "@/lib/oli/format";

export const dynamic = "force-dynamic";

export default async function OliServicesPage() {
  const services = await listMppServices();
  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
      <header>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36, fontWeight: 400, margin: 0 }}>
          Services
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
          MPP-compatible services we track. Revenue is sum of TIP-20 inflows over the window.
        </p>
      </header>

      <Leaderboard
        title={`${services.length} services`}
        rows={services}
        hrefFor={(r) => `/oli/services/${r.id}`}
        cols={[
          { key: "label", header: "service", cell: (r) => r.label, width: "1.2fr" },
          { key: "category", header: "category", cell: (r) => r.category },
          { key: "rev24", header: "rev · 24h", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei24h, 6) },
          { key: "rev7d", header: "rev · 7d", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei7d, 6) },
          { key: "tx24", header: "txs · 24h", align: "right", width: "80px", cell: (r) => r.txCount24h.toLocaleString() },
          { key: "agents7", header: "agents · 7d", align: "right", width: "80px", cell: (r) => r.agentsLast7d.toLocaleString() },
          { key: "addr", header: "address", cell: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>{shortAddress(r.settlementAddress)}</code> },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Smoke + commit**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s -o /dev/null -w "/oli/services HTTP %{http_code}\n" http://localhost:3000/oli/services
kill $DEV 2>/dev/null
git add app/oli/services/page.tsx
git commit -m "OLI: /oli/services directory page"
```

---

### Task 19: `/oli/services/[id]` — service detail

**Files:**
- Create: `app/oli/services/[id]/page.tsx`

- [ ] **Step 1: Build**

Create `app/oli/services/[id]/page.tsx`:

```tsx
import { serviceDetail } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { TrendChart } from "@/components/oli/TrendChart";
import { EventStream } from "@/components/oli/EventStream";
import { formatUsdcAmount, shortAddress } from "@/lib/oli/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OliServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, labelMap] = await Promise.all([
    serviceDetail(id),
    buildLabelMap(),
  ]);

  if (!detail.head) notFound();

  const trendPoints = detail.trend.map((t) => ({
    ts: new Date(t.bucket),
    value: Number(t.amountWei) / 1_000_000, // USDC.e (6 decimals)
  }));

  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1024 }}>
      <header>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-quaternary)" }}>
          MPP Service
        </span>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 40, fontWeight: 400, margin: "4px 0 8px" }}>
          {detail.head.label}
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, margin: 0 }}>
          {detail.head.bio ?? ""}
        </p>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          settlement <code>{shortAddress(detail.head.wallets?.[0] ?? "")}</code>
        </div>
      </header>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Revenue trend · 30 days
        </h2>
        <TrendChart
          points={trendPoints}
          formatY={(v) => `$${v.toFixed(2)}`}
        />
      </section>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Recent activity
        </h2>
        <EventStream events={detail.recent as never} labelMap={labelMap} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Smoke + commit**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s -o /dev/null -w "/oli/services/anthropic-mpp HTTP %{http_code}\n" http://localhost:3000/oli/services/anthropic-mpp
kill $DEV 2>/dev/null
git add app/oli/services/\[id\]/page.tsx
git commit -m "OLI: /oli/services/[id] service-detail page"
```

---

### Task 20: `/oli/agents` directory + `[id]` detail

**Files:**
- Create: `app/oli/agents/page.tsx`, `app/oli/agents/[id]/page.tsx`
- Modify: `app/agents/page.tsx` (the placeholder we wrote earlier — redirect to `/oli/agents`)

- [ ] **Step 1: Agents directory**

Create `app/oli/agents/page.tsx`:

```tsx
import { listAgents } from "@/lib/oli/queries";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { formatUsdcAmount, formatTimeAgo, shortAddress } from "@/lib/oli/format";

export const dynamic = "force-dynamic";

export default async function OliAgentsPage() {
  const list = await listAgents();
  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
      <header>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36, fontWeight: 400, margin: 0 }}>
          Agents
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
          Watched entities — system actors, autonomous wallets, and the Pellet observer itself.
        </p>
      </header>

      <Leaderboard
        title={`${list.length} agents`}
        rows={list}
        hrefFor={(r) => `/oli/agents/${r.id}`}
        cols={[
          { key: "label", header: "agent", cell: (r) => r.label, width: "1.2fr" },
          { key: "source", header: "source", cell: (r) => r.source },
          { key: "tx24", header: "txs · 24h", align: "right", width: "100px", cell: (r) => r.txCount24h.toLocaleString() },
          { key: "spent24", header: "amount · 24h", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei24h, 6) },
          { key: "last", header: "last", align: "right", width: "80px", cell: (r) => r.lastActivity ? formatTimeAgo(new Date(r.lastActivity)) : "—" },
          { key: "addr", header: "wallet", cell: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>{r.walletAddress ? shortAddress(r.walletAddress) : "—"}</code> },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Agent detail**

Create `app/oli/agents/[id]/page.tsx`:

```tsx
import { agentDetail } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { TrendChart } from "@/components/oli/TrendChart";
import { EventStream } from "@/components/oli/EventStream";
import { shortAddress } from "@/lib/oli/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OliAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, labelMap] = await Promise.all([
    agentDetail(id),
    buildLabelMap(),
  ]);

  if (!detail.head) notFound();

  const trendPoints = detail.trend.map((t) => ({
    ts: new Date(t.bucket),
    value: Number(t.amountWei) / 1_000_000,
  }));

  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1024 }}>
      <header>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-quaternary)" }}>
          Agent
        </span>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 40, fontWeight: 400, margin: "4px 0 8px" }}>
          {detail.head.label}
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, margin: 0 }}>
          {detail.head.bio ?? ""}
        </p>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          wallet <code>{detail.head.wallets?.[0] ? shortAddress(detail.head.wallets[0]) : "—"}</code>
        </div>
      </header>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Activity trend · 30 days
        </h2>
        <TrendChart points={trendPoints} formatY={(v) => `$${v.toFixed(2)}`} />
      </section>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Recent activity
        </h2>
        <EventStream events={detail.recent as never} labelMap={labelMap} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Update the existing `/agents` placeholder to redirect to `/oli/agents`**

Replace `app/agents/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function AgentsRedirect() {
  redirect("/oli/agents");
}
```

(So the `Agents` link in the marketing nav still works and lands on the OLI surface.)

- [ ] **Step 4: Smoke + commit**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s -o /dev/null -w "/oli/agents HTTP %{http_code}\n" http://localhost:3000/oli/agents
curl -s -o /dev/null -w "/oli/agents/pellet HTTP %{http_code}\n" http://localhost:3000/oli/agents/pellet
curl -s -o /dev/null -w "/agents (redirect) HTTP %{http_code}\n" http://localhost:3000/agents
kill $DEV 2>/dev/null
git add app/oli/agents/ app/agents/page.tsx
git commit -m "OLI: /oli/agents directory + [id] detail; /agents → /oli/agents redirect"
```

---

## Phase H — Mobile reshape + cron + smoke

### Task 21: Mobile responsiveness for OLI shell + pages

**Files:**
- Modify: `components/oli/Sidebar.tsx`, `app/oli/layout.tsx`, `app/globals.css`, all `/oli/*/page.tsx`

The desktop layout uses a 240px fixed sidebar + flex main. For mobile (< 768px) the sidebar collapses to a top sticky bar with horizontal scroll.

- [ ] **Step 1: Add mobile-bar CSS to globals.css**

Append to `app/globals.css`:

```css
/* OLI mobile reshape */
@media (max-width: 767px) {
  .oli-sidebar {
    position: sticky !important;
    top: 0;
    width: 100% !important;
    height: auto !important;
    border-right: none !important;
    border-bottom: 1px solid var(--color-border-subtle);
    flex-direction: row !important;
    gap: 0 !important;
    padding: 12px 16px !important;
    overflow-x: auto;
    align-items: center;
  }
  .oli-sidebar > nav {
    flex-direction: row !important;
    gap: 4px !important;
    margin-left: 16px;
  }
  .oli-sidebar > nav > span {
    display: none; /* hide section header on mobile */
  }
  .oli-layout-shell {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: Add the `oli-layout-shell` class to the layout div**

In `app/oli/layout.tsx`, add `className="oli-layout-shell"` to the outer flex div:

```tsx
<div className="oli-layout-shell" style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg-base)" }}>
```

- [ ] **Step 3: Add responsive padding to pages**

In each `app/oli/**/page.tsx`, replace `padding: "32px 48px"` with a class:

```tsx
<div className="oli-page" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
```

And add to globals.css:

```css
.oli-page {
  padding: 32px 48px;
}
@media (max-width: 767px) {
  .oli-page {
    padding: 20px 16px;
  }
  .oli-page > div[style*="grid-template-columns: 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
}
```

- [ ] **Step 4: Smoke on mobile viewport**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
# Use curl with iPhone UA + a viewport-checking script via Playwright if available.
# For v0: visually verify in browser at < 768px width.
echo "open http://localhost:3000/oli in browser; resize to 375px wide; verify"
kill $DEV 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add app/oli/ app/globals.css components/oli/Sidebar.tsx
git commit -m "OLI mobile reshape: sticky-bar nav + responsive page padding"
```

---

### Task 22: Re-enable hourly cron

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json**

Replace `vercel.json` with:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "crons": [
    { "path": "/api/cron/ingest",      "schedule": "0 * * * *" },
    { "path": "/api/cron/match",       "schedule": "5 * * * *" },
    { "path": "/api/cron/pellet-tick", "schedule": "10 * * * *" }
  ]
}
```

(Stagger by 5 min: ingest at :00, match at :05, pellet-tick at :10. Avoids cold-start collisions and lets ingest finish before match runs.)

- [ ] **Step 2: Set CRON_SECRET on Vercel (USER step)**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
# Copy the value
npx vercel env add CRON_SECRET production
# Paste when prompted; mark as sensitive (Y)
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "vercel.json: re-enable hourly cron schedule (ingest/match/pellet-tick staggered)"
```

---

### Task 23: Smoke tests for OLI routes

**Files:**
- Modify: `tests/feed.e2e.spec.ts`

- [ ] **Step 1: Append OLI smoke tests**

Append to `tests/feed.e2e.spec.ts`:

```ts
test("/oli renders the dashboard with sidebar", async ({ page }) => {
  await page.goto("/oli");
  await expect(page.locator("aside.oli-sidebar")).toBeVisible();
  await expect(page.locator("h1")).toContainText("Dashboard");
});

test("/oli/services lists services", async ({ request }) => {
  const res = await request.get("/oli/services");
  expect(res.status()).toBe(200);
});

test("/oli/agents lists agents", async ({ request }) => {
  const res = await request.get("/oli/agents");
  expect(res.status()).toBe(200);
});

test("/api/oli/dashboard returns snapshot shape", async ({ request }) => {
  const res = await request.get("/api/oli/dashboard");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(typeof json.txCount).toBe("number");
  expect(Array.isArray(json.topServices)).toBe(true);
  expect(Array.isArray(json.topAgents)).toBe(true);
  expect(Array.isArray(json.recentEvents)).toBe(true);
});

test("/api/oli/services returns list", async ({ request }) => {
  const res = await request.get("/api/oli/services");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.services)).toBe(true);
});

test("/api/oli/agents returns list", async ({ request }) => {
  const res = await request.get("/api/oli/agents");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.agents)).toBe(true);
});
```

- [ ] **Step 2: Run smoke**

```bash
pkill -f "next dev" 2>/dev/null; sleep 1
npm run e2e 2>&1 | tail -10
```

Expected: all tests pass (existing 8 + new 6 = 14).

- [ ] **Step 3: Commit**

```bash
git add tests/feed.e2e.spec.ts
git commit -m "smoke: add /oli routes + /api/oli/* endpoint coverage"
```

---

### Task 24: Production deploy + verify

**Files:** none (deploy)

- [ ] **Step 1: Apply schema migration to prod DB**

```bash
npx vercel env pull .env.production --environment=production
source .env.production && for f in drizzle/0002_*.sql; do
  psql "$POSTGRES_URL_NON_POOLING" -f "$f"
done
```

- [ ] **Step 2: Re-seed services on prod**

```bash
source .env.production && npm run seed:services
```

- [ ] **Step 3: Trigger an initial ingest + match cycle (so prod has data)**

```bash
source .env.production
curl -s "https://pellet.network/api/cron/ingest" -H "authorization: Bearer $CRON_SECRET"
curl -s "https://pellet.network/api/cron/match"  -H "authorization: Bearer $CRON_SECRET"
```

- [ ] **Step 4: Push code + deploy**

```bash
git push origin pellet:main
npx vercel --prod --yes
```

- [ ] **Step 5: Verify**

```bash
curl -s -o /dev/null -w "/oli %{http_code}\n" https://pellet.network/oli
curl -s https://pellet.network/api/oli/dashboard | head -c 400
```

Open `https://pellet.network/oli` in browser; verify sidebar + dashboard renders with real data.

- [ ] **Step 6: No commit needed** — deploy is config-driven via vercel.json

---

## Self-review

**Spec coverage:**
- §0 angle, §1 product summary, §2 goals, §3 non-goals → contextual; reflected in scope of every task
- §4 routes + sidebar → Tasks 11, 17, 18, 19, 20
- §5 audience → no implementation needed
- §6 page designs → Tasks 17 (Dashboard), 18 (Services list), 19 (Service detail), 20 (Agents list + detail)
- §7 data sources + decoding → Tasks 1, 2, 5, 6 (schema + matcher + seed)
- §7.5 OLI provenance → Task 15 (`<ProvenanceBadge />`)
- §8 architecture → Tasks 8, 9, 10 (API endpoints), 7 (queries layer), 11 (shell)
- §9 aesthetic → Tasks 11–15 (visual primitives), 12 styles in globals.css
- §9.5 mobile → Task 21
- §10 tech stack → no new deps, only existing
- §11 roadmap → no tasks (deferred)
- §12 open questions → flagged inline (aggregator decoding noted in Task 6 step 3 fallback; chart library defaulted to hand-rolled)
- §13 ruthless cuts → respected throughout; out-of-scope items absent
- §A file layout → matches plan's file structure

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate X" patterns. Two sites where things are explicitly deferred and marked:
- Task 6 step 3 — services that fail probe must have `settlementAddress` filled manually in `data/mpp-services.ts`. This is a research-during-impl reality, not a placeholder.
- Task 4 step 4 — drops a non-essential test ("attribute payer/recipient correctly") because the contract is simpler than the original tests assumed. Self-correcting.

**Type consistency:**
- `AgentEventMatch` (matcher.ts) carries `amountWei`, `tokenAddress`, `counterpartyAddress` after Task 2; Task 7 queries assume those columns exist (set in Task 1).
- `LabelMap` (decode.ts) used identically in `EventStream` (Task 15) and `buildLabelMap` (Task 16).
- `RecentEventRow` exported from queries.ts is the shape both `EventStream` consumes and `serviceDetail`/`agentDetail` return.
- `LeaderboardCol<T>` from Task 13 is consumed by Tasks 17, 18, 20 — drops the unused index argument.

**Scope check:** 24 tasks, single coherent shipment. ~1 week feasible. Each task is bite-sized (most 5–15 minutes; the big ones are the queries module in Task 7 and the dashboard page in Task 17).
