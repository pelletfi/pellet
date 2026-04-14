// Pellet SDK — typed TypeScript client for the Pellet API.
//
// Stablecoin intelligence on Tempo: peg health, risk scores, reserves,
// role holders, peg-break events, flow anomalies, system health.
//
// Usage:
//   import { Pellet } from "@pelletfi/sdk";
//   const pellet = new Pellet();
//   const peg = await pellet.stablecoin("0x20c0...").peg();
export * from "./types.js";
export class PelletApiError extends Error {
    status;
    url;
    constructor(status, url, message) {
        super(message);
        this.status = status;
        this.url = url;
        this.name = "PelletApiError";
    }
}
export class Pellet {
    baseUrl;
    apiKey;
    fetchFn;
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl ?? "https://pelletfi.com").replace(/\/$/, "");
        this.apiKey = config.apiKey;
        this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    }
    // ── Internal request ──────────────────────────────────────────────────────
    async request(path, opts = {}) {
        const url = `${this.baseUrl}${withAsOf(path, opts.asOf)}`;
        const headers = {};
        if (this.apiKey)
            headers.Authorization = `Bearer ${this.apiKey}`;
        const res = await this.fetchFn(url, { headers });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new PelletApiError(res.status, url, `HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = (await res.json());
        const meta = {
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
    stablecoin(address) {
        const path = (suffix) => `/api/v1/stablecoins/${address}${suffix}`;
        return {
            detail: () => this.request(path("")),
            peg: (opts = {}) => this.request(path("/peg"), opts),
            pegEvents: (opts = {}) => this.request(path(`/peg-events?limit=${opts.limit ?? 20}`), { asOf: opts.asOf }),
            risk: (opts = {}) => this.request(path("/risk"), opts),
            reserves: (opts = {}) => this.request(path("/reserves"), opts),
            roles: () => this.request(path("/roles")),
        };
    }
    /** List all tracked TIP-20 stablecoins with risk inline. */
    stablecoins() {
        return this.request(`/api/v1/stablecoins`);
    }
    /** Cross-stable directional flow data. */
    flows(opts = {}) {
        const hours = opts.hours ?? 24;
        return this.request(`/api/v1/stablecoins/flows?hours=${hours}`);
    }
    /** Recent flow anomalies (z-score-detected unusual flows). */
    flowAnomalies(opts = {}) {
        const limit = opts.limit ?? 20;
        return this.request(`/api/v1/stablecoins/flow-anomalies?limit=${limit}`, { asOf: opts.asOf });
    }
    /** Address label / entity resolution. */
    address(addr) {
        return {
            lookup: () => this.request(`/api/v1/addresses/${addr}`),
        };
    }
    /** Pellet system health + cron pipeline state. */
    system = {
        health: () => this.request(`/api/v1/system/health`),
        cronRuns: () => this.request(`/api/v1/system/cron-runs`),
    };
}
function withAsOf(path, asOf) {
    if (asOf == null)
        return path;
    const value = asOf instanceof Date ? asOf.toISOString() : String(asOf);
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}as_of=${encodeURIComponent(value)}`;
}
// ── Helpers ─────────────────────────────────────────────────────────────────
function numOrUndef(v) {
    if (v == null)
        return undefined;
    const n = Number(v);
    return isFinite(n) ? n : undefined;
}
function csvOrUndef(v) {
    if (!v)
        return undefined;
    return v.split(",").map((s) => s.trim()).filter(Boolean);
}
