# Pellet Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a terminal-native, MPP/x402-aware agent named `pellet` that runs in the wallet shell and answers most user wallet questions without round-tripping a tool call.

**Architecture:** A thin REPL CLI in `cli/src/commands/agent.ts` streams from a Next.js route at `app/api/wallet/agent/chat/route.ts`. The route assembles a cached system prompt (wallet docs + cheatsheet + MPP catalog) and runs an AI SDK `streamText` loop against the Vercel AI Gateway with `anthropic/claude-haiku-4-5`. Tools call directly into existing `lib/wallet/*` and `lib/mpp/*` helpers. Slash commands bypass the LLM entirely.

**Tech Stack:** Next.js 16 (App Router), AI SDK v6, `@ai-sdk/gateway`, Drizzle, viem, Vitest, node-pty, xterm.js. CLI is ESM TypeScript.

**Reference docs:** `AGENTS.md` requires reading `node_modules/next/dist/docs/` for any Next 16 route work. AI SDK v6 streamText pattern + Anthropic prompt caching via `providerOptions.anthropic.cacheControl`.

---

## File Structure

**New files:**
- `lib/agent/pellet/knowledge/loader.ts` — flatten `content/docs/*.mdx` to plain text
- `lib/agent/pellet/knowledge/wallet-cheatsheet.md` — curated Q&A
- `lib/agent/pellet/knowledge/loader.test.ts`
- `lib/agent/pellet/catalog-injector.ts` — format MPP registry for prompt
- `lib/agent/pellet/catalog-injector.test.ts`
- `lib/agent/pellet/system-prompt.ts` — assemble final prompt
- `lib/agent/pellet/system-prompt.test.ts`
- `lib/agent/pellet/tools.ts` — tool definitions
- `lib/agent/pellet/tools.test.ts`
- `lib/agent/pellet/quota.ts` — daily NL turn cap
- `lib/agent/pellet/quota.test.ts`
- `lib/agent/pellet/router.ts` — model selection (Haiku-only for now)
- `app/api/wallet/agent/chat/route.ts` — streaming endpoint
- `cli/src/commands/agent.ts` — REPL client
- `cli/src/commands/agent.test.ts` — unit test for slash parser

**Modified:**
- `package.json` — add `ai`, `@ai-sdk/gateway`, `zod`
- `cli/src/index.ts` — register `agent` verb + default-to-agent
- `scripts/pellet-shell/.zshrc` — auto-launch on shell start
- `vitest.config.ts` — include `cli/**/*.test.ts`

---

## Task 1: Install AI SDK + Gateway

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add deps**

```bash
npm install ai@^6 @ai-sdk/gateway@latest zod@^3
```

Expected: `ai`, `@ai-sdk/gateway`, and `zod` appear under `dependencies`. (`zod` is the peer dep used for tool parameter schemas.)

- [ ] **Step 2: Confirm env var is documented**

Add to `.env.local.example` (create if missing):

```
# Vercel AI Gateway — get from https://vercel.com/dashboard/ai-gateway
AI_GATEWAY_API_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore(deps): add ai sdk + gateway for pellet agent"
```

---

## Task 2: Knowledge loader (flatten MDX docs)

**Files:**
- Create: `lib/agent/pellet/knowledge/loader.ts`
- Create: `lib/agent/pellet/knowledge/loader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/pellet/knowledge/loader.test.ts
import { describe, it, expect } from "vitest";
import { flattenMdx } from "./loader";

describe("flattenMdx", () => {
  it("strips frontmatter, imports, and JSX components, keeps prose + headings + code blocks", () => {
    const src = `---
title: Wallet
description: How it works
---

import { Card } from "fumadocs-ui/components/card";

# Wallet

The wallet supports passkey auth.

<Card title="Note">Some note</Card>

\`\`\`ts
const x = 1;
\`\`\`
`;
    const out = flattenMdx(src);
    expect(out).not.toContain("---");
    expect(out).not.toContain("import");
    expect(out).not.toContain("<Card");
    expect(out).toContain("# Wallet");
    expect(out).toContain("The wallet supports passkey auth.");
    expect(out).toContain("```ts");
    expect(out).toContain("const x = 1;");
  });

  it("returns empty string for empty input", () => {
    expect(flattenMdx("")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/agent/pellet/knowledge/loader.test.ts
```

Expected: FAIL with "Cannot find module './loader'".

- [ ] **Step 3: Implement loader**

```ts
// lib/agent/pellet/knowledge/loader.ts
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n+/;
const IMPORT_RE = /^import\s.+?from\s+['"][^'"]+['"];?\s*$/gm;
const JSX_BLOCK_RE = /<([A-Z][A-Za-z0-9]*)[\s\S]*?(?:\/>|>[\s\S]*?<\/\1>)/g;

export function flattenMdx(src: string): string {
  if (!src) return "";
  let out = src.replace(FRONTMATTER_RE, "");
  out = out.replace(IMPORT_RE, "");
  out = out.replace(JSX_BLOCK_RE, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

const DOC_FILES = [
  "index.mdx",
  "wallet.mdx",
  "wallet-cli.mdx",
  "wallet-mcp.mdx",
  "mcp.mdx",
  "webhooks.mdx",
  "methodology.mdx",
  "tempo-primer.mdx",
  "changelog.mdx",
];

let cache: { text: string; loadedAt: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function loadWalletKnowledge(): Promise<string> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.text;

  const root = join(process.cwd(), "content", "docs");
  const parts: string[] = [];

  for (const f of DOC_FILES) {
    try {
      const raw = await readFile(join(root, f), "utf8");
      parts.push(`### ${f}\n\n${flattenMdx(raw)}`);
    } catch {
      // missing file: skip
    }
  }

  // include api/ subdirectory
  try {
    const apiDir = join(root, "api");
    const apiFiles = await readdir(apiDir);
    for (const f of apiFiles.filter((x) => x.endsWith(".mdx"))) {
      const raw = await readFile(join(apiDir, f), "utf8");
      parts.push(`### api/${f}\n\n${flattenMdx(raw)}`);
    }
  } catch {
    // no api dir: skip
  }

  const text = parts.join("\n\n---\n\n");
  cache = { text, loadedAt: Date.now() };
  return text;
}

export function _resetCacheForTests(): void {
  cache = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/agent/pellet/knowledge/loader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pellet/knowledge/loader.ts lib/agent/pellet/knowledge/loader.test.ts
git commit -m "feat(agent): wallet docs loader with mdx flattening + 1h cache"
```

---

## Task 3: Wallet cheatsheet (curated Q&A)

**Files:**
- Create: `lib/agent/pellet/knowledge/wallet-cheatsheet.md`

- [ ] **Step 1: Write the cheatsheet**

```markdown
<!-- lib/agent/pellet/knowledge/wallet-cheatsheet.md -->
# Pellet Wallet Cheatsheet

High-confidence answers for common questions. Always prefer this over speculation.

## Auth

**Passkey (owner-direct):** the wallet's master key is a passkey on the user's device. Used for owner-only actions (revoking sessions, changing settings, owner-direct send/swap when no paired session exists).

**Session keys (paired sessions):** scoped, time-limited keys minted via `pellet auth start`. Used by external agents (BYOA) and standalone CLI. Have per-call and per-session spending caps. Can be revoked from the wallet dashboard.

**BYOA flow:** external agent → `pellet auth start` (device-code style) → user approves in wallet → agent receives bearer token → agent calls Pellet API with that token → all actions gated by session caps.

## 402 / x402 protocol

When a paid endpoint returns HTTP 402, the response includes a payment offer (amount, currency, intent: `charge` | `session`, method). Pellet auto-signs payment for the offer if it's within the session's per-call cap and the call is within the session's spend cap. Result is captured by the proxy / MCP client and the original request is retried with the payment receipt.

## MPP catalog

The catalog is the registry of x402-aware services Pellet knows about. Each service has endpoints with offers and an OpenAPI-style schema. Discovery happens at indexing time, not at call time. To call: `/call <service-id>` or via natural language ("scrape this URL").

## Swaps

In-wallet swap routing goes through Tempo's native AMM. `quoteSwap` returns expected output and slippage. Execution always requires user confirmation.

## Send

Sends require user confirmation. Owner-direct send (no paired session) routes via the passkey path. Paired-session send routes via the session key.

## Supported assets

- `USDC.e` (bridged USDC on Tempo)
- `pathUSD` (Moderato demo stable)

## Common error codes

- `401 missing bearer token` — no `Authorization: Bearer ...` header
- `403 session revoked` — session has been revoked from the dashboard
- `403 spend cap exceeded` — session's total spend cap reached
- `402 payment required` — paid endpoint requires x402 payment

## What the agent will NOT do

- Move funds without user confirmation. Ever.
- Reveal private keys, passkey credentials, or recovery phrases.
- Execute trades or sends from natural language alone — always renders a confirmation step.
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/pellet/knowledge/wallet-cheatsheet.md
git commit -m "feat(agent): hand-curated wallet cheatsheet"
```

---

## Task 4: MPP catalog injector

**Files:**
- Create: `lib/agent/pellet/catalog-injector.ts`
- Create: `lib/agent/pellet/catalog-injector.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/pellet/catalog-injector.test.ts
import { describe, it, expect } from "vitest";
import { formatCatalogForPrompt } from "./catalog-injector";
import type { RegistryEntry } from "@/lib/mpp/registry";

describe("formatCatalogForPrompt", () => {
  it("renders a registry list with id/name/category/url", () => {
    const reg: RegistryEntry[] = [
      { id: "openai", name: "OpenAI", category: "ai", url: "https://openai.mpp.tempo.xyz", discoveryUrl: "https://openai.mpp.tempo.xyz/openapi.json" },
      { id: "alchemy", name: "Alchemy", category: "blockchain", url: "https://mpp.alchemy.com", discoveryUrl: "https://mpp.alchemy.com/openapi.json" },
    ];
    const out = formatCatalogForPrompt(reg);
    expect(out).toContain("openai");
    expect(out).toContain("OpenAI");
    expect(out).toContain("ai");
    expect(out).toContain("alchemy");
    expect(out).toContain("blockchain");
  });

  it("returns a sentence noting empty catalog when empty", () => {
    expect(formatCatalogForPrompt([])).toMatch(/no services/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/agent/pellet/catalog-injector.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement injector**

```ts
// lib/agent/pellet/catalog-injector.ts
import type { RegistryEntry } from "@/lib/mpp/registry";

export function formatCatalogForPrompt(services: RegistryEntry[]): string {
  if (services.length === 0) return "No services indexed in the catalog.";
  const rows = services.map(
    (s) => `- ${s.id} | ${s.name} | category: ${s.category} | ${s.url}`,
  );
  return [
    "Available MPP / x402 services (by id):",
    ...rows,
    "",
    "Use these ids with `/call <id>` or by referring to them by name in natural language.",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/agent/pellet/catalog-injector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pellet/catalog-injector.ts lib/agent/pellet/catalog-injector.test.ts
git commit -m "feat(agent): mpp catalog → prompt formatter"
```

---

## Task 5: System prompt assembler

**Files:**
- Create: `lib/agent/pellet/system-prompt.ts`
- Create: `lib/agent/pellet/system-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/pellet/system-prompt.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

vi.mock("./knowledge/loader", () => ({
  loadWalletKnowledge: vi.fn(async () => "FAKE WALLET DOCS"),
}));

vi.mock("./catalog-injector", () => ({
  formatCatalogForPrompt: vi.fn(() => "FAKE CATALOG"),
}));

vi.mock("@/lib/mpp/registry", () => ({
  MPP_SERVICES: [],
}));

describe("buildSystemPrompt", () => {
  it("includes identity, behavioral rules, knowledge, cheatsheet, and catalog", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toMatch(/Pellet Agent/);
    expect(prompt).toMatch(/never moves? funds/i);
    expect(prompt).toMatch(/FAKE WALLET DOCS/);
    expect(prompt).toMatch(/FAKE CATALOG/);
    expect(prompt).toMatch(/Pellet Wallet Cheatsheet/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/agent/pellet/system-prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement assembler**

```ts
// lib/agent/pellet/system-prompt.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MPP_SERVICES } from "@/lib/mpp/registry";
import { loadWalletKnowledge } from "./knowledge/loader";
import { formatCatalogForPrompt } from "./catalog-injector";

const IDENTITY_AND_RULES = `You are Pellet Agent — a terminal-native assistant for the Pellet Wallet on Tempo.

You answer questions about the Pellet wallet, MPP / x402 services, balances, sessions, and on-chain state. You are concise. You think in terminal output: short, scannable, no marketing fluff.

# Hard rules
- You NEVER move funds yourself. Sends, swaps, and over-budget service calls always render a confirmation that the user must approve.
- You NEVER reveal or claim to know private keys, passkey credentials, or recovery phrases.
- You answer wallet/protocol questions from the knowledge base below — do not call tools for static knowledge.
- You call tools only for live state: balances, recent spend, session budget, current chat thread, swap/send quotes.

# Behavioral
- For natural-language requests that map to a slash command, propose the slash command and an inline (y/n) confirmation rather than executing.
- When recommending an MPP service, name the cheapest service that satisfies the user's need; mention price and approximate latency if known.
- If unsure, say so and suggest a slash command the user can run.
`;

let cheatsheetCache: string | null = null;

async function loadCheatsheet(): Promise<string> {
  if (cheatsheetCache !== null) return cheatsheetCache;
  const path = join(process.cwd(), "lib", "agent", "pellet", "knowledge", "wallet-cheatsheet.md");
  cheatsheetCache = await readFile(path, "utf8");
  return cheatsheetCache;
}

export async function buildSystemPrompt(): Promise<string> {
  const [wallet, cheatsheet] = await Promise.all([loadWalletKnowledge(), loadCheatsheet()]);
  const catalog = formatCatalogForPrompt(MPP_SERVICES);

  return [
    IDENTITY_AND_RULES,
    "# Pellet Wallet Cheatsheet",
    cheatsheet,
    "# Pellet Wallet Knowledge Base",
    wallet,
    "# MPP Service Catalog",
    catalog,
  ].join("\n\n");
}

export function _resetCheatsheetForTests(): void {
  cheatsheetCache = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/agent/pellet/system-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pellet/system-prompt.ts lib/agent/pellet/system-prompt.test.ts
git commit -m "feat(agent): system prompt assembly with knowledge + cheatsheet + catalog"
```

---

## Task 6: Tool definitions

**Files:**
- Create: `lib/agent/pellet/tools.ts`
- Create: `lib/agent/pellet/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/pellet/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildTools } from "./tools";

vi.mock("@/lib/wallet/tempo-balance", () => ({
  readWalletBalances: vi.fn(async () => [
    { symbol: "USDC.e", address: "0xabc", raw: 1000000n, display: "1.000000" },
  ]),
}));

vi.mock("@/lib/mpp/registry", () => ({
  MPP_SERVICES: [
    { id: "openai", name: "OpenAI", category: "ai", url: "u", discoveryUrl: "d" },
  ],
}));

vi.mock("@/lib/db/wallet-chat", () => ({
  recentChatMessages: vi.fn(async () => [
    { id: "m1", sender: "user", content: "hi", createdAt: new Date("2026-05-08T00:00:00Z") },
    { id: "m2", sender: "agent", content: "hello", createdAt: new Date("2026-05-08T00:00:01Z") },
  ]),
}));

describe("buildTools", () => {
  const ctx = { userId: "u1", managedAddress: "0xabc" as `0x${string}` };

  it("getBalance returns balances for the user's managed address", async () => {
    const tools = buildTools(ctx);
    const r = await tools.getBalance.execute({}, { toolCallId: "t", messages: [] } as any);
    expect(r).toMatchObject({ balances: [{ symbol: "USDC.e", display: "1.000000" }] });
  });

  it("listMppServices returns catalog ids", async () => {
    const tools = buildTools(ctx);
    const r = await tools.listMppServices.execute({}, { toolCallId: "t", messages: [] } as any);
    expect(r).toMatchObject({ services: [{ id: "openai", name: "OpenAI" }] });
  });

  it("getThread returns the recent chat history", async () => {
    const tools = buildTools(ctx);
    const r = await tools.getThread.execute({ lastN: 10 }, { toolCallId: "t", messages: [] } as any);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]).toMatchObject({ sender: "user", content: "hi" });
  });

  it("proposeSend never executes — returns confirmation_required", async () => {
    const tools = buildTools(ctx);
    const r = await tools.proposeSend.execute(
      { to: "0xdef", amount: "1.5", asset: "USDC.e" },
      { toolCallId: "t", messages: [] } as any,
    );
    expect(r.kind).toBe("confirmation_required");
    expect(r.action).toBe("send");
  });

  it("callMppService returns confirmation_required when service is unknown", async () => {
    const tools = buildTools(ctx);
    const r = await tools.callMppService.execute(
      { serviceId: "unknown", path: "/foo", method: "GET", body: null },
      { toolCallId: "t", messages: [] } as any,
    );
    expect(r.kind).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/agent/pellet/tools.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement tools**

```ts
// lib/agent/pellet/tools.ts
import { tool } from "ai";
import { z } from "zod";
import type { Address } from "viem";
import { readWalletBalances } from "@/lib/wallet/tempo-balance";
import { MPP_SERVICES } from "@/lib/mpp/registry";
import { recentChatMessages } from "@/lib/db/wallet-chat";

export type ToolContext = {
  userId: string;
  managedAddress: Address;
};

export function buildTools(ctx: ToolContext) {
  return {
    getBalance: tool({
      description: "Get the user's current Tempo wallet balances across supported tokens.",
      parameters: z.object({}),
      execute: async () => {
        const balances = await readWalletBalances(ctx.managedAddress);
        return {
          balances: balances.map((b) => ({
            symbol: b.symbol,
            address: b.address,
            display: b.display,
          })),
        };
      },
    }),

    listMppServices: tool({
      description: "List MPP / x402 services from the catalog. Use this when the user asks what services are available or wants to find a service for a capability.",
      parameters: z.object({
        category: z.string().optional().describe("Optional category filter (e.g. 'ai', 'search')"),
      }),
      execute: async ({ category }) => {
        const filtered = category
          ? MPP_SERVICES.filter((s) => s.category === category)
          : MPP_SERVICES;
        return {
          services: filtered.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            url: s.url,
          })),
        };
      },
    }),

    getThread: tool({
      description: "Read the user's recent chat history with Pellet Agent. Use only when the user explicitly references prior context.",
      parameters: z.object({
        lastN: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ lastN }) => {
        const rows = await recentChatMessages(ctx.userId, lastN);
        return {
          messages: rows.map((r) => ({
            sender: r.sender,
            content: r.content,
            createdAt: r.createdAt.toISOString(),
          })),
        };
      },
    }),

    proposeSend: tool({
      description: "Propose a send. Returns a confirmation payload — DOES NOT EXECUTE. The CLI renders (y/n); on yes, the deterministic /api/wallet/pay path runs.",
      parameters: z.object({
        to: z.string().describe("Recipient address (0x...) or registered handle"),
        amount: z.string().describe("Amount as a decimal string, e.g. '1.5'"),
        asset: z.enum(["USDC.e", "pathUSD"]).describe("Asset symbol"),
      }),
      execute: async ({ to, amount, asset }) => ({
        kind: "confirmation_required" as const,
        action: "send" as const,
        params: { to, amount, asset },
        message: `Send ${amount} ${asset} to ${to}? (y/n)`,
      }),
    }),

    proposeSwap: tool({
      description: "Propose a swap. Returns a confirmation payload — DOES NOT EXECUTE.",
      parameters: z.object({
        from: z.enum(["USDC.e", "pathUSD"]),
        to: z.enum(["USDC.e", "pathUSD"]),
        amount: z.string(),
      }),
      execute: async ({ from, to, amount }) => ({
        kind: "confirmation_required" as const,
        action: "swap" as const,
        params: { from, to, amount },
        message: `Swap ${amount} ${from} → ${to}? (y/n)`,
      }),
    }),

    callMppService: tool({
      description: "Propose a call to an MPP / x402 service. Always returns a confirmation_required envelope (or error if the service id is unknown). The CLI renders the proposal and the user approves before the deterministic /api/v1/mpp/call path runs.",
      parameters: z.object({
        serviceId: z.string().describe("Catalog id from listMppServices, e.g. 'openai'"),
        path: z.string().describe("Endpoint path on that service, e.g. '/v1/chat/completions'"),
        method: z.enum(["GET", "POST"]).default("POST"),
        body: z.unknown().nullable().describe("Request body (or null for GET)"),
      }),
      execute: async ({ serviceId, path, method, body }) => {
        const svc = MPP_SERVICES.find((s) => s.id === serviceId);
        if (!svc) {
          return { kind: "error" as const, message: `Unknown service id: ${serviceId}` };
        }
        return {
          kind: "confirmation_required" as const,
          action: "mpp_call" as const,
          params: { serviceId, serviceUrl: svc.url, path, method, body },
          message: `Call ${svc.name} ${method} ${path}? (y/n)`,
        };
      },
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/agent/pellet/tools.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pellet/tools.ts lib/agent/pellet/tools.test.ts
git commit -m "feat(agent): tool definitions — balance, services, thread, propose send/swap, mpp call"
```

---

## Task 7: Quota helper (100 NL turns/day)

**Files:**
- Create: `lib/agent/pellet/quota.ts`
- Create: `lib/agent/pellet/quota.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/agent/pellet/quota.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkAndIncrementQuota, _resetForTests, DAILY_NL_CAP } from "./quota";

beforeEach(() => _resetForTests());

describe("checkAndIncrementQuota", () => {
  it("allows the first call and reports remaining = cap - 1", async () => {
    const r = await checkAndIncrementQuota("u1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(DAILY_NL_CAP - 1);
  });

  it("blocks once cap is reached", async () => {
    for (let i = 0; i < DAILY_NL_CAP; i++) {
      await checkAndIncrementQuota("u1");
    }
    const r = await checkAndIncrementQuota("u1");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("isolates users", async () => {
    for (let i = 0; i < DAILY_NL_CAP; i++) await checkAndIncrementQuota("u1");
    const r = await checkAndIncrementQuota("u2");
    expect(r.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/agent/pellet/quota.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement quota**

```ts
// lib/agent/pellet/quota.ts
// Per-user daily NL turn cap. In-memory; resets at UTC midnight or on
// process restart. Migrate to Postgres if multi-instance becomes a concern.

export const DAILY_NL_CAP = Number(process.env.PELLET_AGENT_DAILY_CAP ?? 100);

type Bucket = { dayKey: string; count: number };
const buckets = new Map<string, Bucket>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type QuotaResult = { allowed: boolean; remaining: number };

export async function checkAndIncrementQuota(userId: string): Promise<QuotaResult> {
  const today = todayKey();
  const cur = buckets.get(userId);
  if (!cur || cur.dayKey !== today) {
    buckets.set(userId, { dayKey: today, count: 1 });
    return { allowed: true, remaining: DAILY_NL_CAP - 1 };
  }
  if (cur.count >= DAILY_NL_CAP) {
    return { allowed: false, remaining: 0 };
  }
  cur.count += 1;
  return { allowed: true, remaining: DAILY_NL_CAP - cur.count };
}

export function _resetForTests(): void {
  buckets.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/agent/pellet/quota.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pellet/quota.ts lib/agent/pellet/quota.test.ts
git commit -m "feat(agent): in-memory daily turn-cap quota"
```

---

## Task 8: Model router

**Files:**
- Create: `lib/agent/pellet/router.ts`

- [ ] **Step 1: Implement (trivial; no test needed for a constant)**

```ts
// lib/agent/pellet/router.ts
// Currently Haiku-only. Escalation logic intentionally NOT implemented —
// revisit only if measured Haiku quality is insufficient on real traffic.

export const PELLET_MODEL = "anthropic/claude-haiku-4-5";

export function selectModel(): string {
  return PELLET_MODEL;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/pellet/router.ts
git commit -m "feat(agent): haiku-only model router"
```

---

## Task 9: Streaming chat endpoint

**Files:**
- Create: `app/api/wallet/agent/chat/route.ts`

- [ ] **Step 1: Read Next 16 route handler docs**

```bash
ls node_modules/next/dist/docs 2>/dev/null && cat node_modules/next/dist/docs/app/api-reference/file-conventions/route.mdx 2>/dev/null | head -80
```

Note the streaming pattern, runtime export, and Request handling shape used by Next 16.

- [ ] **Step 2: Implement endpoint**

```ts
// app/api/wallet/agent/chat/route.ts
import { streamText, convertToCoreMessages } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { buildSystemPrompt } from "@/lib/agent/pellet/system-prompt";
import { buildTools } from "@/lib/agent/pellet/tools";
import { selectModel } from "@/lib/agent/pellet/router";
import { checkAndIncrementQuota } from "@/lib/agent/pellet/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const quota = await checkAndIncrementQuota(user.id);
  if (!quota.allowed) {
    return new Response(
      JSON.stringify({
        error: "quota_exhausted",
        message:
          "Free Pellet Agent quota hit for today. Slash commands still work, or connect your own model via 'pellet mcp' to keep going.",
      }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { messages?: Array<{ role: string; content: string }> }
    | null;
  if (!body?.messages?.length) {
    return new Response(JSON.stringify({ error: "missing messages" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const system = await buildSystemPrompt();
  const tools = buildTools({
    userId: user.id,
    managedAddress: user.managedAddress as `0x${string}`,
  });

  const result = streamText({
    model: gateway(selectModel()),
    system,
    messages: convertToCoreMessages(body.messages as any),
    tools,
    maxTokens: 512,
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral", ttl: "1h" },
      },
    },
  });

  return result.toTextStreamResponse({
    headers: {
      "x-pellet-quota-remaining": String(quota.remaining),
    },
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `convertToCoreMessages` shape differs in your installed AI SDK version, adapt to current API per `node_modules/ai/dist/index.d.ts`.

- [ ] **Step 4: Smoke test against running dev server**

```bash
# In one terminal:
npm run dev

# In another, with a valid session token:
curl -N -X POST http://localhost:3000/api/wallet/agent/chat \
  -H "Authorization: Bearer $PELLET_BEARER" \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"what assets does pellet support?"}]}'
```

Expected: streamed text mentioning USDC.e and pathUSD.

- [ ] **Step 5: Commit**

```bash
git add app/api/wallet/agent/chat/route.ts
git commit -m "feat(agent): streaming chat endpoint via ai gateway + haiku"
```

---

## Task 10: CLI agent REPL

**Files:**
- Create: `cli/src/commands/agent.ts`
- Create: `cli/src/commands/agent.test.ts`
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Write the failing test for the slash parser**

```ts
// cli/src/commands/agent.test.ts
import { describe, it, expect } from "vitest";
import { parseInput } from "./agent";

describe("parseInput", () => {
  it("recognizes /balance as a slash command", () => {
    expect(parseInput("/balance")).toEqual({ kind: "slash", verb: "balance", args: [] });
  });

  it("parses /services with args", () => {
    expect(parseInput("/services search")).toEqual({
      kind: "slash",
      verb: "services",
      args: ["search"],
    });
  });

  it("treats anything else as natural language", () => {
    expect(parseInput("what's my balance?")).toEqual({
      kind: "nl",
      text: "what's my balance?",
    });
  });

  it("handles empty input", () => {
    expect(parseInput("")).toEqual({ kind: "empty" });
    expect(parseInput("   ")).toEqual({ kind: "empty" });
  });
});
```

Note: vitest is in the parent repo. From `cli/`, run via the parent: `npx --prefix .. vitest run cli/src/commands/agent.test.ts` — or add a vitest config to `cli/`. Simpler: include `cli/**/*.test.ts` in the root vitest config.

Update root `vitest.config.ts`:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts", "cli/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run cli/src/commands/agent.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement REPL + parser**

```ts
// cli/src/commands/agent.ts
import { createInterface } from "node:readline";
import { defaultBaseUrl, readSession } from "../config.js";

export type ParsedInput =
  | { kind: "slash"; verb: string; args: string[] }
  | { kind: "nl"; text: string }
  | { kind: "empty" };

export function parseInput(line: string): ParsedInput {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "empty" };
  if (trimmed.startsWith("/")) {
    const [verb, ...args] = trimmed.slice(1).split(/\s+/);
    return { kind: "slash", verb, args };
  }
  return { kind: "nl", text: trimmed };
}

const HELP = `
  /balance              show current balances
  /spend [days]         recent spend
  /services [query]     list MPP services
  /call <id>            call a service (interactive)
  /send                 start a guided send
  /swap                 start a guided swap
  /history              show recent chat history
  /budget               show session budget
  /help                 show this help
  /clear                clear screen
  /exit                 quit

  Or just type a question — Pellet Agent will answer.
`;

function dim(s: string): string {
  return `\x1b[2m${s}\x1b[0m`;
}

function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}

async function streamNl(text: string): Promise<void> {
  const session = await readSession();
  if (!session) {
    process.stdout.write("  not authenticated — run `pellet auth start` first.\n");
    return;
  }
  const baseUrl = defaultBaseUrl();
  const res = await fetch(`${baseUrl}/api/wallet/agent/chat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.bearer}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
  });

  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    process.stdout.write(`  ${body.message ?? "quota exhausted"}\n`);
    return;
  }
  if (!res.ok || !res.body) {
    process.stdout.write(`  request failed: ${res.status}\n`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
  }
  process.stdout.write("\n");
}

async function runSlash(verb: string, args: string[]): Promise<void> {
  const session = await readSession();
  if (!session && verb !== "help" && verb !== "clear" && verb !== "exit") {
    process.stdout.write("  not authenticated — run `pellet auth start` first.\n");
    return;
  }
  const baseUrl = defaultBaseUrl();
  switch (verb) {
    case "help":
      process.stdout.write(HELP);
      return;
    case "clear":
      process.stdout.write("\x1b[2J\x1b[H");
      return;
    case "balance": {
      const res = await fetch(`${baseUrl}/api/wallet/dashboard/balance`, {
        headers: { authorization: `Bearer ${session!.bearer}` },
      });
      const body = (await res.json()) as { balances?: Array<{ symbol: string; display: string }> };
      for (const b of body.balances ?? []) {
        process.stdout.write(`  ${b.symbol.padEnd(10)} ${b.display}\n`);
      }
      return;
    }
    case "services": {
      const q = args.join(" ");
      const url = q
        ? `${baseUrl}/api/services?q=${encodeURIComponent(q)}`
        : `${baseUrl}/api/services`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${session!.bearer}` },
      });
      const body = (await res.json()) as { services?: Array<{ id: string; name: string; category: string }> };
      for (const s of body.services ?? []) {
        process.stdout.write(`  ${s.id.padEnd(20)} ${s.name.padEnd(20)} ${dim(s.category)}\n`);
      }
      return;
    }
    case "exit":
      process.exit(0);
    default:
      process.stdout.write(`  unknown command: /${verb}. Try /help.\n`);
  }
}

export async function runAgentRepl(): Promise<number> {
  process.stdout.write(`\n  ${bold("Pellet Agent")} ready. Ask anything, or /help for commands.\n\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  rl.setPrompt("pellet> ");
  rl.prompt();

  for await (const line of rl) {
    const parsed = parseInput(line);
    try {
      if (parsed.kind === "slash") await runSlash(parsed.verb, parsed.args);
      else if (parsed.kind === "nl") await streamNl(parsed.text);
    } catch (e) {
      process.stdout.write(`  error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
    rl.prompt();
  }
  return 0;
}
```

- [ ] **Step 4: Wire into `cli/src/index.ts`**

Modify `cli/src/index.ts` — add the `agent` import and verb handler:

```ts
// cli/src/index.ts (modify)
// at top, alongside other imports:
import { runAgentRepl } from "./commands/agent.js";

// in main(), before the unknown-verb fallback, add:
if (verb === "agent" || verb === undefined) {
  return runAgentRepl();
}
```

Note: `verb === undefined` was previously caught by the `help` branch — move agent BEFORE help so `pellet` with no args opens the REPL. The existing help branch can keep `--help`/`-h`/`help` aliases.

Edit the help branch from:

```ts
if (!verb || verb === "help" || verb === "--help" || verb === "-h") {
```

to:

```ts
if (verb === "help" || verb === "--help" || verb === "-h") {
```

And add `if (!verb) return runAgentRepl();` immediately above the help branch.

- [ ] **Step 5: Run tests + build**

```bash
npx vitest run cli/src/commands/agent.test.ts
cd cli && npm run build && cd ..
```

Expected: tests pass; build emits `cli/dist/commands/agent.js`.

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/agent.ts cli/src/commands/agent.test.ts cli/src/index.ts vitest.config.ts
git commit -m "feat(agent): cli repl with slash + nl streaming"
```

---

## Task 11: Auto-launch in pellet-shell

**Files:**
- Create or modify: `scripts/pellet-shell/.zshrc`

- [ ] **Step 1: Inspect existing pellet-shell zshrc (if any)**

```bash
ls -la /Users/jake/pellet/scripts/pellet-shell/ && cat /Users/jake/pellet/scripts/pellet-shell/.zshrc 2>/dev/null
```

- [ ] **Step 2: Append auto-launch**

If the file exists, edit it. If not, create with:

```bash
# scripts/pellet-shell/.zshrc

# Resolve the locally-built CLI path. Falls back to globally installed `pellet`.
PELLET_CLI="${PELLET_CLI:-$(cd "$(dirname "$0")/../../cli/dist" 2>/dev/null && pwd)/index.js}"

if [ -f "$PELLET_CLI" ]; then
  alias pellet="node $PELLET_CLI"
fi

# Open Pellet Agent on shell start (skip if user already exited once via PELLET_AGENT_AUTOSTART=0)
if [ "${PELLET_AGENT_AUTOSTART:-1}" = "1" ]; then
  pellet 2>/dev/null
fi
```

- [ ] **Step 3: Verify by starting a shell with that ZDOTDIR**

```bash
ZDOTDIR=/Users/jake/pellet/scripts/pellet-shell zsh -i -c 'echo done'
```

Expected: Pellet Agent banner appears, then "done".

- [ ] **Step 4: Commit**

```bash
git add scripts/pellet-shell/.zshrc
git commit -m "feat(agent): auto-launch pellet repl in wallet shell"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the full dev stack**

```bash
npm run dev
```

Expected: terminal-bridge logs `pellet terminal bridge ws://localhost:7778`, Next dev server starts on 3000.

- [ ] **Step 2: Open the wallet UI in browser**

Sign in if needed, navigate to the terminal pane.

- [ ] **Step 3: Verify the banner appears**

Expected: terminal shows `Pellet Agent ready. Ask anything, or /help for commands.` followed by `pellet> ` prompt.

- [ ] **Step 4: Run slash commands**

Type:

```
/help
/balance
/services
```

Expected:
- `/help` prints the command list
- `/balance` prints USDC.e and pathUSD lines
- `/services` prints the catalog

- [ ] **Step 5: Run NL queries**

Type:

```
what assets does pellet support?
how does byoa work?
what services are good for scraping?
```

Expected: streamed text answers, drawn from cheatsheet/knowledge/catalog. No tool calls for static knowledge questions.

- [ ] **Step 6: Verify quota header**

```bash
curl -i -X POST http://localhost:3000/api/wallet/agent/chat \
  -H "Authorization: Bearer $PELLET_BEARER" \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}' | grep -i x-pellet-quota
```

Expected: `x-pellet-quota-remaining: 99` (or similar) on first call.

- [ ] **Step 7: Commit any fixes**

If issues are found and fixed, commit per the standard convention. If nothing needs fixing, skip.

```bash
git status
# fix anything broken
git commit -m "fix(agent): <what was fixed>"
```

---

## Out of scope (do NOT implement)

- Sonnet escalation
- Long-term memory beyond `wallet_chat`
- Autonomous / standing-instruction mode
- Paid tier
- Custom-trained model
- Postgres-backed quota (in-memory is sufficient for v1)
- Dashboard UI for the agent (REPL is the only surface)
- **Deferred tools (v2):** `getRecentSpend`, `getServiceSchema`, `getSessionBudget`, `quoteSwap`, `quoteSend`. These are useful but require pulling on existing query/quote code paths whose shape isn't yet stable; ship the v1 tool surface (balance/services/thread/proposeSend/proposeSwap/callMppService) first, then layer these in once the agent has real usage data.

---

## Acceptance criteria

- `pellet` (no args) opens the agent REPL inside the wallet shell.
- `/help`, `/balance`, `/services`, `/clear`, `/exit` all work and bypass the LLM.
- Natural-language queries stream answers from Haiku via AI Gateway.
- Wallet questions (assets, BYOA, 402, error codes) are answered from the knowledge base without tool calls.
- The 100-turn/day cap returns a 429 with the documented message on the 101st NL turn.
- All vitest tests added in this plan pass.
- The build of `cli/` emits `cli/dist/commands/agent.js`.
