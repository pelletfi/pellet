// Curated allowlist of watched entities for v0.
//
// v0 framing: "agent" loosely covers any autonomous on-chain actor — AI
// agents in the strict sense, plus protocol entities (bridge mint authorities,
// issuer addresses) that fire automatically. The OLI is the interface for
// watching the open ledger; what counts as an agent is how its activity reads
// to a human spectator (autonomous, repeated, programmatic), not the
// implementation underneath.
//
// Seed addresses below are forensically-verified Tempo entities from the
// prior pellet-tempo-archive. Real AI agents get added as they emerge.

export type SeedAgent = {
  id: string;
  label: string;
  source: "curated" | "pellet";
  wallets: string[]; // Tempo addresses, lowercased, 0x + 40 hex chars
  bio: string;
  links: { x?: string; site?: string };
};

export const CURATED_AGENTS: SeedAgent[] = [
  {
    id: "pellet",
    label: "pellet",
    source: "pellet",
    wallets: [], // No on-chain wallet yet; appears in feed via the hourly tick.
    bio: "the agent that runs this terminal.",
    links: { x: "pelletnetwork", site: "pellet.network" },
  },
  {
    id: "stargate-usdc",
    label: "stargate · USDC bridge",
    source: "curated",
    wallets: ["0x8c76e2f6c5ceda9aa7772e7eff30280226c44392"],
    bio: "Stargate USDC.e mint authority. Fires every cross-chain USDC bridge into Tempo.",
    links: {},
  },
  {
    id: "tether-usdt0",
    label: "tether · USDT0 mint",
    source: "curated",
    wallets: ["0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff"],
    bio: "Tether USDT0 mint authority on Tempo.",
    links: {},
  },
  {
    id: "tip20-factory",
    label: "TIP-20 factory",
    source: "curated",
    wallets: ["0x20fc000000000000000000000000000000000000"],
    bio: "Tempo's enshrined TIP-20 factory. Mints every protocol-native token.",
    links: {},
  },
  {
    id: "enshrined-dex",
    label: "enshrined DEX",
    source: "curated",
    wallets: ["0xdec0000000000000000000000000000000000000"],
    bio: "Tempo's enshrined AMM precompile. The launchpad token venue.",
    links: {},
  },
  // Research pass: add real AI agents on Tempo as they emerge. See spec §13.
];
