// Canonical TIP-20 stablecoin addresses on Tempo. Mirrors what's in
// app/api/v1/stablecoins/route.ts; if/when that list grows, sync here too.
// Addresses are stored lowercase to match agent_events.token_address normalisation.

export const TOKEN_SYMBOLS: Record<string, string> = {
  "0x20c000000000000000000000b9537d11c60e8b50": "USDC.e",
  "0x20c00000000000000000000014f22ca97301eb73": "USDT0",
};

export type TokenBucket = "USDC.e" | "USDT0" | "other";

export function classifyToken(address: string | null | undefined): TokenBucket {
  if (!address) return "other";
  const sym = TOKEN_SYMBOLS[address.toLowerCase()];
  return sym === "USDC.e" || sym === "USDT0" ? sym : "other";
}

// Display colors — restrained palette aligned w/ the rest of Wallet.
export const TOKEN_COLORS: Record<TokenBucket, string> = {
  "USDC.e": "rgba(255, 255, 255, 0.55)",
  USDT0: "rgba(96, 128, 192, 0.60)",
  other: "rgba(255, 255, 255, 0.18)",
};
