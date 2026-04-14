// Seeds the reserves table with categorization + attestation sources for each
// known Tempo stablecoin. Leaves backing_usd null until we wire issuer APIs.
// Run: node --env-file=.env.local scripts/seed-reserves.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

// One record per (stable, reserve_type). Multiple rows per stable are fine if
// the backing is composite (e.g. some protocol-native + some external).
const seeds = [
  // pathUSD — Tempo's native stable, protocol-minted against other collateral in treasury
  {
    stable: "0x20c0000000000000000000000000000000000000",
    reserve_type: "protocol_native",
    attestation_source: "https://tempo.xyz",
    notes: { label: "Tempo native stable", backing_model: "Protocol-minted against treasury assets; not a 1:1 fiat-backed stable." },
  },
  // USDC.e — Stargate-bridged Circle USDC
  {
    stable: "0x20c000000000000000000000b9537d11c60e8b50",
    reserve_type: "bridged_fiat",
    attestation_source: "https://www.circle.com/transparency",
    notes: { label: "Bridged Circle USDC (via Stargate)", issuer: "Circle", backing_model: "Circle reserves: cash + short-duration US Treasury bills. Monthly attestations by Deloitte." },
  },
  // EURC.e — Stargate-bridged Circle EURC
  {
    stable: "0x20c0000000000000000000001621e21f71cf12fb",
    reserve_type: "bridged_fiat",
    attestation_source: "https://www.circle.com/transparency",
    notes: { label: "Bridged Circle EURC (via Stargate)", issuer: "Circle", backing_model: "Circle EUR reserves with monthly attestations." },
  },
  // USDT0 — Tether's native Tempo deployment
  {
    stable: "0x20c00000000000000000000014f22ca97301eb73",
    reserve_type: "fiat_backed",
    attestation_source: "https://tether.to/en/transparency",
    notes: { label: "Tether USDT on Tempo", issuer: "Tether", backing_model: "Mixed reserves: US Treasury bills, cash, secured loans, other investments. Quarterly attestations by BDO." },
  },
  // frxUSD — Frax Finance stable
  {
    stable: "0x20c0000000000000000000003554d28269e0f3c2",
    reserve_type: "crypto_mixed",
    attestation_source: "https://facts.frax.finance",
    notes: { label: "Frax USD", issuer: "Frax Finance", backing_model: "Hybrid: portfolio of stablecoins (USDC), yield-bearing assets, protocol AMO holdings." },
  },
  // cUSD — Cap Protocol USD
  {
    stable: "0x20c0000000000000000000000520792dcccccccc",
    reserve_type: "crypto_backed",
    attestation_source: null,
    notes: { label: "Cap USD", issuer: "Cap Protocol", backing_model: "Crypto-collateralized; mint/redeem via protocol vault. Reserve composition per Cap docs." },
  },
  // stcUSD — Staked Cap USD (yield-bearing)
  {
    stable: "0x20c0000000000000000000008ee4fcff88888888",
    reserve_type: "yield_wrapper",
    attestation_source: null,
    notes: { label: "Staked Cap USD", backing_model: "Yield-bearing wrapper over cUSD; backing = underlying cUSD + accrued yield." },
  },
  // GUSD — Generic USD (on-chain identifier)
  {
    stable: "0x20c0000000000000000000005c0bac7cef389a11",
    reserve_type: "unknown",
    attestation_source: null,
    notes: { label: "Generic USD", backing_model: "Issuer and backing model not yet mapped by Pellet. Pending issuer disclosure." },
  },
  // rUSD — Reservoir stablecoin
  {
    stable: "0x20c0000000000000000000007f7ba549dd0251b9",
    reserve_type: "crypto_backed",
    attestation_source: "https://docs.reservoir.xyz",
    notes: { label: "Reservoir USD", issuer: "Reservoir Protocol", backing_model: "Overcollateralized by Reservoir protocol vaults. On-chain backing verifiable via Reservoir contracts." },
  },
  // wsrUSD — Wrapped Savings rUSD
  {
    stable: "0x20c000000000000000000000aeed2ec36a54d0e5",
    reserve_type: "yield_wrapper",
    attestation_source: "https://docs.reservoir.xyz",
    notes: { label: "Wrapped Savings rUSD", backing_model: "Yield-bearing wrapper over rUSD savings position. Backing = underlying rUSD + accrued savings yield." },
  },
  // EURAU — AllUnity EUR
  {
    stable: "0x20c0000000000000000000009a4a4b17e0dc6651",
    reserve_type: "fiat_backed",
    attestation_source: "https://allunity.com",
    notes: { label: "AllUnity EUR", issuer: "AllUnity", backing_model: "EUR-pegged stable backed 1:1 by EUR bank deposits per AllUnity disclosures." },
  },
  // reUSD — Re Protocol
  {
    stable: "0x20c000000000000000000000383a23bacb546ab9",
    reserve_type: "protocol_native",
    attestation_source: null,
    notes: { label: "Re Protocol USD", issuer: "Re Protocol", backing_model: "Protocol-native; backing model published by Re Protocol team." },
  },
];

for (const s of seeds) {
  await sql`
    INSERT INTO reserves (
      stable, reserve_type, attestation_source, verified_by, notes, updated_at
    ) VALUES (
      ${s.stable.toLowerCase()},
      ${s.reserve_type},
      ${s.attestation_source},
      ${"pellet_curated"},
      ${JSON.stringify(s.notes)}::jsonb,
      NOW()
    )
    ON CONFLICT (stable, reserve_type) DO UPDATE SET
      attestation_source = EXCLUDED.attestation_source,
      verified_by = EXCLUDED.verified_by,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `;
  console.log(`seed ${s.stable.slice(0, 10)}... ${s.reserve_type}`);
}

console.log(`\nSeeded ${seeds.length} reserve entries across ${new Set(seeds.map(s => s.stable)).size} stablecoins.`);
