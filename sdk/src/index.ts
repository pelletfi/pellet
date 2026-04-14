// Pellet SDK — typed TypeScript client for the Pellet API.
//
// Stablecoin intelligence on Tempo: peg health, risk scores, reserves,
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
  FlowAnomaliesResponse,
  FlowsResponse,
  HealthResponse,
  PegEventsResponse,
  PegResponse,
  ReproducibilityMeta,
  ReservesResponse,
  RiskResponse,
  RolesResponse,
  StablecoinSummary,
  StablecoinsListResponse,
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

  private async request<T>(path: string): Promise<PelletResponse<T>> {
    const url = `${this.baseUrl}${path}`;
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
    };
    return { data, meta };
  }

  // ── Stablecoin namespaces ─────────────────────────────────────────────────

  /** Fluent stablecoin scope: `pellet.stablecoin(addr).peg()` etc. */
  stablecoin(address: Address) {
    const path = (suffix: string) => `/api/v1/stablecoins/${address}${suffix}`;
    return {
      detail: () => this.request<StablecoinSummary>(path("")),
      peg: () => this.request<PegResponse>(path("/peg")),
      pegEvents: (limit = 20) => this.request<PegEventsResponse>(path(`/peg-events?limit=${limit}`)),
      risk: () => this.request<RiskResponse>(path("/risk")),
      reserves: () => this.request<ReservesResponse>(path("/reserves")),
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

  /** Recent flow anomalies (z-score-detected unusual flows). */
  flowAnomalies(opts: { limit?: number } = {}) {
    const limit = opts.limit ?? 20;
    return this.request<FlowAnomaliesResponse>(`/api/v1/stablecoins/flow-anomalies?limit=${limit}`);
  }

  /** Address label / entity resolution. */
  address(addr: Address) {
    return {
      lookup: () => this.request<AddressLabel>(`/api/v1/addresses/${addr}`),
    };
  }

  /** Pellet system health + cron pipeline state. */
  system = {
    health: () => this.request<HealthResponse>(`/api/v1/system/health`),
    cronRuns: () => this.request<CronRunsResponse>(`/api/v1/system/cron-runs`),
  };
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
