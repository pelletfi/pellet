#!/usr/bin/env node
// Verify /v1/stablecoins returns sane spread_bps values.
// Guards against the "20000 sentinel" bug that was caused by a unit-conversion
// error in lib/pipeline/stablecoins.ts (askPrice formula).
//
// Usage:
//   node scripts/check-spread-bps.mjs                      # hits https://www.pelletfi.com
//   node scripts/check-spread-bps.mjs http://localhost:3000 # hits local dev

const base = process.argv[2] ?? "https://www.pelletfi.com";
const MAX_REASONABLE_BPS = 500; // 5% = implausible for any pegged stable on Tempo

const res = await fetch(`${base}/api/v1/stablecoins`);
if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}

const { stablecoins } = await res.json();
if (!Array.isArray(stablecoins)) {
  console.error("response missing `stablecoins` array");
  process.exit(1);
}

let failed = false;
for (const s of stablecoins) {
  const bps = Number(s.spread_bps);
  const status = bps > MAX_REASONABLE_BPS ? "FAIL" : "ok  ";
  console.log(`  ${status}  ${s.symbol.padEnd(10)}  price=${s.price_vs_pathusd}  spread_bps=${bps}`);
  if (bps > MAX_REASONABLE_BPS) failed = true;
}

if (failed) {
  console.error(`\nFAIL: at least one stable has spread_bps > ${MAX_REASONABLE_BPS} — likely unit-conversion regression in getStablecoinMetadata().`);
  process.exit(2);
}

console.log(`\nOK: all ${stablecoins.length} stables have spread_bps <= ${MAX_REASONABLE_BPS}.`);
