// Pellet SDK — typed TypeScript client for the Pellet API.
//
// Open-ledger intelligence on Tempo: peg health, risk scores, reserves,
// role holders, peg-break events, flow anomalies, system health.
//
// Usage:
//   import { Pellet } from "@pelletfi/sdk";
//   const pellet = new Pellet();
//   const peg = await pellet.stablecoin("0x20c0...").peg();

import type {
  Address,
  AddressLabel,
  CronRunsResponse,
  FeeEconomicsOverviewResponse,
  FlowAnomaliesResponse,
  FlowsResponse,
  HealthResponse,
  PegEventsResponse,
  PegResponse,
  ReproducibilityMeta,
  ReservesResponse,
  RewardsResponse,
  RiskResponse,
  RolesResponse,
  SimulateTransferInput,
  SimulateTransferResponse,
  StablecoinSummary,
  StablecoinsListResponse,
  WalletIntelligenceResponse,
} from "./types.js";

export * from "./types.js";

interface PelletConfig {
  /** Base URL — defaults to https://pelletfi.com */
  baseUrl?: string;
  /** Optional Pellet Pro API key (Bearer auth). Free endpoints work without. */
  apiKey?: string;
  /** Custom fetch implementation (e.g. for MPP-paid endpoints with mppx) */
  fetch?: typeof fetch;
}

/** Wrapped response that includes both data and reproducibility metadata. */
export interface PelletResponse<T> {
  data: T;
  meta: ReproducibilityMeta;
}

export class PelletApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "PelletApiError";
  }
}

export class Pellet {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: PelletConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "https://pelletfi.com").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ── Internal request ──────────────────────────────────────────────────────

  private async request<T>(path: string, opts: { asOf?: AsOf } = {}): Promise<PelletResponse<T>> {
    const url = `${this.baseUrl}${withAsOf(path, opts.asOf)}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const res = await this.fetchFn(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PelletApiError(res.status, url, `HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as T;
    const meta: ReproducibilityMeta = {
      methodologyVersion: res.headers.get("x-pellet-methodology-version") ?? "unknown",
      computedAt: res.headers.get("x-pellet-computed-at") ?? new Date().toISOString(),
      method: res.headers.get("x-pellet-method") ?? undefined,
      sourceBlock: numOrUndef(res.headers.get("x-pellet-source-block")),
      sourceCall: res.headers.get("x-pellet-source-call") ?? undefined,
      sourceContracts: csvOrUndef(res.headers.get("x-pellet-source-contracts")),
      sourceTables: csvOrUndef(res.headers.get("x-pellet-source-tables")),
      freshnessSec: numOrUndef(res.headers.get("x-pellet-freshness-sla")?.replace(/s$/, "") ?? null),
      asOf: res.headers.get("x-pellet-as-of") ?? undefined,
    };
    return { data, meta };
  }

  // ── Stablecoin namespaces ─────────────────────────────────────────────────

  /** Fluent stablecoin scope: `pellet.stablecoin(addr).peg()` etc.
   * Most methods accept `{ asOf }` for time-travel queries.
   * `asOf` accepts a Date, ISO string, unix seconds, or relative "1h"/"24h"/"7d". */
  stablecoin(address: Address) {
    const path = (suffix: string) => `/api/v1/stablecoins/${address}${suffix}`;
    return {
      detail: () => this.request<StablecoinSummary>(path("")),
      peg: (opts: { asOf?: AsOf } = {}) => this.request<PegResponse>(path("/peg"), opts),
      pegEvents: (opts: { limit?: number; asOf?: AsOf } = {}) =>
        this.request<PegEventsResponse>(path(`/peg-events?limit=${opts.limit ?? 20}`), { asOf: opts.asOf }),
      risk: (opts: { asOf?: AsOf } = {}) => this.request<RiskResponse>(path("/risk"), opts),
      reserves: (opts: { asOf?: AsOf } = {}) => this.request<ReservesResponse>(path("/reserves"), opts),
      rewards: (opts: { asOf?: AsOf } = {}) => this.request<RewardsResponse>(path("/rewards"), opts),
      roles: () => this.request<RolesResponse>(path("/roles")),
    };
  }

  /** List all tracked TIP-20 stablecoins with risk inline. */
  stablecoins() {
    return this.request<StablecoinsListResponse>(`/api/v1/stablecoins`);
  }

  /** Cross-stable directional flow data. */
  flows(opts: { hours?: number } = {}) {
    const hours = opts.hours ?? 24;
    return this.request<FlowsResponse>(`/api/v1/stablecoins/flows?hours=${hours}`);
  }

  /** Fee-token economics overview — which stables are being elected as fee tokens,
   * how many fees each has received, ecosystem-wide totals. */
  feeEconomics(opts: { asOf?: AsOf } = {}) {
    return this.request<FeeEconomicsOverviewResponse>(
      `/api/v1/fee-economics/overview`,
      { asOf: opts.asOf },
    );
  }

  /** Recent flow anomalies (z-score-detected unusual flows). */
  flowAnomalies(opts: { limit?: number; asOf?: AsOf } = {}) {
    const limit = opts.limit ?? 20;
    return this.request<FlowAnomaliesResponse>(
      `/api/v1/stablecoins/flow-anomalies?limit=${limit}`,
      { asOf: opts.asOf },
    );
  }

  /**
   * Address scope — resolve labels, ERC-8004 agent status, role holdings
   * across tracked stablecoins, and derived role summaries in one call.
   *
   * - `intelligence()` returns the full wallet-intel bundle (label + agent +
   *   roles + is_issuer_of etc.). This is the default modern endpoint and
   *   bundles what Codex / Nansen / Zerion can't on Tempo.
   * - `lookup()` is the legacy label-only view, kept for backward compat.
   *   Prefer `intelligence()` going forward.
   */
  address(addr: Address) {
    return {
      intelligence: () =>
        this.request<WalletIntelligenceResponse>(`/api/v1/addresses/${addr}`),
      /** @deprecated Use `intelligence()` — returns label bundled with role + ERC-8004 data. */
      lookup: () =>
        this.request<WalletIntelligenceResponse>(`/api/v1/addresses/${addr}`),
    };
  }

  /**
   * Pre-trade compliance oracle. Given a proposed TIP-20 transfer, predict
   * statically whether it would revert under TIP-403 policy — without
   * actually sending a transaction. Saves agents gas on preventable reverts.
   *
   * - `willSucceed: true`  → policy + balance pass; safe to submit.
   * - `willSucceed: false` → blocked; see `blockedBy` and `reason`.
   * - `willSucceed: null`  → unknown; retry or submit and handle revert.
   *
   * Example:
   *   const { data } = await pellet.simulate({
   *     from: "0xabc…",
   *     to: "0xdef…",
   *     token: "0x20c0…b9537d11c60e8b50",  // USDC.e
   *     amount: "1000000",                 // 1 USDC.e (6 decimals)
   *   });
   *   if (data.willSucceed === false) {
   *     console.error(data.reason);
   *     return;
   *   }
   *   // ... submit the transfer
   */
  simulate(input: SimulateTransferInput) {
    const params = new URLSearchParams({
      from: input.from,
      to: input.to,
      token: input.token,
    });
    if (input.amount !== undefined) params.set("amount", input.amount);
    return this.request<SimulateTransferResponse>(
      `/api/v1/tip403/simulate?${params.toString()}`,
    );
  }

  /** Pellet system health + cron pipeline state. */
  system = {
    health: () => this.request<HealthResponse>(`/api/v1/system/health`),
    cronRuns: () => this.request<CronRunsResponse>(`/api/v1/system/cron-runs`),
  };
}

// ── Time-travel ─────────────────────────────────────────────────────────────

/** Accepts a Date, ISO 8601 string, unix epoch seconds, or a relative duration
 * like "1h", "24h", "7d". Passed through verbatim to the API's `?as_of=` param. */
export type AsOf = Date | string | number;

function withAsOf(path: string, asOf?: AsOf): string {
  if (asOf == null) return path;
  const value = asOf instanceof Date ? asOf.toISOString() : String(asOf);
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}as_of=${encodeURIComponent(value)}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function numOrUndef(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

function csvOrUndef(v: string | null): string[] | undefined {
  if (!v) return undefined;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
