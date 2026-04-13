import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";
const PELLET_API = process.env.PELLET_API ?? "https://pelletfi.com";
// Build an mppx-powered fetch if EVM_PRIVATE_KEY is set (for paid endpoints)
function buildFetch() {
    const rawKey = process.env.EVM_PRIVATE_KEY;
    if (!rawKey) {
        // No key — use plain fetch (free endpoints only)
        return globalThis.fetch.bind(globalThis);
    }
    const key = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);
    const account = privateKeyToAccount(key);
    const client = Mppx.create({
        methods: [tempo({ account })],
        polyfill: false,
    });
    return client.fetch;
}
const mppxFetch = buildFetch();
async function apiGet(path) {
    const res = await mppxFetch(`${PELLET_API}${path}`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Pellet API error ${res.status}: ${JSON.stringify(body)}`);
    }
    return res.json();
}
/** Search for tokens on Tempo by symbol or name */
export async function searchTokens(query) {
    return apiGet(`/api/v1/tokens?q=${encodeURIComponent(query)}`);
}
/** Get market data, safety flags, and compliance for a Tempo token */
export async function lookupToken(address) {
    return apiGet(`/api/v1/tokens/${encodeURIComponent(address)}`);
}
/** Deep briefing: origin, holders, compliance, analyst note ($0.05 pathUSD) */
export async function analyzeToken(address) {
    return apiGet(`/api/v1/tokens/${encodeURIComponent(address)}/briefing`);
}
/** Full Tempo stablecoin matrix */
export async function getStablecoins() {
    return apiGet("/api/v1/stablecoins");
}
/** Net directional flows between Tempo stablecoins */
export async function getStablecoinFlows(hours = 24) {
    return apiGet(`/api/v1/stablecoins/flows?hours=${hours}`);
}
