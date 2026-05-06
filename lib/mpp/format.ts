import type { MppOffer } from "./types";

const KNOWN_CURRENCIES: Record<string, { symbol: string; decimals: number }> = {
  "0x20c000000000000000000000b9537d11c60e8b50": { symbol: "pathUSD", decimals: 6 },
  "0x20c0000000000000000000000000000000000000": { symbol: "USDC.e", decimals: 6 },
  "0x20c0000000000000000000000000000000000001": { symbol: "USDC.e", decimals: 6 },
  usd: { symbol: "USD", decimals: 2 },
};

export function formatAmount(offer: MppOffer): string {
  const info = KNOWN_CURRENCIES[offer.currency.toLowerCase()];
  if (!info) return `${offer.amount} (unknown)`;
  if (offer.amount === null || offer.amount === "0") return "Free";

  const raw = BigInt(offer.amount);
  const divisor = BigInt(10 ** info.decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;

  if (frac === BigInt(0)) return `$${whole}.00`;
  const fracStr = frac.toString().padStart(info.decimals, "0").replace(/0+$/, "");
  return `$${whole}.${fracStr}`;
}

export function currencySymbol(currency: string): string {
  return KNOWN_CURRENCIES[currency.toLowerCase()]?.symbol || currency.slice(0, 8) + "…";
}

export function intentLabel(intent: string): string {
  return intent === "session" ? "session" : "per request";
}

export function formatOffer(offer: MppOffer): string {
  return `${formatAmount(offer)} ${intentLabel(offer.intent)}`;
}

export function cheapestOffer(offers: MppOffer[]): MppOffer | null {
  if (offers.length === 0) return null;
  return offers.reduce((min, o) => {
    const a = BigInt(o.amount || "0");
    const b = BigInt(min.amount || "0");
    return a < b ? o : min;
  });
}
