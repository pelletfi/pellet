import {
  pgTable,
  text,
  serial,
  integer,
  bigint,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ── Raw chain events (port from archive 0001_ingestion_foundation.sql) ────
// Idempotent by (tx_hash, log_index). Emitted by every contract Pellet watches.
export const events = pgTable(
  "events",
  {
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockTimestamp: timestamp("block_timestamp", { withTimezone: true }).notNull(),
    contract: text("contract").notNull(),
    eventType: text("event_type").notNull(),
    args: jsonb("args").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.txHash, t.logIndex] }),
    contractBlockIdx: index("events_contract_block_idx").on(t.contract, t.blockNumber),
    blockTimestampIdx: index("events_block_timestamp_idx").on(t.blockTimestamp),
  }),
);

// ── Ingestion cursors (port from archive 0001) ────────────────────────────
export const ingestionCursors = pgTable("ingestion_cursors", {
  contract: text("contract").primaryKey(),
  lastBlock: bigint("last_block", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Cron runs log (port from archive 0008_cron_runs.sql) ──────────────────
export const cronRuns = pgTable(
  "cron_runs",
  {
    id: serial("id").primaryKey(),
    cronName: text("cron_name").notNull(),
    status: text("status").notNull(), // 'ok' | 'error'
    durationMs: integer("duration_ms").notNull(),
    detail: jsonb("detail"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    nameStartedIdx: index("cron_runs_name_started_idx").on(t.cronName, t.startedAt),
  }),
);

// ── Address labels (port from archive 0009_address_labels.sql) ────────────
export const addressLabels = pgTable(
  "address_labels",
  {
    address: text("address").primaryKey(), // lowercased
    label: text("label").notNull(),
    category: text("category").notNull(), // 'agent' | 'contract' | 'token' | etc.
    source: text("source").notNull(),     // 'curated' | 'pellet' | etc.
    notes: jsonb("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("address_labels_category_idx").on(t.category),
  }),
);

// ── Agents (new — v2) ─────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // slug ('pellet', 'aixbt-tempo', etc.)
  label: text("label").notNull(),
  source: text("source").notNull(), // 'curated' | 'pellet' | 'registry:*'
  wallets: text("wallets").array().notNull().default([]),
  bio: text("bio"),
  links: jsonb("links").notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Agent events (new — v2) ───────────────────────────────────────────────
// Joins raw events to agents with a human-legible summary + OLI provenance.
// One row per (event, agent) match — same event can match multiple agents.
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
    // NEW (T10): underlying service provider address recovered from the gateway's
    // Settlement event. Populated by lib/ingest/gateway-attribution.ts during
    // a separate enrichment cron, only for rows where agent_id='tempo-gateway-mpp'.
    routedToAddress: text("routed_to_address"),
    // NEW (T10.5): Pattern B fingerprint. For user→gateway calldata path
    // (selector 0x95777d59), the bytes32 ref's bytes 5-14 are a stable per-
    // service fingerprint. Captured even when the provider address can't be
    // recovered, so we can group txs by service even pre-labeling.
    routedFingerprint: text("routed_fingerprint"),
    sourceBlock: bigint("source_block", { mode: "number" }).notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tsIdx: index("agent_events_ts_idx").on(t.ts),
    agentTsIdx: index("agent_events_agent_ts_idx").on(t.agentId, t.ts),
    eventRefIdx: index("agent_events_event_ref_idx").on(t.txHash, t.logIndex),
    counterpartyIdx: index("agent_events_counterparty_idx").on(t.counterpartyAddress),
    routedToIdx: index("agent_events_routed_to_idx").on(t.routedToAddress),
    routedFpIdx: index("agent_events_routed_fp_idx").on(t.routedFingerprint),
  }),
);
