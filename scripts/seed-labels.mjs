// Seeds the address_labels table. Combines:
//  1. Tempo system + protocol contract addresses
//  2. The 12 known TIP-20 stables themselves
//  3. Forensically-discovered ISSUER addresses we've labeled as best we can
// Run: node --env-file=.env.local scripts/seed-labels.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const labels = [
  // System / protocol contracts
  { addr: "0x20fc000000000000000000000000000000000000", label: "TIP-20 Factory", category: "system", source: "pellet_curated", notes: { protocol: "Tempo" } },
  { addr: "0xdec0000000000000000000000000000000000000", label: "Enshrined DEX", category: "system", source: "pellet_curated", notes: { protocol: "Tempo", role: "AMM precompile" } },
  { addr: "0x403c000000000000000000000000000000000000", label: "TIP-403 Compliance Registry", category: "system", source: "pellet_curated", notes: { protocol: "Tempo", role: "Policy registry" } },
  { addr: "0xfeec000000000000000000000000000000000000", label: "Fee Manager", category: "system", source: "pellet_curated", notes: { protocol: "Tempo" } },

  // The 12 stables themselves
  { addr: "0x20c0000000000000000000000000000000000000", label: "pathUSD", category: "token", source: "pellet_curated", notes: { issuer: "Tempo Protocol", type: "protocol-native quote token" } },
  { addr: "0x20c000000000000000000000b9537d11c60e8b50", label: "USDC.e (Bridged Circle USDC)", category: "token", source: "pellet_curated", notes: { issuer: "Circle (via Stargate bridge)" } },
  { addr: "0x20c0000000000000000000001621e21f71cf12fb", label: "EURC.e (Bridged Circle EURC)", category: "token", source: "pellet_curated", notes: { issuer: "Circle (via Stargate bridge)" } },
  { addr: "0x20c00000000000000000000014f22ca97301eb73", label: "USDT0 (Tether USDT on Tempo)", category: "token", source: "pellet_curated", notes: { issuer: "Tether" } },
  { addr: "0x20c0000000000000000000003554d28269e0f3c2", label: "frxUSD (Frax USD)", category: "token", source: "pellet_curated", notes: { issuer: "Frax Finance" } },
  { addr: "0x20c0000000000000000000000520792dcccccccc", label: "cUSD (Cap Protocol USD)", category: "token", source: "pellet_curated", notes: { issuer: "Cap Protocol" } },
  { addr: "0x20c0000000000000000000008ee4fcff88888888", label: "stcUSD (Staked Cap USD)", category: "token", source: "pellet_curated", notes: { issuer: "Cap Protocol", type: "yield wrapper" } },
  { addr: "0x20c0000000000000000000005c0bac7cef389a11", label: "GUSD (Generic USD)", category: "token", source: "pellet_curated", notes: { issuer: "Undisclosed" } },
  { addr: "0x20c0000000000000000000007f7ba549dd0251b9", label: "rUSD (Reservoir USD)", category: "token", source: "pellet_curated", notes: { issuer: "Reservoir Protocol" } },
  { addr: "0x20c000000000000000000000aeed2ec36a54d0e5", label: "wsrUSD (Wrapped Savings rUSD)", category: "token", source: "pellet_curated", notes: { issuer: "Reservoir Protocol", type: "yield wrapper" } },
  { addr: "0x20c0000000000000000000009a4a4b17e0dc6651", label: "EURAU (AllUnity EUR)", category: "token", source: "pellet_curated", notes: { issuer: "AllUnity" } },
  { addr: "0x20c000000000000000000000383a23bacb546ab9", label: "reUSD (Re Protocol)", category: "token", source: "pellet_curated", notes: { issuer: "Re Protocol" } },

  // Forensically-discovered issuer/bridge contracts
  {
    addr: "0x8c76e2f6c5ceda9aa7772e7eff30280226c44392",
    label: "Stargate USDC Bridge Mint Authority",
    category: "bridge",
    source: "forensic",
    notes: {
      role: "Holds ISSUER_ROLE on USDC.e",
      operator: "Stargate (LayerZero)",
      derivation: "Direct caller of mint() on USDC.e in every bridge tx; verified via hasRole()",
      stable: "0x20c000000000000000000000b9537d11c60e8b50",
    },
  },
  {
    addr: "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff",
    label: "Tether USDT0 Mint Authority",
    category: "issuer",
    source: "forensic",
    notes: {
      role: "Holds ISSUER_ROLE on USDT0",
      operator: "Tether",
      derivation: "Direct caller of mint() on USDT0; verified via hasRole()",
      stable: "0x20c00000000000000000000014f22ca97301eb73",
    },
  },

  // Common bridge/router contracts referenced in mint chains
  {
    addr: "0xf851abca1d0fd1df8eaba6de466a102996b7d7b2",
    label: "Stargate Router (Tempo)",
    category: "bridge",
    source: "forensic",
    notes: { role: "User-facing entrypoint for bridge transfers; not a direct role-holder" },
  },
];

let inserted = 0;
for (const l of labels) {
  await sql`
    INSERT INTO address_labels (address, label, category, source, notes, updated_at)
    VALUES (${l.addr.toLowerCase()}, ${l.label}, ${l.category}, ${l.source}, ${JSON.stringify(l.notes)}::jsonb, NOW())
    ON CONFLICT (address) DO UPDATE SET
      label = EXCLUDED.label,
      category = EXCLUDED.category,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `;
  inserted += 1;
}
console.log(`Seeded ${inserted} address labels.`);
