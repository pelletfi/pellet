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

export type ProviderRow = {
  // Unified key for both address-attributed and fingerprint-grouped providers.
  // For address kind: hex address. For fingerprint kind: "fp_" + 20-hex-char.
  key: string;
  kind: "address" | "fingerprint";
  address: string | null;
  fingerprint: string | null;
  label: string | null;
  txCount: number;
  amountSumWei: string;
};

export type DashboardSnapshot = {
  windowHours: number;
  txCount: number;
  agentsActive: number;
  amountSumWei: string;
  topServices: LeaderboardRow[];
  topAgents: LeaderboardRow[];
  topProviders: ProviderRow[];
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
  // T10: underlying service provider for gateway-routed events
  routedToAddress: string | null;
  routedToLabel: string | null;
  // T10.5: Pattern B fingerprint when address attribution unavailable
  routedFingerprint: string | null;
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
  const topProviders = await topRoutedProviders(windowHours, 10);
  const recentEvents = await recentDecoded(25);

  return {
    windowHours,
    txCount: Number(top.tx_count),
    agentsActive: Number(top.agents_active),
    amountSumWei: top.amount_sum_wei ?? "0",
    topServices,
    topAgents,
    topProviders,
    recentEvents,
  };
}

// Routed providers — combines both attribution paths:
//   1. Pattern A: address recovered from on-chain Settlement event
//   2. Pattern B: fingerprint extracted from user→gateway calldata bytes32 ref
// Both surface as unified rows so the dashboard shows ~100% of gateway routing
// even for groups we can't yet name. Joins address_labels for Pattern A so
// a label flows through automatically once we tag a provider.
export async function topRoutedProviders(
  windowHours: number,
  limit: number,
): Promise<ProviderRow[]> {
  const sinceCutoff = HOURS(windowHours);
  const rows = await db.execute<{
    key: string;
    kind: "address" | "fingerprint";
    address: string | null;
    fingerprint: string | null;
    label: string | null;
    tx_count: string;
    amount_sum_wei: string;
  }>(sql`
    WITH addr AS (
      SELECT
        ae.routed_to_address                              AS key,
        'address'::text                                   AS kind,
        ae.routed_to_address                              AS address,
        NULL::text                                        AS fingerprint,
        rl.label                                          AS label,
        COUNT(*)::text                                    AS tx_count,
        COALESCE(SUM(ae.amount_wei::numeric), 0)::text    AS amount_sum_wei
      FROM agent_events ae
      LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
      WHERE ae.ts > ${sinceCutoff}
        AND ae.routed_to_address IS NOT NULL
      GROUP BY ae.routed_to_address, rl.label
    ),
    fp AS (
      SELECT
        ('fp_' || ae.routed_fingerprint)                  AS key,
        'fingerprint'::text                               AS kind,
        NULL::text                                        AS address,
        ae.routed_fingerprint                             AS fingerprint,
        NULL::text                                        AS label,
        COUNT(*)::text                                    AS tx_count,
        COALESCE(SUM(ae.amount_wei::numeric), 0)::text    AS amount_sum_wei
      FROM agent_events ae
      WHERE ae.ts > ${sinceCutoff}
        AND ae.routed_fingerprint IS NOT NULL
        AND ae.routed_to_address IS NULL
      GROUP BY ae.routed_fingerprint
    )
    SELECT * FROM (
      SELECT * FROM addr
      UNION ALL
      SELECT * FROM fp
    ) combined
    ORDER BY amount_sum_wei::numeric DESC
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => ({
    key: r.key,
    kind: r.kind,
    address: r.address,
    fingerprint: r.fingerprint,
    label: r.label,
    txCount: Number(r.tx_count),
    amountSumWei: r.amount_sum_wei,
  }));
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
    routed_to_address: string | null;
    routed_to_label: string | null;
    routed_fingerprint: string | null;
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
      ae.methodology_version                  AS methodology_version,
      ae.routed_to_address                    AS routed_to_address,
      rl.label                                AS routed_to_label,
      ae.routed_fingerprint                   AS routed_fingerprint
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
    ORDER BY ae.ts DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    // Drizzle's db.execute() (raw SQL) returns timestamps as ISO strings via
    // neon-serverless. Coerce to Date here so consumers can call .getTime().
    ts: r.ts instanceof Date ? r.ts : new Date(r.ts as unknown as string),
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
    routedToAddress: r.routed_to_address,
    routedToLabel: r.routed_to_label,
    routedFingerprint: r.routed_fingerprint,
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
    // Coerce ISO string from raw SQL execute path into Date.
    lastActivity:
      r.last_activity == null
        ? null
        : r.last_activity instanceof Date
          ? r.last_activity
          : new Date(r.last_activity as unknown as string),
    topServiceLabel: r.top_service_label,
  }));
}

export async function serviceDetail(id: string) {
  // Raw SQL columns come back snake_case; we map to camelCase below to match
  // RecentEventRow's expected shape (downstream EventStream calls e.txHash etc.).
  const recent = await db.execute<{
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
    routed_to_address: string | null;
    routed_to_label: string | null;
    routed_fingerprint: string | null;
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
      ae.methodology_version                  AS methodology_version,
      ae.routed_to_address                    AS routed_to_address,
      rl.label                                AS routed_to_label,
      ae.routed_fingerprint                   AS routed_fingerprint
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
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

  // Underlying-provider breakdown — combines Pattern A (address) and
  // Pattern B (fingerprint) attribution. Empty for non-gateway services.
  const providers = await db.execute<{
    key: string;
    kind: "address" | "fingerprint";
    address: string | null;
    fingerprint: string | null;
    label: string | null;
    category: string | null;
    tx_count: string;
    amount_sum_wei: string;
    last_ts: Date | string;
  }>(sql`
    WITH addr AS (
      SELECT
        ae.routed_to_address                              AS key,
        'address'::text                                   AS kind,
        ae.routed_to_address                              AS address,
        NULL::text                                        AS fingerprint,
        rl.label                                          AS label,
        rl.category                                       AS category,
        COUNT(*)::text                                    AS tx_count,
        COALESCE(SUM(ae.amount_wei::numeric), 0)::text    AS amount_sum_wei,
        MAX(ae.ts)                                        AS last_ts
      FROM agent_events ae
      LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
      WHERE ae.agent_id = ${id}
        AND ae.routed_to_address IS NOT NULL
      GROUP BY ae.routed_to_address, rl.label, rl.category
    ),
    fp AS (
      SELECT
        ('fp_' || ae.routed_fingerprint)                  AS key,
        'fingerprint'::text                               AS kind,
        NULL::text                                        AS address,
        ae.routed_fingerprint                             AS fingerprint,
        NULL::text                                        AS label,
        NULL::text                                        AS category,
        COUNT(*)::text                                    AS tx_count,
        COALESCE(SUM(ae.amount_wei::numeric), 0)::text    AS amount_sum_wei,
        MAX(ae.ts)                                        AS last_ts
      FROM agent_events ae
      WHERE ae.agent_id = ${id}
        AND ae.routed_fingerprint IS NOT NULL
        AND ae.routed_to_address IS NULL
      GROUP BY ae.routed_fingerprint
    )
    SELECT * FROM (
      SELECT * FROM addr
      UNION ALL
      SELECT * FROM fp
    ) combined
    ORDER BY amount_sum_wei::numeric DESC
  `);

  return {
    head: head[0] ?? null,
    providers: providers.rows.map((r) => ({
      key: r.key,
      kind: r.kind,
      address: r.address,
      fingerprint: r.fingerprint,
      label: r.label,
      category: r.category,
      txCount: Number(r.tx_count),
      amountSumWei: r.amount_sum_wei,
      lastTs: r.last_ts instanceof Date ? r.last_ts : new Date(r.last_ts as string),
    })),
    // Map snake_case → camelCase to match the RecentEventRow shape downstream
    // consumers (EventStream + decoder) expect. Also coerce ts string → Date.
    recent: recent.rows.map((r) => ({
      id: r.id,
      ts: r.ts instanceof Date ? r.ts : new Date(r.ts as unknown as string),
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
      routedToAddress: r.routed_to_address,
      routedToLabel: r.routed_to_label,
      routedFingerprint: r.routed_fingerprint,
    })),
    trend: trend.rows.map((r) => ({
      bucket: r.bucket instanceof Date ? r.bucket : new Date(r.bucket as unknown as string),
      amountWei: r.amount_wei,
      txCount: Number(r.tx_count),
    })),
  };
}

export async function agentDetail(id: string) {
  return serviceDetail(id); // same query shape — different page presentation
}

// ── Routed provider detail page ───────────────────────────────────────────

export type ProviderDetail = {
  key: string;
  kind: "address" | "fingerprint";
  address: string | null;
  fingerprint: string | null;
  label: string | null;
  category: string | null;
  txCount: number;
  amountSumWei: string;
  txCount24h: number;
  amountSumWei24h: string;
  firstSeen: Date | null;
  lastSeen: Date | null;
  trend: Array<{ bucket: Date; amountWei: string; txCount: number }>;
  recent: RecentEventRow[];
};

export async function providerDetail(key: string): Promise<ProviderDetail | null> {
  // Key is either a hex address or "fp_<20-hex-char>". Dispatch to the right
  // filter so the same page works for both attribution paths.
  const lc = key.toLowerCase();
  const isFingerprint = lc.startsWith("fp_");
  const addr = isFingerprint ? null : lc;
  const fp = isFingerprint ? lc.slice(3) : null;
  const matchClause = isFingerprint
    ? sql`routed_fingerprint = ${fp}`
    : sql`routed_to_address = ${addr}`;

  // Header aggregates: lifetime + 24h + first/last seen.
  // ON FALSE so the JOIN produces no rows for fingerprint case (no address
  // to look up). For address case, JOIN finds the label by address.
  const labelLookup = isFingerprint ? sql`FALSE` : sql`rl.address = ${addr}`;
  const head = await db.execute<{
    tx_count: string;
    amount_sum_wei: string;
    tx_count_24h: string;
    amount_sum_wei_24h: string;
    first_seen: Date | string | null;
    last_seen: Date | string | null;
    label: string | null;
    category: string | null;
  }>(sql`
    SELECT
      COUNT(*)::text                                              AS tx_count,
      COALESCE(SUM(ae.amount_wei::numeric), 0)::text              AS amount_sum_wei,
      COUNT(*) FILTER (WHERE ae.ts > now() - interval '24 hours')::text       AS tx_count_24h,
      COALESCE(SUM(ae.amount_wei::numeric) FILTER (WHERE ae.ts > now() - interval '24 hours'), 0)::text AS amount_sum_wei_24h,
      MIN(ae.ts)                                                  AS first_seen,
      MAX(ae.ts)                                                  AS last_seen,
      MAX(rl.label)                                               AS label,
      MAX(rl.category)                                            AS category
    FROM agent_events ae
    LEFT JOIN address_labels rl ON ${labelLookup}
    WHERE ae.${matchClause}
  `);

  if (head.rows.length === 0 || Number(head.rows[0].tx_count) === 0) return null;
  const h = head.rows[0];

  // 30-day daily trend.
  const trend = await db.execute<{ bucket: Date | string; amount_wei: string; tx_count: string }>(sql`
    SELECT
      date_trunc('day', ts) AS bucket,
      COALESCE(SUM(amount_wei::numeric), 0)::text AS amount_wei,
      COUNT(*)::text AS tx_count
    FROM agent_events
    WHERE ${matchClause}
      AND ts > now() - interval '30 days'
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  // Recent events routed to this provider.
  const recent = await db.execute<{
    id: number;
    ts: Date | string;
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
    routed_to_address: string | null;
    routed_to_label: string | null;
    routed_fingerprint: string | null;
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
      ae.methodology_version                  AS methodology_version,
      ae.routed_to_address                    AS routed_to_address,
      rl.label                                AS routed_to_label,
      ae.routed_fingerprint                   AS routed_fingerprint
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
    WHERE ae.${matchClause}
    ORDER BY ae.ts DESC
    LIMIT 50
  `);

  return {
    key: lc,
    kind: isFingerprint ? "fingerprint" : "address",
    address: addr,
    fingerprint: fp,
    label: h.label,
    category: h.category,
    txCount: Number(h.tx_count),
    amountSumWei: h.amount_sum_wei,
    txCount24h: Number(h.tx_count_24h),
    amountSumWei24h: h.amount_sum_wei_24h,
    firstSeen: h.first_seen
      ? h.first_seen instanceof Date
        ? h.first_seen
        : new Date(h.first_seen as string)
      : null,
    lastSeen: h.last_seen
      ? h.last_seen instanceof Date
        ? h.last_seen
        : new Date(h.last_seen as string)
      : null,
    trend: trend.rows.map((r) => ({
      bucket: r.bucket instanceof Date ? r.bucket : new Date(r.bucket as string),
      amountWei: r.amount_wei,
      txCount: Number(r.tx_count),
    })),
    recent: recent.rows.map((r) => ({
      id: r.id,
      ts: r.ts instanceof Date ? r.ts : new Date(r.ts as string),
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
      routedToAddress: r.routed_to_address,
      routedToLabel: r.routed_to_label,
      routedFingerprint: r.routed_fingerprint,
    })),
  };
}

// ── Per-token breakdown (dashboard stack chart) ───────────────────────────

export type TokenStackPoint = {
  bucket: Date;
  usdce: number; // display USDC.e (already /1e6)
  usdt0: number;
  other: number;
  txCount: number;
};

export type TokenStackTotals = {
  usdce: number;
  usdt0: number;
  other: number;
};

export type TokenStackResult = {
  points: TokenStackPoint[];
  totals: TokenStackTotals;
  bucketHours: number;
};

const USDCE_ADDR = "0x20c000000000000000000000b9537d11c60e8b50";
const USDT0_ADDR = "0x20c00000000000000000000014f22ca97301eb73";

export async function tokenBreakdown(windowHours: number): Promise<TokenStackResult> {
  // Pick a bucket size that yields ~24-30 points for any window.
  const bucketHours =
    windowHours <= 24 ? 1 : windowHours <= 168 ? 6 : 24;
  const bucketInterval = sql.raw(`'${bucketHours} hours'`);
  const sinceCutoff = HOURS(windowHours);

  const rows = await db.execute<{
    bucket: Date | string;
    usdce: string;
    usdt0: string;
    other: string;
    tx_count: string;
  }>(sql`
    SELECT
      date_bin(interval ${bucketInterval}, ts, timestamp 'epoch') AS bucket,
      COALESCE(SUM(CASE WHEN LOWER(token_address) = ${USDCE_ADDR}
                        THEN amount_wei::numeric ELSE 0 END), 0)::text AS usdce,
      COALESCE(SUM(CASE WHEN LOWER(token_address) = ${USDT0_ADDR}
                        THEN amount_wei::numeric ELSE 0 END), 0)::text AS usdt0,
      COALESCE(SUM(CASE WHEN LOWER(token_address) NOT IN (${USDCE_ADDR}, ${USDT0_ADDR})
                          AND token_address IS NOT NULL
                        THEN amount_wei::numeric ELSE 0 END), 0)::text AS other,
      COUNT(*)::text AS tx_count
    FROM agent_events
    WHERE ts > ${sinceCutoff}
      AND kind = 'transfer'
      AND amount_wei IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  const points: TokenStackPoint[] = rows.rows.map((r) => ({
    bucket: r.bucket instanceof Date ? r.bucket : new Date(r.bucket as string),
    usdce: Number(r.usdce) / 1_000_000,
    usdt0: Number(r.usdt0) / 1_000_000,
    other: Number(r.other) / 1_000_000,
    txCount: Number(r.tx_count),
  }));

  const totals: TokenStackTotals = points.reduce(
    (acc, p) => ({
      usdce: acc.usdce + p.usdce,
      usdt0: acc.usdt0 + p.usdt0,
      other: acc.other + p.other,
    }),
    { usdce: 0, usdt0: 0, other: 0 },
  );

  return { points, totals, bucketHours };
}

// ── Global search (⌘K command bar) ────────────────────────────────────────

export type SearchHit = {
  kind: "event" | "agent" | "service" | "address";
  id: string;
  label: string;
  sub: string;
  href: string;
};

export async function searchOli(q: string): Promise<SearchHit[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const pattern = `%${trimmed}%`;

  // 1. Agents/services — match id, label, or wallet address. The agents table
  //    is the canonical entity registry; we split on id LIKE '%-mpp' to route
  //    to the right detail page.
  const entitiesP = db.execute<{
    id: string;
    label: string;
    category: string | null;
    wallet: string | null;
  }>(sql`
    SELECT
      a.id                              AS id,
      a.label                           AS label,
      (a.links ->> 'category')          AS category,
      COALESCE(a.wallets[1], NULL)      AS wallet
    FROM agents a
    WHERE a.active = true
      AND (
        a.id ILIKE ${pattern}
        OR a.label ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM unnest(a.wallets) w WHERE w ILIKE ${pattern}
        )
      )
    ORDER BY a.label ASC
    LIMIT 8
  `);

  // 2. Events — match tx hash or counterparty address. Recent first.
  const eventsP = db.execute<{
    id: number;
    ts: Date | string;
    agent_label: string;
    kind: string;
    amount_wei: string | null;
    tx_hash: string;
  }>(sql`
    SELECT
      ae.id::int                        AS id,
      ae.ts                             AS ts,
      a.label                           AS agent_label,
      ae.kind                           AS kind,
      ae.amount_wei                     AS amount_wei,
      ae.tx_hash                        AS tx_hash
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    WHERE ae.tx_hash ILIKE ${pattern}
       OR ae.counterparty_address ILIKE ${pattern}
    ORDER BY ae.ts DESC
    LIMIT 8
  `);

  // 3. Address labels — labeled counterparties that aren't watched agents.
  //    Useful for searching "Stargate" or "0x789…" and seeing the label hit.
  const labelsP = db.execute<{
    address: string;
    label: string;
    category: string | null;
  }>(sql`
    SELECT al.address, al.label, al.category
    FROM address_labels al
    WHERE al.address ILIKE ${pattern} OR al.label ILIKE ${pattern}
    ORDER BY al.label ASC
    LIMIT 6
  `);

  const [entities, events, labels] = await Promise.all([entitiesP, eventsP, labelsP]);

  const hits: SearchHit[] = [];

  for (const r of entities.rows) {
    const isService = r.id.endsWith("-mpp");
    hits.push({
      kind: isService ? "service" : "agent",
      id: r.id,
      label: r.label,
      sub: r.wallet ?? r.category ?? r.id,
      href: isService ? `/oli/services/${r.id}` : `/oli/agents/${r.id}`,
    });
  }

  for (const r of events.rows) {
    const tsDate = r.ts instanceof Date ? r.ts : new Date(r.ts as string);
    hits.push({
      kind: "event",
      id: String(r.id),
      label: `${r.agent_label} · ${r.kind}`,
      sub: `${r.tx_hash.slice(0, 10)}…${r.tx_hash.slice(-6)} · ${tsDate.toISOString().slice(0, 16).replace("T", " ")}`,
      href: `/oli/event/${r.id}`,
    });
  }

  for (const r of labels.rows) {
    hits.push({
      kind: "address",
      id: r.address,
      label: r.label,
      sub: `${r.address.slice(0, 10)}…${r.address.slice(-6)}${r.category ? ` · ${r.category}` : ""}`,
      // No detail page for addresses yet — link out to Tempo explorer.
      href: `https://explorer.tempo.foundation/address/${r.address}`,
    });
  }

  return hits;
}

// ── Event detail (deep-link page) ─────────────────────────────────────────

export type EventDetail = {
  id: number;
  ts: Date;
  agentId: string;
  agentLabel: string;
  agentBio: string | null;
  agentSource: string;
  counterpartyAddress: string | null;
  counterpartyLabel: string | null;
  counterpartyCategory: string | null;
  kind: string;
  amountWei: string | null;
  tokenAddress: string | null;
  txHash: string;
  logIndex: number;
  sourceBlock: number;
  methodologyVersion: string;
  matchedAt: Date;
  routedToAddress: string | null;
  routedToLabel: string | null;
  routedToCategory: string | null;
  // related events: other agent_events from the same tx (excluding this one)
  related: Array<{
    id: number;
    agentId: string;
    agentLabel: string;
    kind: string;
    amountWei: string | null;
    counterpartyAddress: string | null;
    counterpartyLabel: string | null;
  }>;
};

export async function eventDetail(id: number): Promise<EventDetail | null> {
  const main = await db.execute<{
    id: number;
    ts: Date | string;
    agent_id: string;
    agent_label: string;
    agent_bio: string | null;
    agent_source: string;
    counterparty_address: string | null;
    counterparty_label: string | null;
    counterparty_category: string | null;
    kind: string;
    amount_wei: string | null;
    token_address: string | null;
    tx_hash: string;
    log_index: number;
    source_block: number;
    methodology_version: string;
    matched_at: Date | string;
    routed_to_address: string | null;
    routed_to_label: string | null;
    routed_to_category: string | null;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.ts                                   AS ts,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      a.bio                                   AS agent_bio,
      a.source                                AS agent_source,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label,
      cl.category                             AS counterparty_category,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.token_address                        AS token_address,
      ae.tx_hash                              AS tx_hash,
      ae.log_index                            AS log_index,
      ae.source_block::int                    AS source_block,
      ae.methodology_version                  AS methodology_version,
      ae.matched_at                           AS matched_at,
      ae.routed_to_address                    AS routed_to_address,
      rl.label                                AS routed_to_label,
      rl.category                             AS routed_to_category
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
    WHERE ae.id = ${id}
    LIMIT 1
  `);

  if (main.rows.length === 0) return null;
  const row = main.rows[0];

  // Related: other agent_events from the same tx, excluding this row.
  const relatedRows = await db.execute<{
    id: number;
    agent_id: string;
    agent_label: string;
    kind: string;
    amount_wei: string | null;
    counterparty_address: string | null;
    counterparty_label: string | null;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    WHERE ae.tx_hash = ${row.tx_hash} AND ae.id <> ${id}
    ORDER BY ae.log_index ASC
  `);

  return {
    id: row.id,
    ts: row.ts instanceof Date ? row.ts : new Date(row.ts as string),
    agentId: row.agent_id,
    agentLabel: row.agent_label,
    agentBio: row.agent_bio,
    agentSource: row.agent_source,
    counterpartyAddress: row.counterparty_address,
    counterpartyLabel: row.counterparty_label,
    counterpartyCategory: row.counterparty_category,
    kind: row.kind,
    amountWei: row.amount_wei,
    tokenAddress: row.token_address,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    sourceBlock: row.source_block,
    methodologyVersion: row.methodology_version,
    matchedAt: row.matched_at instanceof Date ? row.matched_at : new Date(row.matched_at as string),
    routedToAddress: row.routed_to_address,
    routedToLabel: row.routed_to_label,
    routedToCategory: row.routed_to_category,
    related: relatedRows.rows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      agentLabel: r.agent_label,
      kind: r.kind,
      amountWei: r.amount_wei,
      counterpartyAddress: r.counterparty_address,
      counterpartyLabel: r.counterparty_label,
    })),
  };
}
