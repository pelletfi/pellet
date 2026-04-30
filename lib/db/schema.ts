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
  uniqueIndex,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// bytea — Drizzle doesn't ship a built-in bytea type yet; declare one.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

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

// ── Pellet Wallet · Phase 1 (Path B: self-custody, passkey-rooted) ────────
// Schema only. No signing logic in this commit. See drizzle/0004_wallet_schema.sql.

export const walletUsers = pgTable(
  "wallet_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passkeyCredentialId: text("passkey_credential_id").notNull().unique(),
    passkeyPublicKey: bytea("passkey_public_key").notNull(),
    managedAddress: text("managed_address").notNull().unique(),
    displayName: text("display_name"),
    passkeySignCount: bigint("passkey_sign_count", { mode: "number" }).notNull().default(0),
    // Uncompressed P-256 public key (0x04 || x(32) || y(32)) for direct use
    // with viem/tempo Account.fromWebAuthnP256. Cached at enrollment time so
    // we don't re-decode COSE on every signing call. Backfilled lazily for
    // pre-3.B users via lib/wallet/tempo-account.ts.
    publicKeyUncompressed: text("public_key_uncompressed"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    managedAddressIdx: index("wallet_users_managed_address_idx").on(t.managedAddress),
  }),
);

export const walletSessions = pgTable(
  "wallet_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => walletUsers.id, { onDelete: "cascade" }),
    bearerTokenHash: text("bearer_token_hash").notNull().unique(),
    spendCapWei: text("spend_cap_wei").notNull(),
    spendUsedWei: text("spend_used_wei").notNull().default("0"),
    perCallCapWei: text("per_call_cap_wei").notNull(),
    recipientAllowlist: jsonb("recipient_allowlist"),
    // B2 mode session-key ciphertext (passkey-PRF-wrapped). NULL in B1 mode.
    sessionKeyCiphertext: bytea("session_key_ciphertext"),
    label: text("label"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // Phase 3.B: tx hash of the AccountKeychain.authorizeKey call that
    // granted this agent key on-chain spending authority. NULL until 3.B.2
    // wires the actual chain call.
    authorizeTxHash: text("authorize_tx_hash"),
    onChainAuthorizedAt: timestamp("on_chain_authorized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wallet_sessions_user_idx").on(t.userId),
    expiresIdx: index("wallet_sessions_expires_idx").on(t.expiresAt),
  }),
);

// Device-code pairing flow for the CLI. CLI starts a pairing → user approves
// in the browser → CLI polls + claims the bearer. See drizzle/0005.
export const walletDevicePairings = pgTable(
  "wallet_device_pairings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    deviceId: text("device_id").notNull().unique(),
    // 'pending' | 'approved' | 'claimed' | 'expired'
    status: text("status").notNull().default("pending"),
    bearerTokenHash: text("bearer_token_hash"),
    approvedUserId: uuid("approved_user_id").references(() => walletUsers.id, { onDelete: "set null" }),
    approvedSpendCapWei: text("approved_spend_cap_wei"),
    approvedPerCallCapWei: text("approved_per_call_cap_wei"),
    approvedSessionTtlSeconds: integer("approved_session_ttl_seconds"),
    agentLabel: text("agent_label"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("wallet_device_pairings_status_idx").on(t.status),
    expiresIdx: index("wallet_device_pairings_expires_idx").on(t.expiresAt),
  }),
);

export const walletSpendLog = pgTable(
  "wallet_spend_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => walletSessions.id, { onDelete: "restrict" }),
    userId: uuid("user_id").notNull().references(() => walletUsers.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id"),
    recipient: text("recipient").notNull(),
    amountWei: text("amount_wei").notNull(),
    txHash: text("tx_hash"),
    // 'pending' | 'signed' | 'submitted' | 'confirmed' | 'failed' | 'rejected'
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("wallet_spend_log_session_idx").on(t.sessionId, t.createdAt),
    userIdx: index("wallet_spend_log_user_idx").on(t.userId, t.createdAt),
    txIdx: index("wallet_spend_log_tx_idx").on(t.txHash),
  }),
);

// ── OLI Webhooks v1 ──────────────────────────────────────────────────────
// Subscriptions own a callback_url + signing_secret + filter spec. Every
// matching agent_events row produces a delivery row (idempotent via the
// (subscription_id, event_id) unique index). signing_secret is the raw hex
// used to HMAC the payload — exposed once on create and once on rotate;
// stored verbatim because we need it to sign on every dispatch.
//
// Status lifecycle:
//   pending_verify → active            (verify endpoint flips on token match)
//   active         → paused            (manual pause OR 410 Gone from callback)
//   active         → disabled_by_failures (5 consecutive non-2xx failures)
//   *              → deleted           (soft delete; cascade still applies on user delete)
export const oliWebhookSubscriptions = pgTable(
  "oli_webhook_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => walletUsers.id, { onDelete: "cascade" }),
    callbackUrl: text("callback_url").notNull(),
    // Raw hex secret — used for signing, NOT a hash. Surfaced once on create
    // and once on rotate; otherwise never returned over the API.
    signingSecret: text("signing_secret").notNull(),
    label: text("label"),
    filters: jsonb("filters").notNull().default({}),
    status: text("status").notNull().default("pending_verify"),
    verifyToken: text("verify_token"),
    verifyTokenExpiresAt: timestamp("verify_token_expires_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index("oli_webhook_subs_owner_idx").on(t.ownerUserId),
    statusIdx: index("oli_webhook_subs_status_idx").on(t.status),
    // Expression index lets dispatchToWebhooks short-list subscriptions by
    // the event's recipient without scanning the whole table.
    recipientIdx: index("oli_webhook_subs_recipient_idx").on(
      sql`(${t.filters} ->> 'recipient_address')`,
    ),
  }),
);

export const oliWebhookDeliveries = pgTable(
  "oli_webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => oliWebhookSubscriptions.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => agentEvents.id, { onDelete: "cascade" }),
    // Stable across retries — surfaced as the Pellet-Delivery header so
    // receivers can dedupe even before they index our (sub, event) pair.
    deliveryId: uuid("delivery_id").notNull().defaultRandom(),
    attemptCount: integer("attempt_count").notNull().default(0),
    // 'queued' | 'retry' | 'delivered' | 'dead'
    status: text("status").notNull().default("queued"),
    responseCode: integer("response_code"),
    responseBodyExcerpt: text("response_body_excerpt"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Hard idempotency: at most one delivery row per (subscription, event).
    // Both the bus path AND the inline match-runner path try to INSERT;
    // ON CONFLICT DO NOTHING + this index makes the double-call safe.
    subEventUq: uniqueIndex("oli_webhook_deliveries_sub_event_uq").on(
      t.subscriptionId,
      t.eventId,
    ),
    retryReadyIdx: index("oli_webhook_deliveries_retry_ready_idx").on(
      t.status,
      t.nextRetryAt,
    ),
    deliveryIdIdx: index("oli_webhook_deliveries_delivery_id_idx").on(t.deliveryId),
    subStatusIdx: index("oli_webhook_deliveries_sub_status_idx").on(
      t.subscriptionId,
      t.status,
    ),
  }),
);
