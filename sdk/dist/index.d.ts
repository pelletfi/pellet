import type { Address, AddressLabel, CronRunsResponse, FlowAnomaliesResponse, FlowsResponse, HealthResponse, PegEventsResponse, PegResponse, ReproducibilityMeta, ReservesResponse, RewardsResponse, RiskResponse, RolesResponse, StablecoinSummary, StablecoinsListResponse } from "./types.js";
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
    /** Recent flow anomalies (z-score-detected unusual flows). */
    flowAnomalies(opts?: {
        limit?: number;
        asOf?: AsOf;
    }): Promise<PelletResponse<FlowAnomaliesResponse>>;
    /** Address label / entity resolution. */
    address(addr: Address): {
        lookup: () => Promise<PelletResponse<AddressLabel>>;
    };
    /** Pellet system health + cron pipeline state. */
    system: {
        health: () => Promise<PelletResponse<HealthResponse>>;
        cronRuns: () => Promise<PelletResponse<CronRunsResponse>>;
    };
}
/** Accepts a Date, ISO 8601 string, unix epoch seconds, or a relative duration
 * like "1h", "24h", "7d". Passed through verbatim to the API's `?as_of=` param. */
export type AsOf = Date | string | number;
