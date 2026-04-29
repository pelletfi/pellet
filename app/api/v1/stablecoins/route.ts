import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v0 stub — landing's HeroTerminal queries this. Returns the canonical
// 12-stablecoin list with zeroed metrics so the hero shows familiar names
// without misleading data. Real metrics rebuild when the stablecoin surface
// re-lands.
const STABLECOINS = [
  { address: "0x20c0000000000000000000000000000000000000", name: "pathUSD",  symbol: "pathUSD",  current_supply: "0", price_vs_pathusd: 1.0 },
  { address: "0x20c000000000000000000000b9537d11c60e8b50", name: "USDC.e",   symbol: "USDC.e",   current_supply: "0", price_vs_pathusd: 1.0 },
  { address: "0x20c0000000000000000000001621e21f71cf12fb", name: "EURC.e",   symbol: "EURC.e",   current_supply: "0", price_vs_pathusd: 1.0 },
  { address: "0x20c00000000000000000000014f22ca97301eb73", name: "USDT0",    symbol: "USDT0",    current_supply: "0", price_vs_pathusd: 1.0 },
  { address: "0x20c0000000000000000000003554d28269e0f3c2", name: "frxUSD",   symbol: "frxUSD",   current_supply: "0", price_vs_pathusd: 1.0 },
  { address: "0x20c0000000000000000000000520792dcccccccc", name: "cUSD",     symbol: "cUSD",     current_supply: "0", price_vs_pathusd: 1.0 },
];

export async function GET() {
  return NextResponse.json({ stablecoins: STABLECOINS });
}
