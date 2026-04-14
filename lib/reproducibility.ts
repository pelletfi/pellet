import { NextResponse } from "next/server";

// Adds reproducibility headers to any NextResponse so customers can independently
// verify how the data was derived. Three families:
//   X-Pellet-Source       — what RPC call / table the data came from
//   X-Pellet-Computed-At  — when this exact response was assembled
//   X-Pellet-Method       — methodology key (see /docs/methodology)
//   X-Pellet-Methodology-Version — current published methodology version

export const METHODOLOGY_VERSION = "1.0";

interface SourceInfo {
  /** Methodology key — must match a section in /docs/methodology */
  method?: string;
  /** Block number the data was sourced from (if applicable) */
  block?: number | bigint;
  /** RPC call signature, e.g. "quoteSwapExactAmountIn(stable, pathUSD, 1e6)" */
  rpcCall?: string;
  /** Source contract address(es) */
  contracts?: string[];
  /** Source database table(s), e.g. ["peg_aggregates", "peg_samples"] */
  tables?: string[];
  /** Maximum staleness of the response data in seconds */
  freshnessSec?: number;
}

export function withReproducibility<T>(
  response: NextResponse<T>,
  info: SourceInfo,
): NextResponse<T> {
  response.headers.set("X-Pellet-Methodology-Version", METHODOLOGY_VERSION);
  response.headers.set("X-Pellet-Computed-At", new Date().toISOString());
  if (info.method) response.headers.set("X-Pellet-Method", info.method);
  if (info.block != null) response.headers.set("X-Pellet-Source-Block", String(info.block));
  if (info.rpcCall) response.headers.set("X-Pellet-Source-Call", info.rpcCall);
  if (info.contracts && info.contracts.length > 0) {
    response.headers.set("X-Pellet-Source-Contracts", info.contracts.join(","));
  }
  if (info.tables && info.tables.length > 0) {
    response.headers.set("X-Pellet-Source-Tables", info.tables.join(","));
  }
  if (info.freshnessSec != null) {
    response.headers.set("X-Pellet-Freshness-SLA", `${info.freshnessSec}s`);
  }
  return response;
}
