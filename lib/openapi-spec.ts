// USDC.e: ecosystem-standard MPP payment currency on Tempo (see tempoxyz/mpp)
const USDC_E = "0x20c000000000000000000000b9537d11c60e8b50";

export const spec = {
  openapi: "3.1.0",
  info: {
    title: "Pellet API",
    version: "1.0.0",
    description:
      "Open-Ledger Intelligence (OLI) on Tempo. Direct on-chain measurement for every TIP-20 stablecoin — peg spread vs pathUSD, TIP-403 policy enforcement (allowlist / blocklist / compound), supply cap + headroom, reserve composition + attestation, TIP-20 reward attribution + effective APY, fee-token economics, composite risk score (0–100) with explainable sub-scores, DEX flow topology, cross-stable flow anomalies (z-score thresholds), peg-break events, role-holder enumeration, and historical time-travel via ?as_of=. Every numeric value is a measurement, not an estimate; null means unmeasured (never inferred as zero). 14 free endpoints + one $0.05 MPP-paid deep briefing. Aggregator-grade data without the aggregator layer — built for agents that care about the difference between a bridged token's actual peg and an oracle's idea of it.",
    contact: {
      url: "https://pelletfi.com",
    },
    "x-guidance": [
      "All endpoints return JSON. CORS is open. No API key needed for free endpoints.",
      "Paid endpoints require an MPP payment in USDC.e on Tempo (currency 0x20c000000000000000000000b9537d11c60e8b50). Standard MPP clients (mppx, tempo-request CLI) auto-handle the 402 challenge and payment voucher exchange. Clients funded only in pathUSD can swap via Tempo's enshrined DEX before calling.",
      "Addresses are 0x-prefixed 42-char hex. Stablecoin addresses on Tempo start with 0x20c0... (TIP-20 factory pattern).",
      "For peg, risk, and reserves endpoints, ?as_of=<ISO8601|epoch|relative> returns historical snapshots. See /docs/methodology#time-travel for format.",
      "Every numeric value is a direct on-chain measurement, not an estimate. When a measurement is unavailable, the field returns null with an explanatory note — never a synthetic estimate.",
      "See https://pelletfi.com/docs/oli for the Open-Ledger Intelligence discipline specification.",
    ].join(" "),
  },
  "x-service-info": {
    name: "Pellet",
    categories: ["blockchain", "data"],
    tags: [
      "pellet",
      "pellet-finance",
      "stablecoin",
      "stablecoins",
      "stablecoin-intelligence",
      "open-ledger-intelligence",
      "oli",
      "tempo",
      "tip-20",
      "tip-403",
      "peg",
      "policy",
      "compliance",
      "reserves",
      "rewards",
      "flows",
      "flow-anomalies",
      "risk",
      "fee-economics",
      "briefing",
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
  security: [{ NoPayment: [] }],
  paths: {
    "/api/v1/tokens": {
      get: {
        operationId: "listTokens",
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
        summary: "Token detail — market, safety, compliance, holders",
        description:
          "Aggregates market data (GeckoTerminal), safety scan (bytecode + simulation), TIP-20 compliance metadata, and holder concentration for any Tempo token address.",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description: "Token contract address (0x-prefixed, 42 hex chars)",
            schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" },
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
        summary: "Single stablecoin detail",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description: "Stablecoin contract address (0x-prefixed, 42 hex chars). Tempo stablecoins are deployed via the TIP-20 factory and share a 0x20c0… prefix.",
            schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" },
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
        summary: "Current peg + 1h/24h/7d rolling aggregates vs pathUSD",
        description:
          "Most recent on-chain peg sample (direct DEX measurement via the enshrined pathUSD pool) plus rolling-window stats over 1h, 24h, and 7d: mean price, stddev, max deviation in basis points, and seconds spent outside the ±10bps and ±50bps bands. Supports historical snapshots via `?as_of=<ISO8601|epoch|relative>`.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          {
            name: "as_of",
            in: "query",
            required: false,
            description: "Optional historical snapshot timestamp. ISO8601, epoch seconds, or relative (e.g. '1h', '24h', '7d').",
            schema: { type: "string", example: "24h" },
          },
        ],
        responses: {
          "200": {
            description: "Peg statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    as_of: { type: ["string", "null"], format: "date-time" },
                    current: {
                      type: "object",
                      properties: {
                        price_vs_pathusd: { type: "number", description: "Current price vs pathUSD (1.0 = exact peg)" },
                        spread_bps: { type: "integer", description: "Deviation in basis points; positive = above peg" },
                        block_number: { type: "integer" },
                        sampled_at: { type: "string", format: "date-time" },
                      },
                    },
                    windows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          window: { type: "string", enum: ["1h", "24h", "7d"] },
                          computed_at: { type: "string", format: "date-time" },
                          sample_count: { type: "integer" },
                          mean_price: { type: "number" },
                          stddev_price: { type: "number", description: "In decimal (not bps)" },
                          max_deviation_bps: { type: "number" },
                          seconds_outside_10bps: { type: "integer" },
                          seconds_outside_50bps: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Stablecoin not tracked" },
        },
      },
    },
    "/api/v1/stablecoins/{address}/peg-events": {
      get: {
        operationId: "getStablecoinPegEvents",
        summary: "Detected peg-break events with severity and duration",
        description:
          "Timeline of detected peg-break events for the stablecoin. Severity is `mild` (>10bps for ≥5min) or `severe` (>50bps for ≥1min). Ongoing events have `ended_at: null`. Supports historical windows via `?as_of=`.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20, example: 20 } },
        ],
        responses: {
          "200": {
            description: "Peg events",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    as_of: { type: ["string", "null"], format: "date-time" },
                    events: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          severity: { type: "string", enum: ["mild", "severe"] },
                          started_at: { type: "string", format: "date-time" },
                          ended_at: { type: ["string", "null"], format: "date-time" },
                          duration_seconds: { type: ["integer", "null"] },
                          max_deviation_bps: { type: "number" },
                          started_block: { type: "integer" },
                          ended_block: { type: ["integer", "null"] },
                          ongoing: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stablecoins/{address}/risk": {
      get: {
        operationId: "getStablecoinRisk",
        summary: "Composite risk score (0–100) with explainable sub-scores",
        description:
          "Weighted composite risk score (0–100, higher = more risk) with explainable components: peg_risk (24h peg deviation behaviour), peg_break_risk (severity + frequency of recent peg-break events), supply_risk (headroom against cap + recent mint velocity), policy_risk (active pause + policy-admin concentration). Supports historical snapshots via `?as_of=`.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          {
            name: "as_of",
            in: "query",
            required: false,
            description: "Optional historical snapshot timestamp.",
            schema: { type: "string", example: "7d" },
          },
        ],
        responses: {
          "200": {
            description: "Risk score",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    as_of: { type: ["string", "null"], format: "date-time" },
                    composite: { type: "number", minimum: 0, maximum: 100 },
                    components: {
                      type: "object",
                      properties: {
                        peg_risk: { type: "number" },
                        peg_break_risk: { type: "number" },
                        supply_risk: { type: "number" },
                        policy_risk: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Score not yet computed — check /api/v1/system/health for pipeline status" },
        },
      },
    },
    "/api/v1/stablecoins/{address}/reserves": {
      get: {
        operationId: "getStablecoinReserves",
        summary: "Reserve / backing breakdown with attestation provenance",
        description:
          "Total Tempo-side backing in USD + per-reserve-type entries. Each entry cites `attestation_source` (URL to issuer attestation), issuer, and backing model. Curated — only populated for stables Pellet actively tracks; returns empty entries for others. Supports historical snapshots via `?as_of=`.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          {
            name: "as_of",
            in: "query",
            required: false,
            description: "Optional historical snapshot timestamp.",
            schema: { type: "string", example: "30d" },
          },
        ],
        responses: {
          "200": {
            description: "Reserve breakdown",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    as_of: { type: ["string", "null"], format: "date-time" },
                    total_backing_usd: { type: ["number", "null"] },
                    reserves: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          reserve_type: { type: "string", description: "e.g. 'fiat', 'treasury', 'crypto-collateral'" },
                          backing_usd: { type: ["number", "null"] },
                          attestation_source: { type: ["string", "null"], format: "uri" },
                          attested_at: { type: ["string", "null"], format: "date-time" },
                          notes: {
                            type: "object",
                            properties: {
                              issuer: { type: "string" },
                              backing_model: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stablecoins/{address}/roles": {
      get: {
        operationId: "getStablecoinRoles",
        summary: "Role holders (forensic derivation from on-chain action)",
        description:
          "Current role membership (DEFAULT_ADMIN_ROLE, ISSUER_ROLE, PAUSE_ROLE, UNPAUSE_ROLE, BURN_BLOCKED_ROLE) for a TIP-20 stablecoin. Derivation is forensic: every mint/burn/burnBlocked transaction is inspected and the calling address verified via hasRole() — so holders only appear here once they've actually exercised a role on-chain. Returns coverage status so agents can distinguish 'no role actions yet' from 'role enumeration unsupported'.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
        ],
        responses: {
          "200": {
            description: "Role holders grouped by role",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    coverage: {
                      type: "object",
                      properties: {
                        status: { type: "string", enum: ["partial", "deriving"] },
                        message: { type: "string" },
                        roles_tracked: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              powers: { type: "string" },
                            },
                          },
                        },
                        derivation: { type: "string" },
                      },
                    },
                    roles: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role_name: { type: "string" },
                          role_hash: { type: ["string", "null"] },
                          holder_count: { type: "integer" },
                          holders: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                holder: { type: "string" },
                                holder_label: { type: ["string", "null"] },
                                holder_category: { type: ["string", "null"] },
                                granted_at: { type: ["string", "null"], format: "date-time" },
                                granted_tx_hash: { type: ["string", "null"] },
                                source: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stablecoins/{address}/rewards": {
      get: {
        operationId: "getStablecoinRewards",
        summary: "TIP-20 reward distribution + effective APY",
        description:
          "On-chain reward data for a TIP-20 stablecoin using the reward precompile: total opted-in supply, global reward-per-token accumulator, recent distribution events with funder attribution, and annualized effective APY computed from observed emissions over opted-in supply. Null fields when not applicable (e.g., non-incentivized stables). First-mover category — no competitor currently tracks Tempo-native reward attribution at this granularity. Supports historical snapshots via `?as_of=`.",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          {
            name: "as_of",
            in: "query",
            required: false,
            description: "Optional historical snapshot timestamp.",
            schema: { type: "string", example: "7d" },
          },
        ],
        responses: {
          "200": {
            description: "Reward data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    as_of: { type: ["string", "null"], format: "date-time" },
                    opted_in_supply: { type: "string", description: "Raw uint256 — divide by decimals for human form" },
                    global_reward_per_token: { type: ["string", "null"] },
                    effective_apy: { type: ["number", "null"], description: "Annualized yield on opted-in supply, or null if no emissions in window" },
                    funders: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          address: { type: "string" },
                          label: { type: ["string", "null"] },
                          total_funded: { type: "string" },
                        },
                      },
                    },
                    recent_distributions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          tx_hash: { type: "string" },
                          block_number: { type: "integer" },
                          amount: { type: "string" },
                          funder: { type: "string" },
                          timestamp: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Stablecoin not tracked or has no reward precompile" },
        },
      },
    },
    "/api/v1/stablecoins/flow-anomalies": {
      get: {
        operationId: "getFlowAnomalies",
        summary: "Cross-stable flow anomalies (≥3σ vs 7-day baseline)",
        description:
          "15-minute windows where flow on a (from, to) edge exceeded the 7-day rolling baseline by ≥3 standard deviations. Sorted most recent / largest deviation first. Useful as an early signal before peg breaks or as a trigger for other on-chain investigation.",
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20, example: 20 } },
        ],
        responses: {
          "200": {
            description: "Anomalies",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    as_of: { type: "string", format: "date-time" },
                    anomalies: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          from_token: { type: "string" },
                          to_token: { type: "string" },
                          window_start: { type: "string", format: "date-time" },
                          window_end: { type: "string", format: "date-time" },
                          observed_flow_usd: { type: "number" },
                          baseline_mean_usd: { type: "number" },
                          baseline_stddev_usd: { type: "number" },
                          z_score: { type: "number" },
                          tx_count: { type: "integer" },
                          detected_at: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/system/health": {
      get: {
        operationId: "getSystemHealth",
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
    "/api/v1/addresses/{address}": {
      get: {
        operationId: "getWalletIntelligence",
        summary:
          "Wallet intelligence — label + ERC-8004 agent status + role holdings for any Tempo address",
        description:
          "Single-endpoint intelligence profile for any Tempo address. Combines curated + forensic labels (lib/labels + address_labels), ERC-8004 agent status (Identity Registry at 0x8004A169…), role holdings across tracked TIP-20 stablecoins (issuer / minter / pauser / burn-blocked), and derived per-role summaries (`is_issuer_of`, `is_minter_of`, etc.). Every field has explicit coverage — null is a measurement gap, never inferred absence. Unique to Pellet: ERC-8004 read-through combined with TIP-403 role forensics in one call.",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description: "Any Tempo address (0x-prefixed, 42 hex chars). EOA, contract, or ERC-8004 agent.",
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x0Ce3d541f48c5c6543b84bd2FD9CBae0Fb9FeaFe",
            },
          },
        ],
        responses: {
          "200": {
            description: "Wallet intelligence",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    label: {
                      type: ["object", "null"],
                      properties: {
                        address: { type: "string" },
                        label: { type: "string" },
                        category: { type: "string" },
                        source: { type: "string" },
                        notes: {},
                      },
                    },
                    agent: {
                      type: "object",
                      properties: {
                        is_erc8004_agent: { type: "boolean" },
                        agent_count: { type: "integer" },
                        coverage: { type: "string", enum: ["complete", "unavailable"] },
                        coverage_note: { type: ["string", "null"] },
                      },
                    },
                    roles: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          stable: { type: "string" },
                          role_name: { type: "string" },
                          granted_at: { type: "string", format: "date-time" },
                          granted_tx_hash: { type: "string" },
                        },
                      },
                    },
                    is_issuer_of: { type: "array", items: { type: "string" } },
                    is_minter_of: { type: "array", items: { type: "string" } },
                    is_pauser_of: { type: "array", items: { type: "string" } },
                    is_burn_blocked_by: { type: "array", items: { type: "string" } },
                    stats: {
                      type: "object",
                      properties: {
                        role_count: { type: "integer" },
                        stables_involved: { type: "integer" },
                        erc8004_agent_count: { type: "integer" },
                      },
                    },
                    deferred: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Coverage gaps Pellet has NOT measured yet — agent should consider these open questions, not absence.",
                    },
                    coverage: { type: "string", enum: ["complete", "partial"] },
                    coverage_note: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          "502": { description: "Transient upstream error — retry" },
        },
      },
    },
    "/api/mpp/addresses/{address}": {
      get: {
        operationId: "mppGetWalletIntelligence",
        summary:
          "MPP (free, identity-only) · Wallet intelligence — label + ERC-8004 + roles",
        description:
          "Zero-charge MPP mirror of /api/v1/addresses/{address}. Same response shape; agent signs a $0 identity voucher for MPPScan-ledger accounting. Unique differentiator vs chain-generic wallet APIs (Nansen / Zerion / Codex): ERC-8004 agent status + TIP-403 role forensics in one call, on Tempo.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route - MPP identity challenge, no charge",
        },
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x0Ce3d541f48c5c6543b84bd2FD9CBae0Fb9FeaFe",
            },
          },
        ],
        responses: {
          "200": { description: "Wallet intelligence (same schema as /api/v1/addresses/{address})" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/v1/tip403/simulate": {
      get: {
        operationId: "simulateTransfer",
        summary:
          "Pre-trade compliance oracle — predict if a TIP-20 transfer would revert under TIP-403 policy",
        description:
          "Given a proposed transfer `{from, to, token, amount?}`, returns a structured prediction of whether it would succeed, citing the specific TIP-403 policy id and type, each party's authorization status, and (if amount is provided) whether sender balance is sufficient. Read-only — issues no transactions. Intended to be called before spending gas on a transfer that would otherwise revert. Returns `willSucceed: false` with `blockedBy` = 'policy' | 'balance' | 'not_a_tip20' and `blockedParty` = 'sender' | 'recipient' | null when the transfer would fail. Every numeric value is directly measured on-chain — null when unmeasured, never inferred.",
        parameters: [
          {
            name: "from",
            in: "query",
            required: true,
            description: "Sender address (0x-prefixed, 42 hex chars)",
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x0Ce3d541f48c5c6543b84bd2FD9CBae0Fb9FeaFe",
            },
          },
          {
            name: "to",
            in: "query",
            required: true,
            description: "Recipient address (0x-prefixed, 42 hex chars)",
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x6c90000000000000000000000000000000000bb09",
            },
          },
          {
            name: "token",
            in: "query",
            required: true,
            description:
              "Token contract address. TIP-20 addresses on Tempo use the 0x20c0… factory-deployed pattern.",
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x20c000000000000000000000b9537d11c60e8b50",
            },
          },
          {
            name: "amount",
            in: "query",
            required: false,
            description:
              "Optional raw uint256 decimal string (e.g. '1000000' for 1 USDC.e given 6 decimals). If provided, sender balance is checked after policy authorization.",
            schema: { type: "string", example: "1000000" },
          },
        ],
        responses: {
          "200": {
            description: "Simulation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    willSucceed: {
                      type: ["boolean", "null"],
                      description:
                        "true = pass, false = blocked (see blockedBy), null = unknown (coverage:partial). Do NOT interpret null as false.",
                    },
                    policyId: { type: ["integer", "null"] },
                    policyType: {
                      type: ["string", "null"],
                      enum: ["whitelist", "blacklist", "none", null],
                    },
                    policyAdmin: { type: ["string", "null"] },
                    sender: {
                      type: "object",
                      properties: {
                        address: { type: "string" },
                        authorized: { type: "boolean" },
                      },
                    },
                    recipient: {
                      type: "object",
                      properties: {
                        address: { type: "string" },
                        authorized: { type: "boolean" },
                      },
                    },
                    balance: {
                      type: ["object", "null"],
                      properties: {
                        sufficient: { type: "boolean" },
                        has: { type: "string" },
                        needs: { type: "string" },
                      },
                    },
                    blockedBy: {
                      type: ["string", "null"],
                      enum: [
                        "policy",
                        "balance",
                        "not_a_tip20",
                        "invalid_input",
                        null,
                      ],
                    },
                    blockedParty: {
                      type: ["string", "null"],
                      enum: ["sender", "recipient", null],
                    },
                    reason: { type: "string" },
                    simulatedAtBlock: { type: "string" },
                    coverage: {
                      type: "string",
                      enum: ["complete", "partial"],
                    },
                    coverage_note: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          "400": { description: "Missing required params or invalid address format" },
          "502": { description: "Transient RPC error — retry" },
        },
      },
    },
    // ── MPP mirror routes ──────────────────────────────────────────────────
    // Zero-charge MPP wrappers around the most useful free endpoints. Agents
    // that go through the 402 challenge (proving wallet identity via a signed
    // voucher — no USDC.e transferred) get the same response as the free
    // `/api/v1/*` version. Declared at `authMode: "paid"` with `price:
    // "0.000000"` so MPPScan's activity indexer surfaces them in the
    // directory UI with a "FREE" tag (ecosystem convention). The `/api/v1/*`
    // variants remain available for plain-HTTP consumers.
    "/api/mpp/stablecoins": {
      get: {
        operationId: "mppListStablecoins",
        summary: "MPP (free, identity-only) · Full Tempo stablecoin matrix",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins. Same response shape; client proves wallet identity via a signed $0 voucher. Use this when you want the call to appear in your agent's MPP ledger or when consuming through an MPP-aware client.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          minPrice: "0.000000",
          maxPrice: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        responses: {
          "200": {
            description: "Stablecoin matrix (same shape as /api/v1/stablecoins)",
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
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/stablecoins/flows": {
      get: {
        operationId: "mppGetStablecoinFlows",
        summary: "MPP (free, identity-only) · Stablecoin DEX flow topology",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins/flows. Hourly net flow data between stablecoins routed through the enshrined Tempo DEX precompile.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        parameters: [
          {
            name: "hours",
            in: "query",
            required: false,
            description: "Lookback window in hours (default 24, max 168)",
            schema: { type: "integer", minimum: 1, maximum: 168, default: 24, example: 24 },
          },
        ],
        responses: {
          "200": { description: "Flow data" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/stablecoins/flow-anomalies": {
      get: {
        operationId: "mppGetFlowAnomalies",
        summary: "MPP (free, identity-only) · Cross-stable flow anomalies (≥3σ)",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins/flow-anomalies. 15-minute windows where flow on a (from, to) edge exceeded the 7-day rolling baseline by ≥3 standard deviations.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20, example: 20 } },
        ],
        responses: {
          "200": { description: "Anomalies" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/stablecoins/{address}/peg": {
      get: {
        operationId: "mppGetStablecoinPeg",
        summary: "MPP (free, identity-only) · Peg + 1h/24h/7d aggregates",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins/{address}/peg. Current peg sample + rolling-window stats. Supports historical snapshots via `?as_of=`.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          { name: "as_of", in: "query", required: false, schema: { type: "string", example: "24h" } },
        ],
        responses: {
          "200": { description: "Peg statistics" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/stablecoins/{address}/risk": {
      get: {
        operationId: "mppGetStablecoinRisk",
        summary: "MPP (free, identity-only) · Composite risk score 0–100",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins/{address}/risk. Composite risk score with explainable sub-scores (peg_risk, peg_break_risk, supply_risk, policy_risk). Supports historical snapshots via `?as_of=`.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          { name: "as_of", in: "query", required: false, schema: { type: "string", example: "7d" } },
        ],
        responses: {
          "200": { description: "Risk score" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/stablecoins/{address}/reserves": {
      get: {
        operationId: "mppGetStablecoinReserves",
        summary: "MPP (free, identity-only) · Reserve / backing breakdown",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins/{address}/reserves. Total backing + per-reserve-type entries with attestation source and issuer. Supports historical snapshots via `?as_of=`.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          { name: "as_of", in: "query", required: false, schema: { type: "string", example: "30d" } },
        ],
        responses: {
          "200": { description: "Reserve breakdown" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/tip403/simulate": {
      get: {
        operationId: "mppSimulateTransfer",
        summary:
          "MPP (free, identity-only) · Pre-trade compliance oracle for TIP-20 transfers",
        description:
          "Zero-charge MPP mirror of /api/v1/tip403/simulate. Agents go through the standard 402 identity challenge (signing a $0 voucher) and receive the same simulation result. Use this when you want the call to appear in your agent's MPP ledger or when consuming Pellet through an MPP-aware client. Protocol-level use case: every agent should call this before submitting a TIP-20 transfer, to avoid wasting gas on a revert.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route - MPP identity challenge, no charge",
        },
        parameters: [
          {
            name: "from",
            in: "query",
            required: true,
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x0Ce3d541f48c5c6543b84bd2FD9CBae0Fb9FeaFe",
            },
          },
          {
            name: "to",
            in: "query",
            required: true,
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x6c90000000000000000000000000000000000bb09",
            },
          },
          {
            name: "token",
            in: "query",
            required: true,
            schema: {
              type: "string",
              pattern: "^0x[a-fA-F0-9]{40}$",
              example: "0x20c000000000000000000000b9537d11c60e8b50",
            },
          },
          {
            name: "amount",
            in: "query",
            required: false,
            schema: { type: "string", example: "1000000" },
          },
        ],
        responses: {
          "200": { description: "Simulation result (same schema as /api/v1/tip403/simulate)" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/stablecoins/{address}/rewards": {
      get: {
        operationId: "mppGetStablecoinRewards",
        summary: "MPP (free, identity-only) · TIP-20 reward attribution + APY",
        description:
          "Zero-charge MPP mirror of /api/v1/stablecoins/{address}/rewards. On-chain reward data via the TIP-20 reward precompile: opted-in supply, global reward-per-token, funder attribution, effective APY. First-mover category. Supports historical snapshots via `?as_of=`.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.000000",
          amount: "0",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet free route — MPP identity challenge, no charge",
        },
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", example: "0x20c000000000000000000000b9537d11c60e8b50" } },
          { name: "as_of", in: "query", required: false, schema: { type: "string", example: "7d" } },
        ],
        responses: {
          "200": { description: "Reward data" },
          "402": { description: "MPP identity challenge (no payment required)" },
        },
      },
    },
    "/api/mpp/tokens/{address}/briefing": {
      get: {
        operationId: "mppGetBriefing",
        summary:
          "MPP paid · Deep briefing for any Tempo TIP-20 stablecoin",
        description:
          "MPP-discoverable mirror of /api/v1/tokens/{address}/briefing at the same $0.05 USDC.e price. Identical output — peg, policy, reserves, rewards, risk, flows, role holders, plus a Claude-synthesized analyst note. Lives at /api/mpp/* so MPPScan's directory crawler indexes it alongside the free identity-only routes.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.05",
          minPrice: "0.05",
          maxPrice: "0.05",
          amount: "50000",
          currency: USDC_E,
          protocols: ["mpp"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
          description: "Pellet deep briefing",
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
              "If true, bypasses any cached briefing and forces recomputation.",
            schema: { type: "boolean", default: false },
          },
          {
            name: "sections",
            in: "query",
            required: false,
            description:
              "Comma-separated list of sections to include. Allowed: market, safety, compliance, holders, identity, origin, evaluation. Default: all.",
            schema: { type: "string", example: "market,safety,compliance,holders" },
          },
        ],
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
    "/api/v1/tokens/{address}/briefing": {
      get: {
        operationId: "getBriefing",
        summary:
          "Deep briefing for any Tempo TIP-20 stablecoin — peg, policy, reserves, rewards, risk, flows, role holders, on-chain measured",
        description:
          "Runs the full Pellet Open-Ledger Intelligence (OLI) pipeline for any Tempo TIP-20 stablecoin and returns a structured briefing document covering: live peg spread vs pathUSD (direct on-chain DEX measurement, not oracle estimate), TIP-403 policy enforcement (allowlist / blocklist / compound, pause state, supply cap headroom), reserve and backing breakdown with attestation source, TIP-20 reward attribution and effective APY, fee-token economics, composite risk score (0–100) with explainable sub-scores (peg_risk, peg_break_risk, supply_risk, policy_risk), DEX flow topology and cross-stable flow anomalies, role-holder enumeration (admin / minter / burner), peg-break event history, and a natural-language evaluation. Every numeric value is a direct on-chain measurement — null when unmeasured, never a synthetic estimate. Requires an MPP payment of 0.05 USDC.e on Tempo mainnet.",
        security: [{ MppPayment: [] }],
        "x-payment-info": {
          authMode: "paid",
          price: "0.05",
          minPrice: "0.05",
          maxPrice: "0.05",
          amount: "50000",
          currency: USDC_E,
          protocols: ["x402"],
          intent: "charge",
          method: "tempo",
          network: "tempo",
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
      NoPayment: {
        type: "apiKey",
        in: "header",
        name: "X-Pellet-Public",
        description:
          "No authentication or payment required. Declared as a named scheme so MPPScan recognises an explicit auth-mode declaration on free routes; clients do NOT need to send this header.",
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
