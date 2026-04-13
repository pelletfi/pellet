/** Search for tokens on Tempo by symbol or name */
export declare function searchTokens(query: string): Promise<unknown>;
/** Get market data, safety flags, and compliance for a Tempo token */
export declare function lookupToken(address: string): Promise<unknown>;
/** Deep briefing: origin, holders, compliance, analyst note ($0.05 pathUSD) */
export declare function analyzeToken(address: string): Promise<unknown>;
/** Full Tempo stablecoin matrix */
export declare function getStablecoins(): Promise<unknown>;
/** Net directional flows between Tempo stablecoins */
export declare function getStablecoinFlows(hours?: number): Promise<unknown>;
