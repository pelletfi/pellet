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

// Current role holders per stable — rebuilt from RoleGranted / RoleRevoked
// events on each cron tick. Not authoritative history; point-in-time current state.
export const roleHolders = pgTable(
  "role_holders",
  {
    stable: text("stable").notNull(),
    roleHash: text("role_hash").notNull(), // bytes32 as hex
    roleName: text("role_name").notNull(), // decoded, e.g. "MINTER_ROLE" or "0xabc..." if unknown
    holder: text("holder").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    grantedTxHash: text("granted_tx_hash").notNull(),
    holderType: text("holder_type"), // 'eoa' | 'contract' | null if unresolved
    label: text("label"), // human-readable label if known
  },
  (t) => ({
    pk: primaryKey({ columns: [t.stable, t.roleHash, t.holder] }),
    stableIdx: index("role_holders_stable_idx").on(t.stable),
  }),
);

// Webhook subscriptions. Keyed by opaque id; secret used for HMAC signing.
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: text("id").primaryKey(),
  label: text("label"),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  eventTypes: text("event_types").array().notNull(), // e.g. ['peg_break.started','peg_break.ended']
  stableFilter: text("stable_filter").array(), // null = all stables; else list of lowercased addresses
  active: text("active").notNull().default("true"), // text because boolean inserts via raw sql were painful
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
});

// Individual delivery attempts. Worker cron picks these up in FIFO order.
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    subscriptionId: text("subscription_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"), // pending | delivered | failed
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("webhook_deliveries_status_next_attempt_idx").on(t.status, t.nextAttemptAt),
  }),
);

// Peg-break events — detected from peg_samples.
// A continuous period where spread_bps > threshold, classified by severity:
//   'mild'   — spread > 10bps sustained for >= 5 minutes
//   'severe' — spread > 50bps sustained for >= 1 minute
// If ended_at is null the event is ongoing at detector last-run time.
export const pegEvents = pgTable(
  "peg_events",
  {
    id: serial("id").primaryKey(),
    stable: text("stable").notNull(),
    severity: text("severity").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    maxDeviationBps: numeric("max_deviation_bps").notNull(),
    startedBlock: bigint("started_block", { mode: "number" }).notNull(),
    endedBlock: bigint("ended_block", { mode: "number" }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    stableTimeIdx: index("peg_events_stable_time_idx").on(t.stable, t.startedAt),
  }),
);

// Composite risk score per stable. One row per stable, updated in place.
// Components is a JSONB with explainable breakdown (peg_risk, supply_risk, etc.)
export const riskScores = pgTable("risk_scores", {
  stable: text("stable").primaryKey(),
  composite: numeric("composite").notNull(), // 0-100, higher = more risk
  components: jsonb("components").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

// Reserve / backing data per stable. Manually curated initially; later via issuer APIs.
// One row per (stable, reserve_type) tuple so we can record multiple reserve components.
export const reserves = pgTable(
  "reserves",
  {
    stable: text("stable").notNull(),
    reserveType: text("reserve_type").notNull(), // 'protocol_native' | 'fiat' | 'crypto' | 'treasury'
    backingUsd: numeric("backing_usd"), // null = unknown
    attestationSource: text("attestation_source"), // URL or label
    attestedAt: timestamp("attested_at", { withTimezone: true }),
    verifiedBy: text("verified_by"), // 'pellet' | 'issuer_api' | 'manual'
    notes: jsonb("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.stable, t.reserveType] }),
  }),
);

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
