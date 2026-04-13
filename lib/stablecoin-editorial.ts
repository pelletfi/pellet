/**
 * Editorial context for each Tempo stablecoin.
 * Written as short narrative blurbs — origin, backing, and key characteristics.
 */

export interface StablecoinEditorial {
  tagline: string;
  origin: string;
  backing: string;
  backingType: "fiat" | "crypto" | "yield" | "native" | "wrapped";
  issuer: string;
  issuerUrl?: string;
  risks: string[];
  notable: string[];
}

export const STABLECOIN_EDITORIAL: Record<string, StablecoinEditorial> = {
  "0x20c0000000000000000000000000000000000000": {
    tagline: "The neutral quote token. Tempo's native reference currency.",
    origin:
      "pathUSD is the root of Tempo's stablecoin ecosystem — the enshrined neutral quote token that every DEX path routes through. It's not issued by a third party. It's maintained by the protocol itself, backed by redemption into other stablecoins on the DEX.",
    backing: "Protocol-native. Redeemable against any pegged TIP-20 stablecoin via the enshrined DEX.",
    backingType: "native",
    issuer: "Tempo Protocol",
    issuerUrl: "https://tempo.xyz",
    risks: [
      "Peg stability depends on DEX liquidity across paired stablecoins",
      "No external reserves — redeemability is DEX-mediated",
    ],
    notable: [
      "Quote token for all TIP-20 stablecoin pairs",
      "Used for transaction fees on Tempo",
      "Zero-spread self-quote",
    ],
  },

  "0x20c000000000000000000000b9537d11c60e8b50": {
    tagline: "Bridged USDC, routed through Stargate into Tempo.",
    origin:
      "USDC.e is Circle's USDC bridged from Ethereum via Stargate's omnichain protocol. Each USDC.e on Tempo is backed 1:1 by USDC held in Stargate's bridge vaults on the source chain.",
    backing: "1:1 backed by USDC on source chain, locked in Stargate bridge contracts.",
    backingType: "fiat",
    issuer: "Circle (via Stargate bridge)",
    issuerUrl: "https://stargate.finance",
    risks: [
      "Bridge risk — Stargate contracts must remain secure",
      "Upstream risk — depends on Circle's USDC reserves",
      "Liquidity fragmentation across chains",
    ],
    notable: [
      "Most widely-held bridged stablecoin on Tempo",
      "Direct bridge path to mainnet USDC",
      "Compliant with Circle's attestation reports",
    ],
  },

  "0x20c0000000000000000000001621e21f71cf12fb": {
    tagline: "Bridged EURC — Circle's euro stablecoin on Tempo.",
    origin:
      "EURC.e is Circle's euro-denominated stablecoin bridged from Ethereum via Stargate. It represents Tempo's primary on-ramp to euro-denominated settlement.",
    backing: "1:1 backed by EURC on source chain, locked in Stargate bridge contracts.",
    backingType: "fiat",
    issuer: "Circle (via Stargate bridge)",
    issuerUrl: "https://stargate.finance",
    risks: [
      "Bridge risk — Stargate contracts must remain secure",
      "EUR/USD peg slippage affects pathUSD routing",
      "Lower liquidity than USD stablecoins",
    ],
    notable: [
      "Primary euro-denominated stablecoin on Tempo",
      "Enables EUR payment rails",
      "MiCA-aligned backing via Circle",
    ],
  },

  "0x20c00000000000000000000014f22ca97301eb73": {
    tagline: "USDT0 — Tether's native USDT deployment on Tempo.",
    origin:
      "USDT0 is Tether's omnichain USDT implementation, deployed natively on Tempo rather than bridged. Tether manages minting and redemption directly through their own infrastructure.",
    backing: "1:1 backed by Tether's reserves. Audited attestations published quarterly.",
    backingType: "fiat",
    issuer: "Tether Limited",
    issuerUrl: "https://tether.to",
    risks: [
      "Issuer concentration — Tether controls mint/burn",
      "Reserve transparency historically debated",
      "Regulatory exposure in certain jurisdictions",
    ],
    notable: [
      "Native deployment, not a bridged asset",
      "Largest stablecoin issuer globally",
      "Direct liquidity from Tether treasury",
    ],
  },

  "0x20c0000000000000000000003554d28269e0f3c2": {
    tagline: "Frax USD — decentralized stablecoin from the Frax Protocol.",
    origin:
      "frxUSD is Frax Finance's flagship stablecoin, deployed on Tempo as part of Frax's multichain expansion. Originally fractional-algorithmic, now fully collateralized with Treasury bills and USDC.",
    backing: "Fully collateralized: U.S. Treasury bills, USDC, and onchain reserves.",
    backingType: "crypto",
    issuer: "Frax Finance",
    issuerUrl: "https://frax.finance",
    risks: [
      "Protocol governance risk",
      "Smart contract risk in Frax's reserve management",
      "Collateral composition shifts over time",
    ],
    notable: [
      "Transitioned from algorithmic to fully-backed",
      "One of the oldest decentralized stablecoin protocols",
      "Yield-bearing variants available",
    ],
  },

  "0x20c0000000000000000000000520792dcccccccc": {
    tagline: "Cap USD — the base layer for Cap Protocol's yield products.",
    origin:
      "cUSD is Cap Protocol's stablecoin, deployed on Tempo as the foundation of their onchain yield infrastructure. Users deposit cUSD to earn via stcUSD (the staked variant).",
    backing: "1:1 backed by USDC, held in Cap Protocol's custodial vaults.",
    backingType: "wrapped",
    issuer: "Cap Protocol",
    risks: [
      "Custodial risk in Cap's reserves",
      "Protocol-specific staking contracts must remain secure",
      "Yield opportunities depend on Cap's strategy performance",
    ],
    notable: [
      "Pairs with stcUSD for native staking",
      "Tempo-native yield product",
      "Simple 1:1 USD-pegged base layer",
    ],
  },

  "0x20c0000000000000000000008ee4fcff88888888": {
    tagline: "Staked Cap USD — the yield-bearing version of cUSD.",
    origin:
      "stcUSD is the staked version of cUSD. Users stake cUSD to receive stcUSD, which appreciates against cUSD as yield is distributed. Similar to Lido's stETH model.",
    backing: "Backed by cUSD at a variable exchange rate reflecting accumulated yield.",
    backingType: "yield",
    issuer: "Cap Protocol",
    risks: [
      "stcUSD may trade below its theoretical value during market stress",
      "Yield strategies may underperform expectations",
      "Smart contract risk in the staking mechanism",
    ],
    notable: [
      "Yield-bearing — value increases vs cUSD over time",
      "Non-rebasing design",
      "Liquid staking for stablecoin yield",
    ],
  },

  "0x20c0000000000000000000005c0bac7cef389a11": {
    tagline: "Generic USD — a general-purpose USD stablecoin on Tempo.",
    origin:
      "GUSD is positioned as a generic USD stablecoin for applications that need a neutral, low-overhead USD token. Issuer and backing details have limited public disclosure.",
    backing: "1:1 USD-pegged. Backing structure not publicly detailed.",
    backingType: "fiat",
    issuer: "Undisclosed",
    risks: [
      "Limited public information about reserves",
      "Lower transparency than major stablecoins",
      "Smaller liquidity pool",
    ],
    notable: [
      "Generic-purpose design",
      "Part of Tempo's broader USD stablecoin offerings",
    ],
  },

  "0x20c0000000000000000000007f7ba549dd0251b9": {
    tagline: "Reservoir USD — the stablecoin layer for Reservoir Protocol.",
    origin:
      "rUSD is Reservoir's stablecoin, designed as a programmable USD layer for onchain savings and lending applications on Tempo.",
    backing: "Backed by a portfolio of onchain and offchain dollar-denominated assets.",
    backingType: "crypto",
    issuer: "Reservoir Protocol",
    risks: [
      "Complex reserve composition",
      "Protocol-specific smart contract risk",
      "Dependencies on underlying yield sources",
    ],
    notable: [
      "Pairs with wsrUSD for savings yield",
      "Programmable via Reservoir's infrastructure",
      "Tempo-native savings primitive",
    ],
  },

  "0x20c000000000000000000000aeed2ec36a54d0e5": {
    tagline: "Wrapped Savings rUSD — yield-bearing rUSD.",
    origin:
      "wsrUSD wraps the savings version of rUSD. Holders earn yield from Reservoir's underlying savings strategies without claiming or rebasing.",
    backing: "Backed by srUSD (savings rUSD) at a variable exchange rate.",
    backingType: "yield",
    issuer: "Reservoir Protocol",
    risks: [
      "Secondary wrapping layer adds complexity",
      "Underlying yield depends on Reservoir's strategies",
      "Smart contract risk in the wrapping mechanism",
    ],
    notable: [
      "Yield accrues through exchange rate appreciation",
      "Non-rebasing wrapper",
      "Composable with DeFi protocols on Tempo",
    ],
  },

  "0x20c0000000000000000000009a4a4b17e0dc6651": {
    tagline: "AllUnity EUR — a MiCA-compliant euro stablecoin.",
    origin:
      "EURAU is issued by AllUnity, a joint venture between DWS Group, Flow Traders, and Galaxy Digital, focused on regulated EU-compliant euro stablecoin infrastructure. Licensed under MiCA.",
    backing: "Fully backed 1:1 by euro deposits in segregated EU bank accounts. MiCA-licensed.",
    backingType: "fiat",
    issuer: "AllUnity",
    issuerUrl: "https://allunity.com",
    risks: [
      "Regulatory dependency on MiCA framework",
      "Custodian bank risk",
      "Institutional-focused — lower retail liquidity",
    ],
    notable: [
      "First MiCA-licensed euro stablecoin on Tempo",
      "Institutional-grade backing via DWS, Flow Traders, Galaxy",
      "Full EU regulatory compliance",
    ],
  },

  "0x20c000000000000000000000383a23bacb546ab9": {
    tagline: "Re Protocol reUSD — reinsurance-backed stablecoin.",
    origin:
      "reUSD is issued by Re Protocol, which backs the stablecoin with reinsurance capital — a novel collateral type that generates yield from reinsurance premiums rather than traditional debt instruments.",
    backing: "Collateralized by reinsurance capital and related instruments.",
    backingType: "crypto",
    issuer: "Re Protocol",
    risks: [
      "Novel collateral type — reinsurance markets historically opaque",
      "Yield depends on reinsurance claim outcomes",
      "Early-stage protocol with shorter track record",
    ],
    notable: [
      "First reinsurance-backed stablecoin on Tempo",
      "Alternative yield source uncorrelated with crypto markets",
      "Innovative collateral model",
    ],
  },
};

export function getEditorial(address: string): StablecoinEditorial | null {
  return STABLECOIN_EDITORIAL[address.toLowerCase()] ?? null;
}
