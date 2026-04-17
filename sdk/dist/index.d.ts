import type { Address, CronRunsResponse, FeeEconomicsOverviewResponse, FlowAnomaliesResponse, FlowsResponse, HealthResponse, PegEventsResponse, PegResponse, ReproducibilityMeta, ReservesResponse, RewardsResponse, RiskResponse, RolesResponse, SimulateTransferInput, SimulateTransferResponse, StablecoinSummary, StablecoinsListResponse, WalletIntelligenceResponse } from "./types.js";
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
export declare class PelletApiError extends Error {
    readonly status: number;
    readonly url: string;
    constructor(status: number, url: string, message: string);
}
export declare class Pellet {
    private readonly baseUrl;
    private readonly apiKey?;
    private readonly fetchFn;
    constructor(config?: PelletConfig);
    private request;
    /** Fluent stablecoin scope: `pellet.stablecoin(addr).peg()` etc.
     * Most methods accept `{ asOf }` for time-travel queries.
     * `asOf` accepts a Date, ISO string, unix seconds, or relative "1h"/"24h"/"7d". */
    stablecoin(address: Address): {
        detail: () => Promise<PelletResponse<StablecoinSummary>>;
        peg: (opts?: {
            asOf?: AsOf;
        }) => Promise<PelletResponse<PegResponse>>;
        pegEvents: (opts?: {
            limit?: number;
            asOf?: AsOf;
        }) => Promise<PelletResponse<PegEventsResponse>>;
        risk: (opts?: {
            asOf?: AsOf;
        }) => Promise<PelletResponse<RiskResponse>>;
        reserves: (opts?: {
            asOf?: AsOf;
        }) => Promise<PelletResponse<ReservesResponse>>;
        rewards: (opts?: {
            asOf?: AsOf;
        }) => Promise<PelletResponse<RewardsResponse>>;
        roles: () => Promise<PelletResponse<RolesResponse>>;
    };
    /** List all tracked TIP-20 stablecoins with risk inline. */
    stablecoins(): Promise<PelletResponse<StablecoinsListResponse>>;
    /** Cross-stable directional flow data. */
    flows(opts?: {
        hours?: number;
    }): Promise<PelletResponse<FlowsResponse>>;
    /** Fee-token economics overview — which stables are being elected as fee tokens,
     * how many fees each has received, ecosystem-wide totals. */
    feeEconomics(opts?: {
        asOf?: AsOf;
    }): Promise<PelletResponse<FeeEconomicsOverviewResponse>>;
    /** Recent flow anomalies (z-score-detected unusual flows). */
    flowAnomalies(opts?: {
        limit?: number;
        asOf?: AsOf;
    }): Promise<PelletResponse<FlowAnomaliesResponse>>;
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
    address(addr: Address): {
        intelligence: () => Promise<PelletResponse<WalletIntelligenceResponse>>;
        /** @deprecated Use `intelligence()` — returns label bundled with role + ERC-8004 data. */
        lookup: () => Promise<PelletResponse<WalletIntelligenceResponse>>;
    };
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
    simulate(input: SimulateTransferInput): Promise<PelletResponse<SimulateTransferResponse>>;
    /** Pellet system health + cron pipeline state. */
    system: {
        health: () => Promise<PelletResponse<HealthResponse>>;
        cronRuns: () => Promise<PelletResponse<CronRunsResponse>>;
    };
}
/** Accepts a Date, ISO 8601 string, unix epoch seconds, or a relative duration
 * like "1h", "24h", "7d". Passed through verbatim to the API's `?as_of=` param. */
export type AsOf = Date | string | number;
