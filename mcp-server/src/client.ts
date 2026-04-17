import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const PELLET_API = process.env.PELLET_API ?? "https://pelletfi.com";

// Build an mppx-powered fetch if EVM_PRIVATE_KEY is set (for paid endpoints)
function buildFetch(): typeof fetch {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) {
    // No key — use plain fetch (free endpoints only)
    return globalThis.fetch.bind(globalThis);
  }

  const key = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(key);

  const client = Mppx.create({
    methods: [tempo({ account })],
    polyfill: false,
  });

  return client.fetch as typeof fetch;
}

const mppxFetch = buildFetch();

async function apiGet(path: string): Promise<unknown> {
  const res = await mppxFetch(`${PELLET_API}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Pellet API error ${res.status}: ${JSON.stringify(body)}`
    );
  }
  return res.json();
}

/** Search for tokens on Tempo by symbol or name */
export async function searchTokens(query: string): Promise<unknown> {
  return apiGet(`/api/v1/tokens?q=${encodeURIComponent(query)}`);
}

/** Get market data, safety flags, and compliance for a Tempo token */
export async function lookupToken(address: string): Promise<unknown> {
  return apiGet(`/api/v1/tokens/${encodeURIComponent(address)}`);
}

/** Deep briefing: origin, holders, compliance, analyst note ($0.05 pathUSD) */
export async function analyzeToken(address: string): Promise<unknown> {
  return apiGet(`/api/v1/tokens/${encodeURIComponent(address)}/briefing`);
}

/** Full Tempo stablecoin matrix */
export async function getStablecoins(): Promise<unknown> {
  return apiGet("/api/v1/stablecoins");
}

/** Net directional flows between Tempo stablecoins */
export async function getStablecoinFlows(hours: number = 24): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/flows?hours=${hours}`);
}

function asOfQuery(asOf?: string): string {
  return asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
}

/** Current peg + 1h/24h/7d aggregates for a stablecoin.  Pass `asOf` for a
 * historical snapshot (ISO-8601 timestamp, Unix-epoch seconds, or relative
 * like `-1h`); omit for current. */
export async function getPegStats(address: string, asOf?: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/peg${asOfQuery(asOf)}`);
}

/** Detected peg-break events for a stablecoin (mild and severe) */
export async function getPegEvents(address: string, limit: number = 20): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/peg-events?limit=${limit}`);
}

/** Composite risk score (0-100) with explainable component breakdown.  Pass
 * `asOf` for a historical snapshot. */
export async function getRiskScore(address: string, asOf?: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/risk${asOfQuery(asOf)}`);
}

/** Reserve / backing data: total backing USD + per-component breakdown.
 * Pass `asOf` for a historical snapshot. */
export async function getReserves(address: string, asOf?: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/reserves${asOfQuery(asOf)}`);
}

/** TIP-20 reward distribution + effective APY for a stablecoin.  Returns
 * per-funder attribution, recent distributions, opted-in supply, and the
 * effective annualized yield computed from the last 7d of distributions. */
export async function getRewards(address: string, asOf?: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/rewards${asOfQuery(asOf)}`);
}

/** Forensic role-holder enumeration for a stablecoin — issuer, minter,
 * pauser, burn-blocked addresses derived from on-chain action + hasRole
 * verification.  TIP-20 doesn't emit role-change events, so this is the
 * only path to the current role set. */
export async function getRoleHolders(address: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/roles`);
}

/** Cross-stable flow anomalies — 15-minute windows where net flow between
 * two stables exceeded the 7-day rolling baseline by > Z_THRESHOLD sigmas.
 * Useful for early-warning of capital rotation events. */
export async function getFlowAnomalies(): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/flow-anomalies`);
}

/**
 * Wallet intelligence — label + ERC-8004 agent status + role holdings +
 * derived role summaries for any Tempo address. Combines pellet curated
 * labels, forensic role discovery, and the ERC-8004 Identity Registry.
 * Unique to Pellet on Tempo — chain-generic wallet APIs can't produce this.
 */
export async function lookupWalletIntelligence(address: string): Promise<unknown> {
  return apiGet(`/api/v1/addresses/${encodeURIComponent(address)}`);
}

/**
 * Fast transaction-time precheck for any Tempo address.  Returns compact
 * boolean flags — is_issuer_of_any / is_minter_of_any / is_pauser_of_any /
 * is_burn_blocked_by_any / is_policy_admin_of_any / is_privileged — plus
 * label and counts.  Pure DB read, no pipeline, designed for the agent
 * critical path (target < 50ms).  Use lookupWalletIntelligence when you
 * need per-stable breakdown or ERC-8004 agent status.
 */
export async function quickcheckAddress(address: string): Promise<unknown> {
  return apiGet(`/api/v1/addresses/${encodeURIComponent(address)}/quickcheck`);
}

/**
 * Pre-trade compliance oracle. Given a proposed TIP-20 transfer, predict
 * statically whether it would revert under TIP-403 policy — without sending
 * a transaction. Returns `willSucceed` (true/false/null) + policy details +
 * (if amount given) balance check. Null means unknown, never inferred false.
 */
export async function simulateTransfer(
  from: string,
  to: string,
  token: string,
  amount?: string,
): Promise<unknown> {
  const params = new URLSearchParams({
    from,
    to,
    token,
  });
  if (amount !== undefined && amount !== "") params.set("amount", amount);
  return apiGet(`/api/v1/tip403/simulate?${params.toString()}`);
}
