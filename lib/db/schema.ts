import { pgTable, text, serial, integer, bigint, numeric, timestamp, jsonb, primaryKey, index } from "drizzle-orm/pg-core";

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

// ── Ingestion foundation ────────────────────────────────────────────────────

// Raw chain events — idempotent by (txHash, logIndex).
// Covers TIP-20 events (Transfer, Mint, Burn, RoleGranted, etc.) and
// TIP-403 events (PolicyAdded, PolicyRemoved, PolicyUpdated).
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
    typeBlockIdx: index("events_type_block_idx").on(t.eventType, t.blockNumber),
  }),
);

// Per-block peg price samples — one row per stable per sampled block.
export const pegSamples = pgTable(
  "peg_samples",
  {
    id: serial("id").primaryKey(),
    stable: text("stable").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
    priceVsPathusd: numeric("price_vs_pathusd").notNull(),
    spreadBps: numeric("spread_bps").notNull(),
  },
  (t) => ({
    stableTimeIdx: index("peg_samples_stable_time_idx").on(t.stable, t.sampledAt),
  }),
);

// Ingestion cursor — tracks last processed block per contract.
// Separate row for peg sampler ("__peg_sampler__") and one per stable contract.
export const ingestionCursors = pgTable("ingestion_cursors", {
  contract: text("contract").primaryKey(),
  lastBlock: bigint("last_block", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Rolling peg aggregates — computed from peg_samples on a cron cadence.
// One row per (stable, window_label). Updated in place.
export const pegAggregates = pgTable(
  "peg_aggregates",
  {
    stable: text("stable").notNull(),
    windowLabel: text("window_label").notNull(), // '1h' | '24h' | '7d'
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    sampleCount: integer("sample_count").notNull(),
    meanPrice: numeric("mean_price").notNull(),
    stddevPrice: numeric("stddev_price").notNull(),
    minPrice: numeric("min_price").notNull(),
    maxPrice: numeric("max_price").notNull(),
    maxDeviationBps: numeric("max_deviation_bps").notNull(),
    secondsOutside10bps: integer("seconds_outside_10bps").notNull(),
    secondsOutside50bps: integer("seconds_outside_50bps").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.stable, t.windowLabel] }),
  }),
);
