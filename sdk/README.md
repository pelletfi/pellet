# @pelletfi/sdk

Typed TypeScript client for the [Pellet API](https://pelletfi.com) — Open-Ledger Interface on Tempo.

```bash
npm install @pelletfi/sdk
```

## Quick start

```ts
import { Pellet } from "@pelletfi/sdk";

const pellet = new Pellet();

// Every stablecoin Pellet tracks
const { data: { stablecoins } } = await pellet.stablecoins();

// Per-stable scope is fluent
const usdc = pellet.stablecoin("0x20c000000000000000000000b9537d11c60e8b50");

const { data: peg } = await usdc.peg();
console.log(`USDC.e is at ${peg.current?.price_vs_pathusd} (${peg.current?.spread_bps} bps)`);

const { data: risk } = await usdc.risk();
console.log(`Composite risk: ${risk.composite}/100`);

const { data: roles } = await usdc.roles();
for (const role of roles.roles) {
  for (const h of role.holders) {
    console.log(`${role.role_name}: ${h.holder_label ?? h.holder}`);
  }
}
```

## Reproducibility

Every response includes a `meta` object with everything you need to independently verify the data:

```ts
const { data, meta } = await pellet.stablecoin(addr).peg();

console.log(meta);
// {
//   methodologyVersion: "1.0",
//   computedAt: "2026-04-14T12:00:00Z",
//   method: "peg-aggregates-v1",
//   sourceBlock: 14710001,
//   sourceCall: "quoteSwapExactAmountIn(stable, pathUSD, 1e6)",
//   sourceContracts: ["0xdec0..."],
//   sourceTables: ["peg_samples", "peg_aggregates"],
//   freshnessSec: 60
// }
```

See [pelletfi.com/docs/methodology](https://pelletfi.com/docs/methodology) for the full spec.

## Time-travel queries

Peg, risk, reserves, peg-events, and flow-anomalies accept `{ asOf }` to query historical state:

```ts
// ISO 8601 timestamp
await pellet.stablecoin(addr).peg({ asOf: "2026-04-13T00:00:00Z" });

// Or a relative duration (most convenient)
await pellet.stablecoin(addr).risk({ asOf: "24h" }); // 24 hours ago
await pellet.stablecoin(addr).reserves({ asOf: "7d" });

// Or a Date / unix seconds
await pellet.stablecoin(addr).pegEvents({ asOf: new Date("2026-04-10") });
```

The response `meta.asOf` confirms which frozen slice you got. Risk and reserves time-travel is served from append-only snapshot history — available from when your first cron tick after this was deployed.

## Methods

| Method | Returns |
| --- | --- |
| `pellet.stablecoins()` | List of all tracked stables with risk inline |
| `pellet.stablecoin(addr).detail()` | Single stablecoin metadata |
| `pellet.stablecoin(addr).peg()` | Current peg + 1h/24h/7d aggregates |
| `pellet.stablecoin(addr).pegEvents(limit?)` | Detected peg-break events timeline |
| `pellet.stablecoin(addr).risk()` | Composite risk score + components |
| `pellet.stablecoin(addr).reserves()` | Backing breakdown by reserve type |
| `pellet.stablecoin(addr).rewards()` | TIP-20 reward pool: effective APY, top funders, distributions |
| `pellet.stablecoin(addr).roles()` | Forensically-derived role holders |
| `pellet.flows({ hours? })` | Cross-stable flow data |
| `pellet.flowAnomalies({ limit? })` | Z-score-detected flow anomalies |
| `pellet.feeEconomics()` | Which stables are elected as Tempo fee tokens + revenue share |
| `pellet.address(addr).lookup()` | Address label / entity resolution |
| `pellet.system.health()` | Pellet system health probe |
| `pellet.system.cronRuns()` | Per-pipeline run history + 24h success rate |

## Pellet Pro

If you have a Pellet Pro key, pass it on construction:

```ts
const pellet = new Pellet({ apiKey: "pk_live_..." });
```

This unlocks unlimited rate, paid endpoints (briefings) without MPP signing, and webhook subscription management.

## MPP-paid endpoints

For pay-per-call access via the Micropayment Protocol (no API key, just an EVM key holding USDC.e on Tempo), pass a custom `fetch` implementation built with [mppx](https://github.com/coinbase/mppx):

```ts
import { Pellet } from "@pelletfi/sdk";
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const mppx = Mppx.create({ methods: [tempo({ account })] });

const pellet = new Pellet({ fetch: mppx.fetch });
```

## Errors

All API errors throw `PelletApiError` with `status`, `url`, and `message`:

```ts
import { Pellet, PelletApiError } from "@pelletfi/sdk";

try {
  await pellet.stablecoin("0xnotreal").peg();
} catch (e) {
  if (e instanceof PelletApiError) {
    console.log(e.status); // 400
    console.log(e.url);    // https://pelletfi.com/api/v1/stablecoins/0xnotreal/peg
  }
}
```

## Links

- [Pellet docs](https://pelletfi.com/docs)
- [Methodology v1.0](https://pelletfi.com/docs/methodology)
- [Status](https://pelletfi.com/status)
- [@pelletfi/mcp](https://www.npmjs.com/package/@pelletfi/mcp) — MCP server for AI agents

MIT License.
