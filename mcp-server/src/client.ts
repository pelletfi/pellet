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

/** Current peg + 1h/24h/7d aggregates for a stablecoin */
export async function getPegStats(address: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/peg`);
}

/** Detected peg-break events for a stablecoin (mild and severe) */
export async function getPegEvents(address: string, limit: number = 20): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/peg-events?limit=${limit}`);
}

/** Composite risk score (0-100) with explainable component breakdown */
export async function getRiskScore(address: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/risk`);
}

/** Reserve / backing data: total backing USD + per-component breakdown */
export async function getReserves(address: string): Promise<unknown> {
  return apiGet(`/api/v1/stablecoins/${encodeURIComponent(address)}/reserves`);
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
