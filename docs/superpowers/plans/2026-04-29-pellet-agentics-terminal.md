# Pellet Agentics Terminal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable v0 of Pellet — a clean monospace web terminal showing AI agents operating on Solana in real time.

**Architecture:** Next.js 16 (App Router) on Vercel. Postgres (Neon) for agent registry + event log. Helius webhooks for Solana event ingestion. SSE for realtime push. Curated allowlist of ~12 agents at launch.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Geist Mono, Postgres (Neon via Vercel Marketplace), Helius API, Vitest (unit), Playwright (smoke), Vercel (host + cron + analytics).

**Spec:** `docs/superpowers/specs/2026-04-29-pellet-agentics-terminal-design.md`

---

## File Structure

Files this plan creates (grouped by responsibility):

```
pellet/
├─ Project config
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ next.config.ts
│  ├─ tailwind.config.ts
│  ├─ postcss.config.mjs
│  ├─ vitest.config.ts
│  ├─ playwright.config.ts
│  └─ .env.example
│
├─ Brand + design
│  ├─ public/pellet-mark.svg            (copied from /assets)
│  ├─ app/icon.tsx                      (favicon)
│  ├─ app/globals.css                   (tokens, font face, base reset)
│  └─ lib/design/
│     ├─ tokens.ts                      (color/type/spacing constants)
│     └─ glyphs.ts                      (semantic glyph map)
│
├─ Pages + chrome
│  ├─ app/layout.tsx
│  ├─ app/page.tsx                      (renders <Header/> + <Feed/>)
│  └─ components/
│     ├─ header.tsx                     (mark + status + agent count)
│     ├─ pellet-mark.tsx                (inline SVG)
│     ├─ status-indicator.tsx           (live dot)
│     ├─ feed.tsx                       (client component, SSE consumer)
│     └─ event-card.tsx                 (single event display)
│
├─ Database
│  ├─ lib/db/client.ts                  (pg client singleton)
│  ├─ lib/db/schema.sql                 (one-shot DDL)
│  ├─ lib/db/agents.ts                  (agent queries)
│  ├─ lib/db/events.ts                  (event queries)
│  └─ data/curated-agents.ts            (seed list of watched agents)
│
├─ Ingestion
│  ├─ lib/helius/types.ts               (Helius webhook payload types)
│  ├─ lib/ingest/normalize.ts           (Helius event → our event row)
│  ├─ lib/ingest/normalize.test.ts
│  ├─ lib/ingest/insert.ts              (idempotent insert by tx_sig)
│  └─ lib/ingest/insert.test.ts
│
├─ API routes
│  ├─ app/api/agents/route.ts           (GET — list active agents)
│  ├─ app/api/feed/route.ts             (GET — SSE stream)
│  ├─ app/api/ingest/webhook/route.ts   (POST — Helius receiver)
│  └─ app/api/cron/pellet-tick/route.ts (GET — hourly Pellet observation)
│
├─ Realtime
│  └─ lib/realtime/bus.ts               (in-memory pub/sub wrapping pg LISTEN)
│
└─ Tests
   ├─ tests/feed.e2e.spec.ts            (Playwright smoke)
   └─ Vitest co-located with source
```

**Decomposition rationale:**
- `lib/` holds all logic, no React. `app/` and `components/` hold presentation.
- DB queries live with the table they touch (`agents.ts`, `events.ts`). One file per table.
- Ingestion is a pipeline: types → normalize → insert. Each step is independently testable.
- Realtime is a single bus module — UI subscribes to it via SSE.

---

## Phase A — Project foundation

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Run create-next-app non-interactively in the current directory**

```bash
cd /Users/jake/pellet
npx create-next-app@latest . --typescript --tailwind --app --src-dir false --import-alias "@/*" --turbopack --use-npm --no-eslint --skip-install
```

Expected: Files scaffolded into the current directory. README/.gitignore are preserved (create-next-app skips existing files or prompts; if it prompts, accept overwrites EXCEPT for `README.md` and `.gitignore`).

- [ ] **Step 2: Verify scaffold and reconcile .gitignore**

```bash
ls package.json tsconfig.json app/layout.tsx app/page.tsx app/globals.css next.config.* tailwind.config.*
```

Expected: All files exist.

If create-next-app overwrote `.gitignore`, restore the project-specific lines (`.DS_Store`, `.env*`, `.vercel/`):

```bash
grep -q "^.DS_Store$" .gitignore || echo ".DS_Store" >> .gitignore
grep -q "^.env\*$" .gitignore || echo ".env*" >> .gitignore
grep -q "^.vercel/$" .gitignore || echo ".vercel/" >> .gitignore
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 4: Boot dev server and confirm scaffold renders**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000`, default Next.js page renders. Stop the server (Ctrl+C) before continuing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "scaffold Next.js + Tailwind + TypeScript"
```

---

### Task 2: Add Geist Mono and design tokens

**Files:**
- Create: `lib/design/tokens.ts`, `lib/design/glyphs.ts`
- Modify: `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Wire Geist Mono via next/font**

Replace the contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "pellet // agentics terminal",
  description: "spectator-mode for ai agents on solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body className="bg-black text-white font-mono antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Install the geist font package**

```bash
npm install geist
```

- [ ] **Step 3: Define design tokens**

Create `lib/design/tokens.ts`:

```ts
// Single source of truth for visual constants.
// Only colors here; sizes/spacing are handled via Tailwind utilities.

export const colors = {
  bg: "#000000",
  fg: "#ffffff",
  muted: "#888888",
  border: "#1a1a1a",
  hover: "#0a0a0a",
  accent: "#c9a96e", // desaturated amber, used sparingly for warnings/highlights
} as const;

export type ColorToken = keyof typeof colors;
```

- [ ] **Step 4: Define glyph vocabulary**

Create `lib/design/glyphs.ts`:

```ts
// Semantic glyphs used across the UI. Single import surface so the brand voice stays consistent.
export const glyphs = {
  live: "●",
  idle: "○",
  partial: "◐",
  agent: "▣",
  event: "⌁",
  txLink: "↳",
  up: "▲",
  down: "▼",
  loadingFilled: "▰",
  loadingEmpty: "▱",
} as const;

export const eventKindGlyph: Record<string, string> = {
  swap: "⇄",
  transfer: "→",
  mint: "+",
  program_call: "⌁",
  social: "✎",
  attest: "✓",
  custom: "·",
};
```

- [ ] **Step 5: Update Tailwind config with color tokens**

Replace `tailwind.config.ts` content with:

```ts
import type { Config } from "tailwindcss";
import { colors } from "./lib/design/tokens";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: colors.bg,
        fg: colors.fg,
        muted: colors.muted,
        border: colors.border,
        hover: colors.hover,
        accent: colors.accent,
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Update globals.css with base reset**

Replace `app/globals.css` content with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: dark;
  }
  html, body {
    background: #000;
    color: #fff;
    min-height: 100vh;
  }
  ::selection {
    background: #c9a96e;
    color: #000;
  }
}
```

- [ ] **Step 7: Verify dev server still renders cleanly**

```bash
npm run dev
```

Expected: Page renders on black, Geist Mono is the body font (use browser devtools to confirm). Stop server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "add geist mono, design tokens, glyph vocabulary"
```

---

### Task 3: Wire the Pellet mark + favicon

**Files:**
- Create: `public/pellet-mark.svg`, `components/pellet-mark.tsx`, `app/icon.tsx`

- [ ] **Step 1: Copy the SVG into public/**

```bash
cp /Users/jake/pellet/assets/pellet-mark.svg /Users/jake/pellet/public/pellet-mark.svg
```

- [ ] **Step 2: Create the inline mark component**

Create `components/pellet-mark.tsx`:

```tsx
type Props = {
  size?: number;
  className?: string;
};

// Renders the Pellet mark inline. Single import surface so we can update the
// brand mark in one place. Uses the static SVG in /public for caching.
export function PelletMark({ size = 24, className }: Props) {
  return (
    <img
      src="/pellet-mark.svg"
      alt="pellet"
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
```

- [ ] **Step 3: Generate the favicon route**

Create `app/icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontSize: 22,
          fontFamily: "monospace",
          fontWeight: 700,
        }}
      >
        P
      </div>
    ),
    { ...size },
  );
}
```

(Reason for the simple "P" favicon vs SVG embed: ImageResponse renders cleanly at 32px and avoids the trace-detail-loss we saw at 48px. The full SVG mark is still served for higher-res surfaces via `<PelletMark>`.)

- [ ] **Step 4: Verify favicon and mark render**

```bash
npm run dev
```

Open `http://localhost:3000/icon` — see the favicon PNG. Open `http://localhost:3000/pellet-mark.svg` — see the SVG. Stop server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "wire pellet mark + favicon"
```

---

## Phase B — Static layout (no data yet)

### Task 4: Build the header

**Files:**
- Create: `components/header.tsx`, `components/status-indicator.tsx`

- [ ] **Step 1: Create the status indicator**

Create `components/status-indicator.tsx`:

```tsx
import { glyphs } from "@/lib/design/glyphs";

type Props = {
  state: "live" | "idle" | "error";
  label?: string;
};

const stateMap = {
  live: { glyph: glyphs.live, color: "text-accent", animate: "animate-pulse" },
  idle: { glyph: glyphs.idle, color: "text-muted", animate: "" },
  error: { glyph: glyphs.live, color: "text-fg", animate: "animate-pulse" },
};

export function StatusIndicator({ state, label }: Props) {
  const cfg = stateMap[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`${cfg.color} ${cfg.animate}`}>{cfg.glyph}</span>
      {label && <span className="text-muted">{label}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Create the header**

Create `components/header.tsx`:

```tsx
import { PelletMark } from "./pellet-mark";
import { StatusIndicator } from "./status-indicator";

type Props = {
  agentCount: number;
};

export function Header({ agentCount }: Props) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <PelletMark size={20} />
          <span className="text-sm tracking-tight text-fg">
            pellet <span className="text-muted">// agentics terminal · sol</span>
          </span>
        </div>
        <StatusIndicator state="live" label={`${agentCount} agents · live`} />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Render header in the page**

Replace `app/page.tsx` with:

```tsx
import { Header } from "@/components/header";

export default function Page() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={0} />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <p className="text-muted text-sm">no events yet · waiting for agents</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Confirm: black bg, Pellet mark top-left, wordmark next to it, "0 agents · live" right side with pulsing dot. Resize to mobile width — header collapses cleanly. Stop server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build header with mark + status indicator"
```

---

### Task 5: Build the EventCard component (static, no data yet)

**Files:**
- Create: `components/event-card.tsx`

- [ ] **Step 1: Define the event shape and write the component**

Create `components/event-card.tsx`:

```tsx
import { eventKindGlyph, glyphs } from "@/lib/design/glyphs";

export type FeedEvent = {
  id: string;
  agentId: string;
  agentLabel: string;
  ts: string; // ISO
  kind: string;
  summary: string;
  txSig: string | null;
  isPellet?: boolean;
};

type Props = { event: FeedEvent };

// Pure presentational. Card wraps a single event with the box-drawing aesthetic.
export function EventCard({ event }: Props) {
  const kindGlyph = eventKindGlyph[event.kind] ?? eventKindGlyph.custom;
  const time = formatTime(event.ts);

  return (
    <article className="border border-border bg-bg transition-colors hover:bg-hover">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted">
        <span>{time}</span>
        <span className="inline-flex items-center gap-1">
          <span className="text-accent">{kindGlyph}</span>
          {event.kind}
        </span>
      </header>
      <div className="px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className={event.isPellet ? "text-accent" : "text-fg"}>{glyphs.agent}</span>
          <span className="text-sm">{event.agentLabel}</span>
        </div>
        <p className="mt-1 pl-5 text-sm text-fg">{event.summary}</p>
        {event.txSig && (
          <a
            href={`https://solscan.io/tx/${event.txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 pl-5 text-xs text-muted hover:text-accent"
          >
            <span>{glyphs.txLink}</span>
            <span>tx {short(event.txSig)}</span>
          </a>
        )}
      </div>
    </article>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function short(sig: string): string {
  return `${sig.slice(0, 4)}…${sig.slice(-4)}`;
}
```

- [ ] **Step 2: Render a sample card on the home page to verify**

Replace the placeholder paragraph in `app/page.tsx` body with a sample event:

```tsx
import { Header } from "@/components/header";
import { EventCard } from "@/components/event-card";

export default function Page() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={1} />
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 sm:px-6">
        <EventCard
          event={{
            id: "sample",
            agentId: "pellet",
            agentLabel: "pellet",
            ts: new Date().toISOString(),
            kind: "custom",
            summary: "terminal initialized · waiting for upstream events",
            txSig: null,
            isPellet: true,
          }}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify visually**

```bash
npm run dev
```

Confirm: card renders with timestamp top-left, kind glyph + label top-right, agent block, summary text. Pellet's agent glyph shows in accent color. Stop server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build event card component"
```

---

## Phase C — Database

### Task 6: Provision Postgres and add the schema

**Files:**
- Create: `lib/db/schema.sql`, `lib/db/client.ts`, `.env.example`

- [ ] **Step 1: Provision Neon Postgres via Vercel Marketplace**

Run interactively (do this by hand — requires Vercel auth):

```bash
npx vercel link
npx vercel integration add neon
```

When prompted, create a new Neon project, attach it to the `pellet` Vercel project. Vercel will auto-provision `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` as project env vars.

Then pull them locally:

```bash
npx vercel env pull .env.local
```

Expected: `.env.local` contains `POSTGRES_URL=...`. (Never commit `.env.local` — it's in .gitignore.)

- [ ] **Step 2: Document required env vars**

Create `.env.example`:

```bash
# Database (provisioned via Vercel + Neon)
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# Helius (Solana data)
HELIUS_API_KEY=
HELIUS_WEBHOOK_SECRET=

# Cron auth (Vercel sets this automatically; required for /api/cron/* routes)
CRON_SECRET=
```

- [ ] **Step 3: Install pg client**

```bash
npm install pg
npm install --save-dev @types/pg
```

- [ ] **Step 4: Build the db client singleton**

Create `lib/db/client.ts`:

```ts
import { Pool } from "pg";

// Singleton pg pool. Uses POSTGRES_URL_NON_POOLING for LISTEN/NOTIFY
// (LISTEN requires a dedicated connection, not a pooler).
let _pool: Pool | undefined;
let _listenPool: Pool | undefined;

export function db(): Pool {
  if (!_pool) {
    if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL not set");
    _pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  }
  return _pool;
}

export function listenDb(): Pool {
  if (!_listenPool) {
    const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL_NON_POOLING not set");
    _listenPool = new Pool({ connectionString: url, max: 1 });
  }
  return _listenPool;
}
```

- [ ] **Step 5: Define the schema**

Create `lib/db/schema.sql`:

```sql
-- Pellet v0 schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  source      TEXT NOT NULL,
  wallets     TEXT[] NOT NULL DEFAULT '{}',
  bio         TEXT,
  links       JSONB NOT NULL DEFAULT '{}'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agents_active_idx ON agents (active) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ts         TIMESTAMPTZ NOT NULL,
  kind       TEXT NOT NULL,
  summary    TEXT NOT NULL,
  targets    JSONB NOT NULL DEFAULT '{}'::jsonb,
  tx_sig     TEXT,
  raw        JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tx_sig, agent_id, kind) -- idempotency guard
);

CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts DESC);
CREATE INDEX IF NOT EXISTS events_agent_ts_idx ON events (agent_id, ts DESC);

-- Notification trigger: fires NOTIFY on every event insert so the SSE bus can pick it up.
CREATE OR REPLACE FUNCTION notify_event_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('events', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_notify ON events;
CREATE TRIGGER events_notify
AFTER INSERT ON events
FOR EACH ROW EXECUTE FUNCTION notify_event_insert();
```

- [ ] **Step 6: Apply the schema**

Run with the local `psql` (install via `brew install libpq && brew link --force libpq` if missing). Use the connection string from `.env.local`:

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -f lib/db/schema.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `CREATE FUNCTION`, `CREATE TRIGGER` messages. No errors.

- [ ] **Step 7: Verify schema landed**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "\dt" && psql "$POSTGRES_URL_NON_POOLING" -c "\d events"
```

Expected: `agents` and `events` tables listed; `events` has the unique constraint on `(tx_sig, agent_id, kind)`.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.sql lib/db/client.ts .env.example package.json package-lock.json
git commit -m "provision postgres, define schema + db client"
```

---

### Task 7: Seed the curated agent list

**Files:**
- Create: `data/curated-agents.ts`, `lib/db/agents.ts`, `scripts/seed.ts`

- [ ] **Step 1: Define the seed data**

Create `data/curated-agents.ts`:

```ts
// Curated allowlist of watched agents for v0.
// Wallet addresses to be filled in during research pass — these are placeholders
// that MUST be replaced before deploy. The structure is what we're locking here.

export type SeedAgent = {
  id: string;
  label: string;
  source: "registry:ai16z" | "registry:virtuals" | "registry:goat" | "curated" | "pellet";
  wallets: string[];
  bio: string;
  links: { x?: string; site?: string };
};

export const CURATED_AGENTS: SeedAgent[] = [
  {
    id: "pellet",
    label: "pellet",
    source: "pellet",
    wallets: [],
    bio: "the agent that runs this terminal.",
    links: { x: "pelletnetwork", site: "pellet.network" },
  },
  // Research pass: populate the remaining ~11 agents with real wallets before deploy.
  // Anchor candidates: ai16z framework agents, AIXBT-equivalents on Solana,
  // Virtuals-on-Solana agents, Goat-deployed agents, and any currently-watched
  // wallets from CT alpha lists. See spec §12 (open questions).
];
```

- [ ] **Step 2: Build the agents query module**

Create `lib/db/agents.ts`:

```ts
import { db } from "./client";
import type { SeedAgent } from "@/data/curated-agents";

export type AgentRow = {
  id: string;
  label: string;
  source: string;
  wallets: string[];
  bio: string | null;
  links: Record<string, string>;
  active: boolean;
};

export async function listActiveAgents(): Promise<AgentRow[]> {
  const { rows } = await db().query<AgentRow>(
    `SELECT id, label, source, wallets, bio, links, active
       FROM agents
      WHERE active = TRUE
      ORDER BY id ASC`,
  );
  return rows;
}

export async function getAgentByWallet(wallet: string): Promise<AgentRow | null> {
  const { rows } = await db().query<AgentRow>(
    `SELECT id, label, source, wallets, bio, links, active
       FROM agents
      WHERE $1 = ANY(wallets) AND active = TRUE
      LIMIT 1`,
    [wallet],
  );
  return rows[0] ?? null;
}

export async function upsertAgent(a: SeedAgent): Promise<void> {
  await db().query(
    `INSERT INTO agents (id, label, source, wallets, bio, links)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       label = EXCLUDED.label,
       source = EXCLUDED.source,
       wallets = EXCLUDED.wallets,
       bio = EXCLUDED.bio,
       links = EXCLUDED.links`,
    [a.id, a.label, a.source, a.wallets, a.bio, JSON.stringify(a.links)],
  );
}
```

- [ ] **Step 3: Build the seed script**

Create `scripts/seed.ts`:

```ts
import { CURATED_AGENTS } from "@/data/curated-agents";
import { upsertAgent } from "@/lib/db/agents";

async function main() {
  for (const agent of CURATED_AGENTS) {
    await upsertAgent(agent);
    console.log(`✓ ${agent.id}`);
  }
  console.log(`seeded ${CURATED_AGENTS.length} agent(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add seed script to package.json**

In `package.json`, add to `"scripts"`:

```json
"seed": "tsx --env-file=.env.local scripts/seed.ts"
```

Install tsx:

```bash
npm install --save-dev tsx
```

- [ ] **Step 5: Run the seed**

```bash
npm run seed
```

Expected: `✓ pellet` printed, then `seeded 1 agent(s)`. (Other agents will be added during the research pass before deploy.)

- [ ] **Step 6: Verify seeded data**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "SELECT id, label, source FROM agents;"
```

Expected: Single row for `pellet`.

- [ ] **Step 7: Commit**

```bash
git add data/ lib/db/agents.ts scripts/ package.json package-lock.json
git commit -m "seed curated agent list (pellet only; research pass to follow)"
```

---

## Phase D — Ingestion (TDD)

### Task 8: Set up Vitest and write the normalize test

**Files:**
- Create: `vitest.config.ts`, `lib/helius/types.ts`, `lib/ingest/normalize.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest @vitest/ui
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` "scripts":

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Define minimal Helius webhook payload types**

Create `lib/helius/types.ts`:

```ts
// Subset of the Helius Enhanced Webhook payload we actually consume.
// Source: https://docs.helius.dev/api-reference/webhooks
export type HeliusEnhancedTx = {
  signature: string;
  timestamp: number; // unix seconds
  type: string; // e.g. "SWAP", "TRANSFER", "UNKNOWN"
  source?: string; // e.g. "JUPITER", "SYSTEM_PROGRAM"
  description?: string;
  feePayer: string;
  accountData?: Array<{ account: string; nativeBalanceChange: number }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number; // lamports
  }>;
};
```

- [ ] **Step 5: Write the failing test for normalize**

Create `lib/ingest/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";
import type { HeliusEnhancedTx } from "../helius/types";

const swapTx: HeliusEnhancedTx = {
  signature: "5kF2aBcDef1234567890abcdEf1234567890aB91",
  timestamp: 1714435200,
  type: "SWAP",
  source: "JUPITER",
  feePayer: "AGENT_WALLET_AIXBT",
  description: "AIXBT_WALLET swapped 3.2 SOL for 12400 WIF",
  tokenTransfers: [
    { fromUserAccount: "AGENT_WALLET_AIXBT", toUserAccount: "JUP", tokenAmount: 3.2, mint: "So11111111111111111111111111111111111111112" },
    { fromUserAccount: "JUP", toUserAccount: "AGENT_WALLET_AIXBT", tokenAmount: 12400, mint: "WIFmint11111111111111111111111111111111111111" },
  ],
};

describe("normalize", () => {
  it("maps a Helius SWAP into a feed event for the matched agent", () => {
    const event = normalize(swapTx, { id: "aixbt", label: "aixbt", wallets: ["AGENT_WALLET_AIXBT"] });
    expect(event).toEqual({
      agent_id: "aixbt",
      ts: new Date(1714435200 * 1000),
      kind: "swap",
      summary: "aixbt swapped 3.2 SOL for 12400 WIF",
      targets: { source: "JUPITER" },
      tx_sig: "5kF2aBcDef1234567890abcdEf1234567890aB91",
      raw: swapTx,
    });
  });

  it("returns null when no agent wallet matches the fee payer", () => {
    const event = normalize(swapTx, { id: "other", label: "other", wallets: ["UNRELATED_WALLET"] });
    expect(event).toBeNull();
  });

  it("falls back to a generic summary when no description is provided", () => {
    const tx: HeliusEnhancedTx = { ...swapTx, description: undefined };
    const event = normalize(tx, { id: "aixbt", label: "aixbt", wallets: ["AGENT_WALLET_AIXBT"] });
    expect(event?.summary).toBe("aixbt did SWAP via JUPITER");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npm test
```

Expected: All three tests fail with "Cannot find module './normalize'" or similar.

- [ ] **Step 7: Commit the failing test**

```bash
git add lib/helius/ lib/ingest/normalize.test.ts vitest.config.ts package.json package-lock.json
git commit -m "set up vitest + write failing normalize tests"
```

---

### Task 9: Implement normalize to make the test pass

**Files:**
- Create: `lib/ingest/normalize.ts`

- [ ] **Step 1: Implement normalize**

Create `lib/ingest/normalize.ts`:

```ts
import type { HeliusEnhancedTx } from "../helius/types";

export type NormalizedEvent = {
  agent_id: string;
  ts: Date;
  kind: string;
  summary: string;
  targets: Record<string, unknown>;
  tx_sig: string;
  raw: HeliusEnhancedTx;
};

type AgentLite = { id: string; label: string; wallets: string[] };

const KIND_MAP: Record<string, string> = {
  SWAP: "swap",
  TRANSFER: "transfer",
  TOKEN_MINT: "mint",
  NFT_MINT: "mint",
  UNKNOWN: "program_call",
};

export function normalize(tx: HeliusEnhancedTx, agent: AgentLite): NormalizedEvent | null {
  // Match by fee payer OR any wallet appearing in transfers.
  const wallets = new Set(agent.wallets);
  const involved =
    wallets.has(tx.feePayer) ||
    tx.tokenTransfers?.some((t) => wallets.has(t.fromUserAccount) || wallets.has(t.toUserAccount)) ||
    tx.nativeTransfers?.some((t) => wallets.has(t.fromUserAccount) || wallets.has(t.toUserAccount));

  if (!involved) return null;

  const kind = KIND_MAP[tx.type] ?? "custom";
  const summary = buildSummary(tx, agent);

  return {
    agent_id: agent.id,
    ts: new Date(tx.timestamp * 1000),
    kind,
    summary,
    targets: { source: tx.source ?? "unknown" },
    tx_sig: tx.signature,
    raw: tx,
  };
}

function buildSummary(tx: HeliusEnhancedTx, agent: AgentLite): string {
  if (tx.description) {
    // Replace any wallet address mentions with the agent label.
    let s = tx.description;
    for (const w of agent.wallets) {
      s = s.split(w).join(agent.label);
    }
    return s;
  }
  return `${agent.label} did ${tx.type}${tx.source ? ` via ${tx.source}` : ""}`;
}
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
npm test
```

Expected: All three tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/ingest/normalize.ts
git commit -m "implement normalize: map helius tx to feed event"
```

---

### Task 10: Idempotent insert (TDD)

**Files:**
- Create: `lib/db/events.ts`, `lib/ingest/insert.ts`, `lib/ingest/insert.test.ts`

- [ ] **Step 1: Build the events query module**

Create `lib/db/events.ts`:

```ts
import { db } from "./client";
import type { NormalizedEvent } from "../ingest/normalize";

export type EventRow = {
  id: string;
  agent_id: string;
  ts: string;
  kind: string;
  summary: string;
  tx_sig: string | null;
};

export async function insertEvent(e: NormalizedEvent): Promise<{ inserted: boolean; id: string | null }> {
  const { rows } = await db().query<{ id: string }>(
    `INSERT INTO events (agent_id, ts, kind, summary, targets, tx_sig, raw)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
     ON CONFLICT (tx_sig, agent_id, kind) DO NOTHING
     RETURNING id::text`,
    [e.agent_id, e.ts.toISOString(), e.kind, e.summary, JSON.stringify(e.targets), e.tx_sig, JSON.stringify(e.raw)],
  );
  return { inserted: rows.length > 0, id: rows[0]?.id ?? null };
}

export async function recentEvents(limit = 100): Promise<EventRow[]> {
  const { rows } = await db().query<EventRow>(
    `SELECT id::text, agent_id, ts, kind, summary, tx_sig
       FROM events
      ORDER BY ts DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const { rows } = await db().query<EventRow>(
    `SELECT id::text, agent_id, ts, kind, summary, tx_sig
       FROM events
      WHERE id = $1::bigint
      LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Write the failing idempotency test**

Create `lib/ingest/insert.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { ingestOne } from "./insert";
import { db } from "../db/client";
import { upsertAgent } from "../db/agents";

const TEST_AGENT = {
  id: "test-agent",
  label: "test-agent",
  source: "curated" as const,
  wallets: ["TEST_WALLET_ABCDEF"],
  bio: "test fixture",
  links: {},
};

const TEST_TX = {
  signature: "TEST_SIG_idempotent_001",
  timestamp: 1714435200,
  type: "SWAP",
  source: "JUPITER",
  feePayer: "TEST_WALLET_ABCDEF",
  description: "test swap",
};

describe("ingestOne (idempotency)", () => {
  beforeAll(async () => {
    await upsertAgent(TEST_AGENT);
  });

  afterAll(async () => {
    await db().query(`DELETE FROM events WHERE tx_sig = $1`, [TEST_TX.signature]);
    await db().query(`DELETE FROM agents WHERE id = $1`, [TEST_AGENT.id]);
    await db().end();
  });

  it("inserts a new event on first call", async () => {
    const result = await ingestOne(TEST_TX, [TEST_AGENT]);
    expect(result.inserted).toBe(1);
  });

  it("does not insert a duplicate on second call", async () => {
    const result = await ingestOne(TEST_TX, [TEST_AGENT]);
    expect(result.inserted).toBe(0);
  });

  it("returns matched=0 when no agent wallet matches", async () => {
    const tx = { ...TEST_TX, signature: "TEST_SIG_unmatched_001", feePayer: "UNRELATED" };
    const result = await ingestOne(tx, [TEST_AGENT]);
    expect(result.matched).toBe(0);
    expect(result.inserted).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npm test
```

Expected: Tests fail with "Cannot find module './insert'".

- [ ] **Step 4: Implement ingestOne**

Create `lib/ingest/insert.ts`:

```ts
import type { HeliusEnhancedTx } from "../helius/types";
import type { AgentRow } from "../db/agents";
import { normalize } from "./normalize";
import { insertEvent } from "../db/events";

type Result = { matched: number; inserted: number };

// Take a single Helius tx and a set of candidate agents; insert one event per
// matching agent (idempotent on tx_sig + agent_id + kind).
export async function ingestOne(tx: HeliusEnhancedTx, agents: Array<Pick<AgentRow, "id" | "label" | "wallets">>): Promise<Result> {
  let matched = 0;
  let inserted = 0;
  for (const agent of agents) {
    const event = normalize(tx, agent);
    if (!event) continue;
    matched += 1;
    const r = await insertEvent(event);
    if (r.inserted) inserted += 1;
  }
  return { matched, inserted };
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test
```

Expected: All idempotency tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/db/events.ts lib/ingest/insert.ts lib/ingest/insert.test.ts
git commit -m "implement idempotent event ingest with tests"
```

---

## Phase E — API routes

### Task 11: GET /api/agents

**Files:**
- Create: `app/api/agents/route.ts`

- [ ] **Step 1: Build the route**

Create `app/api/agents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listActiveAgents } from "@/lib/db/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await listActiveAgents();
  return NextResponse.json({ agents });
}
```

- [ ] **Step 2: Verify**

```bash
npm run dev
```

In a second terminal:

```bash
curl -s http://localhost:3000/api/agents | head -c 500
```

Expected: JSON `{"agents":[{"id":"pellet",...}]}`. Stop server.

- [ ] **Step 3: Commit**

```bash
git add app/api/agents/route.ts
git commit -m "add GET /api/agents"
```

---

### Task 12: POST /api/ingest/webhook (Helius receiver)

**Files:**
- Create: `app/api/ingest/webhook/route.ts`

- [ ] **Step 1: Build the receiver**

Create `app/api/ingest/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listActiveAgents } from "@/lib/db/agents";
import { ingestOne } from "@/lib/ingest/insert";
import type { HeliusEnhancedTx } from "@/lib/helius/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  // Helius webhooks support an Authorization header set to the configured secret.
  const auth = req.headers.get("authorization");
  if (!process.env.HELIUS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  if (auth !== process.env.HELIUS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as HeliusEnhancedTx[];
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array body" }, { status: 400 });
  }

  const agents = await listActiveAgents();
  const lite = agents.map((a) => ({ id: a.id, label: a.label, wallets: a.wallets }));

  let totalMatched = 0;
  let totalInserted = 0;
  for (const tx of body) {
    const r = await ingestOne(tx, lite);
    totalMatched += r.matched;
    totalInserted += r.inserted;
  }

  return NextResponse.json({ ok: true, txs: body.length, matched: totalMatched, inserted: totalInserted });
}
```

- [ ] **Step 2: Verify with a synthetic POST**

```bash
npm run dev
```

In a second terminal, set the secret in your shell and POST a test payload:

```bash
source .env.local
# If HELIUS_WEBHOOK_SECRET isn't in .env.local yet, set a placeholder for now:
export HELIUS_WEBHOOK_SECRET="${HELIUS_WEBHOOK_SECRET:-test-secret-local-only}"

curl -s -X POST http://localhost:3000/api/ingest/webhook \
  -H "authorization: $HELIUS_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '[{"signature":"manual_test_001","timestamp":'$(date +%s)',"type":"SWAP","source":"JUPITER","feePayer":"TEST"}]'
```

Expected: `{"ok":true,"txs":1,"matched":0,"inserted":0}` (matched=0 because no agent has wallet "TEST"). Stop server.

You will configure the real `HELIUS_WEBHOOK_SECRET` in Vercel env vars during the deploy task.

- [ ] **Step 3: Commit**

```bash
git add app/api/ingest/webhook/route.ts
git commit -m "add POST /api/ingest/webhook (helius receiver)"
```

---

## Phase F — Realtime

### Task 13: Realtime event bus

**Files:**
- Create: `lib/realtime/bus.ts`

- [ ] **Step 1: Build the bus**

Create `lib/realtime/bus.ts`:

```ts
import { EventEmitter } from "node:events";
import { listenDb } from "../db/client";
import { getEventById, type EventRow } from "../db/events";

// Single in-process bus. SSE handlers subscribe; the pg LISTEN connection
// fires when the trigger fires, we resolve the row, emit to subscribers.
class Bus extends EventEmitter {
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    const pool = listenDb();
    const client = await pool.connect();
    client.on("notification", async (msg) => {
      if (msg.channel !== "events" || !msg.payload) return;
      const row = await getEventById(msg.payload);
      if (row) this.emit("event", row);
    });
    await client.query("LISTEN events");
    // Hold the connection open for the process lifetime.
  }
}

const _bus = new Bus();

export function bus(): Bus {
  return _bus;
}

export type { EventRow };
```

- [ ] **Step 2: Commit**

```bash
git add lib/realtime/bus.ts
git commit -m "add realtime bus over postgres LISTEN/NOTIFY"
```

---

### Task 14: GET /api/feed (SSE)

**Files:**
- Create: `app/api/feed/route.ts`

- [ ] **Step 1: Build the SSE route**

Create `app/api/feed/route.ts`:

```ts
import { listActiveAgents } from "@/lib/db/agents";
import { recentEvents } from "@/lib/db/events";
import { bus, type EventRow } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedEvent = {
  id: string;
  agentId: string;
  agentLabel: string;
  ts: string;
  kind: string;
  summary: string;
  txSig: string | null;
  isPellet: boolean;
};

export async function GET() {
  await bus().start();

  const agents = await listActiveAgents();
  const labelById = new Map(agents.map((a) => [a.id, a.label]));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: FeedEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial paint: last 100 events (oldest first so client appends in order).
      const recent = await recentEvents(100);
      for (const r of recent.reverse()) send(toFeedEvent(r, labelById));

      const onEvent = (row: EventRow) => send(toFeedEvent(row, labelById));
      bus().on("event", onEvent);

      // Heartbeat every 25s to keep the connection alive through proxies.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 25_000);

      // Cleanup when client disconnects.
      const abort = () => {
        clearInterval(heartbeat);
        bus().off("event", onEvent);
        try { controller.close(); } catch {}
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (controller as any).signal?.addEventListener?.("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

function toFeedEvent(r: EventRow, labels: Map<string, string>): FeedEvent {
  return {
    id: r.id,
    agentId: r.agent_id,
    agentLabel: labels.get(r.agent_id) ?? r.agent_id,
    ts: r.ts,
    kind: r.kind,
    summary: r.summary,
    txSig: r.tx_sig,
    isPellet: r.agent_id === "pellet",
  };
}
```

- [ ] **Step 2: Verify with curl**

```bash
npm run dev
```

In a second terminal:

```bash
curl -N http://localhost:3000/api/feed | head -c 500
```

Expected: `data: {...}` lines for any seeded events, then connection stays open. Ctrl+C to stop. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add app/api/feed/route.ts
git commit -m "add GET /api/feed (SSE stream)"
```

---

## Phase G — Wire the UI to live data

### Task 15: Convert Feed into a live SSE consumer

**Files:**
- Create: `components/feed.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Build the live feed client component**

Create `components/feed.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { EventCard, type FeedEvent } from "./event-card";
import { glyphs } from "@/lib/design/glyphs";

const MAX_EVENTS = 500;

type ConnectionState = "connecting" | "live" | "error";

export function Feed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [conn, setConn] = useState<ConnectionState>("connecting");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/feed");

    es.onopen = () => setConn("live");
    es.onerror = () => setConn("error");
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as FeedEvent;
        if (seen.current.has(event.id)) return;
        seen.current.add(event.id);
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // ignore malformed payloads
      }
    };

    return () => {
      es.close();
    };
  }, []);

  if (conn === "connecting" && events.length === 0) {
    return <LoadingPulse />;
  }

  if (events.length === 0) {
    return (
      <p className="text-muted text-sm">
        no events yet · waiting for agents
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {conn === "error" && (
        <p className="text-accent text-xs">
          feed disconnected · retrying...
        </p>
      )}
      {events.map((e) => (
        <div key={e.id} className="animate-[slide-in_200ms_ease-out]">
          <EventCard event={e} />
        </div>
      ))}
    </div>
  );
}

function LoadingPulse() {
  return (
    <div className="text-muted py-12 text-center text-sm">
      <span className="animate-pulse">{glyphs.loadingFilled.repeat(5)}</span>
      <p className="mt-2">syncing feed</p>
    </div>
  );
}
```

- [ ] **Step 2: Add the slide-in animation to globals.css**

Append to `app/globals.css`:

```css
@layer utilities {
  @keyframes slide-in {
    from { transform: translateY(-4px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
}
```

- [ ] **Step 3: Replace the static sample with the live Feed in page.tsx**

Replace `app/page.tsx` with:

```tsx
import { Header } from "@/components/header";
import { Feed } from "@/components/feed";
import { listActiveAgents } from "@/lib/db/agents";

export const dynamic = "force-dynamic";

export default async function Page() {
  const agents = await listActiveAgents();
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={agents.length} />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Feed />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: End-to-end smoke check (manual)**

```bash
npm run dev
```

1. Open `http://localhost:3000` — see "no events yet" or last seeded events.
2. In a second terminal, post a fake event (replace `pellet` with the real seeded agent id):

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c \
  "INSERT INTO events (agent_id, ts, kind, summary, tx_sig) VALUES ('pellet', now(), 'custom', 'manual smoke event from psql', NULL);"
```

3. Confirm: card slides in at the top of the feed within ~1 second. Stop server.

- [ ] **Step 5: Commit**

```bash
git add components/feed.tsx app/page.tsx app/globals.css
git commit -m "wire live SSE feed to the home page"
```

---

## Phase H — Pellet's own agent loop (minimal)

### Task 16: Hourly Pellet observation cron

**Files:**
- Create: `app/api/cron/pellet-tick/route.ts`, `vercel.json`

- [ ] **Step 1: Build the cron handler**

Create `app/api/cron/pellet-tick/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
function authorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Count active agents and events in the last hour.
  const { rows: a } = await db().query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM agents WHERE active = TRUE`);
  const { rows: e } = await db().query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM events WHERE ts > now() - interval '1 hour'`);

  const summary = `noted: ${a[0].n} agents tracked · ${e[0].n} events in the last hour`;

  await db().query(
    `INSERT INTO events (agent_id, ts, kind, summary, tx_sig)
     VALUES ('pellet', now(), 'custom', $1, NULL)
     ON CONFLICT DO NOTHING`,
    [summary],
  );

  return NextResponse.json({ ok: true, summary });
}
```

- [ ] **Step 2: Configure the cron schedule**

Create `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/pellet-tick", "schedule": "0 * * * *" }
  ]
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

In a second terminal:

```bash
source .env.local
export CRON_SECRET="${CRON_SECRET:-test-cron-secret-local}"
curl -s "http://localhost:3000/api/cron/pellet-tick" \
  -H "authorization: Bearer $CRON_SECRET"
```

Expected: `{"ok":true,"summary":"noted: 1 agents tracked · ... events in the last hour"}`. Refresh `localhost:3000` — Pellet's observation should appear in the feed. Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/pellet-tick/route.ts vercel.json
git commit -m "add hourly pellet observation cron"
```

---

## Phase I — Smoke test

### Task 17: Playwright E2E happy path

**Files:**
- Create: `playwright.config.ts`, `tests/feed.e2e.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Playwright**

```bash
npm init playwright@latest -- --quiet --browser=chromium --no-examples
```

If interactive: pick TypeScript, no GitHub Actions, install browsers.

- [ ] **Step 2: Configure for local dev server**

Replace `playwright.config.ts` with:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.spec\.ts/,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Add e2e script to package.json**

In `package.json` "scripts":

```json
"e2e": "playwright test"
```

- [ ] **Step 4: Write the smoke test**

Create `tests/feed.e2e.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("home renders header + feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header")).toContainText("pellet");
  await expect(page.locator("header")).toContainText("agentics terminal");
  await expect(page.locator("header")).toContainText("agents · live");
});

test("favicon route renders", async ({ request }) => {
  const res = await request.get("/icon");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("agents api returns json", async ({ request }) => {
  const res = await request.get("/api/agents");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.agents)).toBe(true);
});
```

- [ ] **Step 5: Run the smoke test**

```bash
npm run e2e
```

Expected: 3 tests pass. (The dev server boots automatically and tears down after.)

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/ package.json package-lock.json
git commit -m "add playwright smoke tests"
```

---

## Phase J — Deploy

### Task 18: Vercel deploy + domain

**Files:** none (env + Vercel config)

- [ ] **Step 1: Generate strong secrets for prod**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Run twice — once for `HELIUS_WEBHOOK_SECRET`, once for `CRON_SECRET`. Save to a password manager.

- [ ] **Step 2: Set env vars on Vercel**

```bash
npx vercel env add HELIUS_WEBHOOK_SECRET production
# paste the secret when prompted

npx vercel env add CRON_SECRET production
# paste the second secret when prompted
```

(The `POSTGRES_*` vars were auto-provisioned in Task 6.)

- [ ] **Step 3: Sign up for Helius and configure a webhook**

Go to `https://dashboard.helius.dev`. Create a project. In the API key panel, copy the key.

```bash
npx vercel env add HELIUS_API_KEY production
# paste the api key
```

In Helius's webhook UI, create an Enhanced Webhook:
- URL: `https://pellet.network/api/ingest/webhook` (will be live after domain attaches; for now use the Vercel preview URL)
- Auth header: `Authorization: <your HELIUS_WEBHOOK_SECRET>`
- Account addresses: leave EMPTY for now — fill in during the agent research pass when wallets are known.

- [ ] **Step 4: Deploy a preview**

```bash
npx vercel
```

Expected: Preview URL printed. Visit it — confirm header renders, `/api/agents` returns the seeded `pellet` agent, `/api/feed` streams.

- [ ] **Step 5: Run schema migration on prod DB**

The Neon prod DB is a separate branch from your dev db (Vercel auto-creates one per environment). Pull prod env and apply schema:

```bash
npx vercel env pull .env.production --environment=production
source .env.production && psql "$POSTGRES_URL_NON_POOLING" -f lib/db/schema.sql
```

Then seed the prod DB:

```bash
source .env.production && npx tsx scripts/seed.ts
```

- [ ] **Step 6: Promote to production**

```bash
npx vercel --prod
```

Expected: Production deploy URL printed. Visit it — confirm same as preview.

- [ ] **Step 7: Attach pellet.network domain**

```bash
npx vercel domains add pellet.network
```

Follow the printed DNS instructions at your registrar. Once propagation completes (usually <10 min):

```bash
npx vercel alias set <prod-deploy-url> pellet.network
```

Verify: `https://pellet.network` loads.

- [ ] **Step 8: Final smoke check on prod**

In a browser, visit `https://pellet.network`. In a terminal:

```bash
curl -s https://pellet.network/api/agents
```

Expected: JSON with the `pellet` agent.

Trigger a Pellet tick to confirm the cron path:

```bash
source .env.production
curl -s "https://pellet.network/api/cron/pellet-tick" \
  -H "authorization: Bearer $CRON_SECRET"
```

Expected: `{"ok":true,...}`. Refresh `https://pellet.network` — Pellet's observation appears.

- [ ] **Step 9: Commit any remaining config**

```bash
git status
# If .vercel/ or other auto-generated files appeared: they're gitignored, no commit needed.
git add -A
git diff --cached --stat
# If nothing staged, skip the commit. Otherwise:
git commit -m "deploy config + domain attached"
```

---

## Post-launch: open work tracked in spec §12

Tasks deferred from this plan (resolve as separate work after v0 ships):

- **Curated agent research pass** — fill `data/curated-agents.ts` with the remaining ~11 agents and their wallets, re-run `npm run seed`, update Helius webhook account list.
- **Event-kind taxonomy lock** — review the `kind` values seen in production for one week, freeze the v0 enum, document in spec.
- **OG share images per event** — only if a share-this-event flow is added.
- **Rate limiting / throttling** — only if any single agent generates >10 events/sec sustained.
- **Network graph view (v0.5)** — separate plan.
- **Per-agent profile pages (v0.5)** — separate plan.

---

## Self-review

Coverage check vs. spec:
- §3 v0 scope (feed, ~12 agents, registries+allowlist, mobile+desktop, no auth) → Tasks 1–17 cover; the curated list is seeded with `pellet` only and explicitly tracked as a research-pass task.
- §5 architecture (Next.js + Vercel + Postgres + Helius + SSE) → Tasks 1, 6, 12, 14 cover.
- §6 data model (agents, events, indexes, idempotency unique constraint, notify trigger) → Task 6.
- §7 components (feed, event card, header, mobile responsive, empty/loading/error) → Tasks 4, 5, 15.
- §8 aesthetic (mono colors, Geist Mono, glyphs, motion, layout) → Tasks 2, 5, 15.
- §9 Pellet-the-mascot → Tasks 3, 7 (seed), 16 (loop).
- §10 stack → all tasks.
- §11 v0 row of roadmap → all tasks.
- §13 non-goals → respected (no auth, no trading, no on-chain token, no separate mobile app).

Placeholder scan: no TBD/TODO/"add appropriate X" patterns remain. The curated agent list is acknowledged as needing a research pass — that's surfaced explicitly in Task 7 step 1, in §12 of the spec, and in the post-launch section above.

Type consistency: `FeedEvent` shape used in `event-card.tsx`, `feed.tsx`, and `app/api/feed/route.ts` matches; `NormalizedEvent` flows through `normalize.ts` → `events.ts` → `insert.ts` consistently; `AgentRow` used the same way across `agents.ts`, `webhook/route.ts`, `feed/route.ts`.
