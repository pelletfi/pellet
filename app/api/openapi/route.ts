import { NextResponse } from "next/server";

// USDC.e: ecosystem-standard MPP payment currency on Tempo (see tempoxyz/mpp)
const USDC_E = "0x20c000000000000000000000b9537d11c60e8b50";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Pellet API",
    version: "1.0.0",
    description:
      "Open-Ledger Intelligence (OLI) on Tempo. Every peg, policy, reserve, reward, flow, and risk signal for every TIP-20 stablecoin — measured directly on-chain, not estimated from oracles. Payment-gated deep briefings via MPP in USDC.e.",
    contact: {
      url: "https://pelletfi.com",
    },
    "x-guidance": [
      "All endpoints return JSON. CORS is open. No API key needed for free endpoints.",
      "Paid endpoints require an MPP payment in USDC.e on Tempo (currency 0x20c000000000000000000000b9537d11c60e8b50). Standard MPP clients (mppx, tempo-request CLI) auto-handle the 402 challenge and payment voucher exchange.",
      "Addresses are 0x-prefixed 42-char hex. Stablecoin addresses on Tempo start with 0x20c0... (TIP-20 factory pattern).",
      "For peg, risk, and reserves endpoints, ?as_of=<ISO8601|epoch|relative> returns historical snapshots. See /docs/methodology#time-travel for format.",
      "Every numeric value is a direct on-chain measurement, not an estimate. When a measurement is unavailable, the field returns null with an explanatory note — never a synthetic estimate.",
      "See https://pelletfi.com/docs/oli for the Open-Ledger Intelligence discipline specification.",
    ].join(" "),
  },
  "x-service-info": {
    categories: ["blockchain", "data"],
    tags: [
      "stablecoin",
      "tempo",
      "oli",
      "peg",
      "compliance",
      "tip-20",
      "tip-403",
      "flows",
      "risk",
      "reserves",
      "rewards",
      "fee-economics",
    ],
    docs: {
      homepage: "https://pelletfi.com",
      apiReference: "https://pelletfi.com/docs/api",
      llms: "https://pelletfi.com/docs/oli",
    },
    provider: { name: "Pellet Finance", url: "https://pelletfi.com" },
    realm: "pelletfi.com",
    chain: "tempo",
  },
  servers: [
    {
      url: "https://pelletfi.com",
      description: "Production",
    },
  ],
  paths: {
    "/api/v1/tokens": {
      get: {
        operationId: "listTokens",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "List or search Tempo tokens",
        description:
          "Returns top tokens by 24h volume, or search results when `?q=` is provided.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            description: "Token name, symbol, or address",
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            description: "Page number for volume-sorted listing (default 1)",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Token list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tokens: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          address: { type: "string" },
                          price_usd: { type: "number" },
                          liquidity_usd: { type: "number" },
                          volume_24h: { type: "number" },
                        },
                      },
                    },
                    page: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/tokens/{address}": {
      get: {
        operationId: "getToken",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Token detail — market, safety, compliance, holders",
        description:
          "Aggregates market data (GeckoTerminal), safety scan (bytecode + simulation), TIP-20 compliance metadata, and holder concentration for any Tempo token address.",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description: "Token contract address (0x…)",
            schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
          },
        ],
        responses: {
          "200": {
            description: "Token detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    token_type: { type: "string", enum: ["tip20", "erc20"] },
                    market: {
                      type: "object",
                      properties: {
                        price_usd: { type: "number" },
                        volume_24h: { type: "number" },
                        liquidity_usd: { type: "number" },
                        fdv_usd: { type: ["number", "null"] },
                        price_change_24h: { type: ["number", "null"] },
                        pool_count: { type: "integer" },
                      },
                    },
                    safety: {
                      type: "object",
                      properties: {
                        score: { type: "integer", minimum: 0, maximum: 100 },
                        verdict: {
                          type: "string",
                          enum: [
                            "LOW_RISK",
                            "CAUTION",
                            "MEDIUM_RISK",
                            "HIGH_RISK",
                            "CRITICAL",
                          ],
                        },
                        flags: { type: "array", items: { type: "string" } },
                        warnings: { type: "array", items: { type: "string" } },
                        can_buy: { type: "boolean" },
                        can_sell: { type: "boolean" },
                        honeypot: { type: "boolean" },
                      },
                    },
                    compliance: {
                      type: "object",
                      properties: {
                        policy_type: {
                          type: ["string", "null"],
                          enum: ["whitelist", "blacklist", "compound", null],
                        },
                        paused: { type: "boolean" },
                        supply_cap: { type: ["string", "null"] },
                        headroom_pct: { type: ["number", "null"] },
                      },
                    },
                    holders: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        top5_pct: { type: "number" },
                        top10_pct: { type: "number" },
                        creator: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid address format" },
          "502": { description: "Upstream aggregation failed" },
        },
      },
    },
    "/api/v1/stablecoins": {
      get: {
        operationId: "listStablecoins",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Stablecoin matrix — all tracked Tempo stablecoins",
        description:
          "Returns live data for all known Tempo stablecoins: supply, headroom, policy, DEX spread, and opted-in supply.",
        responses: {
          "200": {
            description: "Stablecoin matrix",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    stablecoins: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StablecoinData" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stablecoins/flows": {
      get: {
        operationId: "getStablecoinFlows",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Stablecoin DEX flow data",
        description:
          "Returns hourly net flow data between stablecoins routed through the enshrined Tempo DEX precompile.",
        parameters: [
          {
            name: "hours",
            in: "query",
            required: false,
            description: "Lookback window in hours (default 24, max 168)",
            schema: { type: "integer", minimum: 1, maximum: 168, default: 24 },
          },
        ],
        responses: {
          "200": {
            description: "Flow data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    flows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          from_token: { type: "string" },
                          to_token: { type: "string" },
                          net_flow_usd: { type: "number" },
                          tx_count: { type: "integer" },
                          hour: { type: "string", format: "date-time" },
                        },
                      },
                    },
                    hours: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stablecoins/{address}": {
      get: {
        operationId: "getStablecoin",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Single stablecoin detail",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description: "Stablecoin contract address (0x…)",
            schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
          },
        ],
        responses: {
          "200": {
            description: "Stablecoin detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StablecoinData" },
              },
            },
          },
          "404": { description: "Stablecoin not found" },
        },
      },
    },
    "/api/v1/stablecoins/{address}/peg": {
      get: {
        operationId: "getStablecoinPeg",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Current peg + 1h/24h/7d aggregates",
        description:
          "Returns the most recent peg sample and rolling-window stats: mean price, standard deviation, max deviation in basis points, and time spent outside ±10bps and ±50bps thresholds.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
        ],
        responses: { "200": { description: "Peg statistics", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/v1/stablecoins/{address}/peg-events": {
      get: {
        operationId: "getStablecoinPegEvents",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Detected peg-break events",
        description:
          "Timeline of detected peg-break events for the stablecoin. Severity is `mild` (>10bps for ≥5min) or `severe` (>50bps for ≥1min). Ongoing events have `ended_at: null`.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: { "200": { description: "Peg events", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/v1/stablecoins/{address}/risk": {
      get: {
        operationId: "getStablecoinRisk",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Composite risk score (0–100)",
        description:
          "Weighted composite risk score with explainable components (peg_risk, peg_break_risk, supply_risk, policy_risk). Higher = more risk.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
        ],
        responses: {
          "200": { description: "Risk score", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "Score not yet computed" },
        },
      },
    },
    "/api/v1/stablecoins/{address}/reserves": {
      get: {
        operationId: "getStablecoinReserves",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Reserve / backing breakdown",
        description:
          "Returns total backing in USD plus per-reserve-type entries with attestation source, issuer, and backing model.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
        ],
        responses: { "200": { description: "Reserves", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/v1/stablecoins/{address}/roles": {
      get: {
        operationId: "getStablecoinRoles",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Role holders",
        description:
          "Current role membership (admin, minter, burner, etc.) for a stablecoin. May return empty if Tempo's TIP-20 implementation does not expose role enumeration.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
        ],
        responses: { "200": { description: "Role holders grouped by role", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/v1/stablecoins/flow-anomalies": {
      get: {
        operationId: "getFlowAnomalies",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Recent cross-stable flow anomalies",
        description:
          "Returns 15-minute windows where flow on a (from, to) edge exceeded the 7-day rolling baseline by ≥3σ. Sorted most recent / largest deviation first.",
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: { "200": { description: "Anomalies", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/v1/system/health": {
      get: {
        operationId: "getSystemHealth",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Pellet ingestion + cron health",
        description:
          "Public health endpoint backed by the heartbeat monitor. Returns 200 if ok, 503 if cursor lag or peg sample staleness exceeds threshold. Suitable as an uptime probe.",
        responses: {
          "200": { description: "Healthy", content: { "application/json": { schema: { type: "object" } } } },
          "503": { description: "Drift detected" },
        },
      },
    },
    "/api/v1/health": {
      get: {
        operationId: "health",
        "x-payment-info": { authMode: "free" },
        security: [],
        summary: "Health check",
        description: "Returns Tempo RPC connectivity status and latest block number.",
        responses: {
          "200": {
            description: "Healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["ok"] },
                    chain: { type: "string" },
                    block: { type: "integer" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "503": { description: "RPC unavailable" },
        },
      },
    },
    "/api/v1/tokens/{address}/briefing": {
      get: {
        operationId: "getBriefing",
        summary: "Full Pellet Briefing — paid endpoint",
        description:
          "Runs the full 8-aggregator pipeline (market, safety, compliance, holders, identity, origin, supply history, evaluation) and returns a structured briefing document. Requires an MPP payment of 0.05 USDC.e on Tempo.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          amount: "50000",
          currency: USDC_E,
          intent: "charge",
          method: "tempo",
          description: "Pellet deep briefing — 8 aggregators + model synthesis",
        },
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description:
              "Token contract address (0x-prefixed, 42 hex chars). The token must exist on Tempo mainnet.",
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x20c000000000000000000000b9537d11c60e8b50",
            },
          },
          {
            name: "refresh",
            in: "query",
            required: false,
            description:
              "If true, bypasses any cached briefing and forces recomputation. Default: false (current implementation always computes fresh — this flag is reserved for future caching).",
            schema: { type: "boolean", default: false },
          },
          {
            name: "sections",
            in: "query",
            required: false,
            description:
              "Comma-separated list of sections to include in the response. Allowed values: market, safety, compliance, holders, identity, origin, evaluation. Default: all sections.",
            schema: {
              type: "string",
              example: "market,safety,compliance,holders",
            },
          },
        ],
        requestBody: {
          required: false,
          description:
            "Not used — this is a GET endpoint. Input is conveyed via the `address` path parameter and optional `refresh` / `sections` query parameters.",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: false },
            },
          },
        },
        responses: {
          "200": {
            description: "Pellet Briefing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BriefingResult" },
              },
            },
          },
          "402": {
            description: "Payment required — include MPP credential in WWW-Authenticate",
          },
          "400": { description: "Invalid address" },
          "502": { description: "Pipeline failure" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      MppPayment: {
        type: "http",
        scheme: "MPP",
        description:
          "Merchant Payment Protocol (MPP) on Tempo. Clients exchange a 402 challenge for a signed payment voucher in USDC.e. See https://github.com/tempoxyz/mpp for the spec, or use the mppx / tempo-request CLI for automatic handling.",
      },
    },
    schemas: {
      StablecoinData: {
        type: "object",
        properties: {
          address: { type: "string" },
          name: { type: "string" },
          symbol: { type: "string" },
          currency: { type: "string" },
          policy_id: { type: "integer" },
          policy_type: { type: "string" },
          policy_admin: { type: "string" },
          supply_cap: { type: "string" },
          current_supply: { type: "string" },
          headroom_pct: { type: "number" },
          price_vs_pathusd: { type: "number" },
          spread_bps: { type: "integer" },
          volume_24h: { type: "number" },
          yield_rate: { type: "number" },
          opted_in_supply: { type: "string" },
        },
      },
      BriefingResult: {
        type: "object",
        properties: {
          id: { type: "integer" },
          token_address: { type: "string" },
          market: { type: "object" },
          safety: { type: "object" },
          compliance: { type: "object" },
          holders: { type: "object" },
          identity: { type: "object" },
          origin: { type: "object" },
          evaluation: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
