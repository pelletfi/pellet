import type { IdentityResult } from "@/lib/types";

/**
 * Resolve token identity via CoinGecko and DefiLlama.
 * Falls back to on-chain name/symbol if both miss.
 */
export async function resolveIdentity(
  address: string,
  onChainName: string,
  onChainSymbol: string
): Promise<IdentityResult> {
  const [cgResult, llamaResult] = await Promise.all([
    fetchCoinGecko(address).catch(() => null),
    fetchDefiLlama(onChainName).catch(() => null),
  ]);

  const name = cgResult?.name ?? onChainName;
  const symbol = cgResult?.symbol ?? onChainSymbol;

  return {
    name,
    symbol,
    description: cgResult?.description ?? llamaResult?.description ?? null,
    image_url: cgResult?.image_url ?? null,
    coingecko_id: cgResult?.coingecko_id ?? null,
    defi_llama_protocol: llamaResult?.slug ?? null,
    links: cgResult?.links ?? {},
  };
}

// --- CoinGecko ---

interface CoinGeckoResult {
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  coingecko_id: string | null;
  links: Record<string, string>;
}

async function fetchCoinGecko(
  address: string
): Promise<CoinGeckoResult | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const url = `https://api.coingecko.com/api/v3/coins/tempo/contract/${address.toLowerCase()}`;
  const res = await fetch(url, {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  if (!data?.id) return null;

  // Build links record from CoinGecko's links object
  const links: Record<string, string> = {};
  const cgLinks = data.links ?? {};
  if (cgLinks.homepage?.[0]) links.website = cgLinks.homepage[0];
  if (cgLinks.twitter_screen_name)
    links.twitter = `https://twitter.com/${cgLinks.twitter_screen_name}`;
  if (cgLinks.telegram_channel_identifier)
    links.telegram = `https://t.me/${cgLinks.telegram_channel_identifier}`;
  if (cgLinks.subreddit_url) links.reddit = cgLinks.subreddit_url;
  if (cgLinks.repos_url?.github?.[0])
    links.github = cgLinks.repos_url.github[0];

  const description = data.description?.en?.trim() || null;

  return {
    name: data.name ?? null,
    symbol: (data.symbol as string)?.toUpperCase() ?? null,
    description: description || null,
    image_url: data.image?.large ?? data.image?.small ?? null,
    coingecko_id: data.id ?? null,
    links,
  };
}

// --- DefiLlama ---

interface DefiLlamaResult {
  slug: string;
  description: string | null;
}

async function fetchDefiLlama(
  tokenName: string
): Promise<DefiLlamaResult | null> {
  const res = await fetch("https://api.llama.fi/protocols", {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const protocols: any[] = await res.json();

  const nameLower = tokenName.toLowerCase();

  // Find a protocol whose name matches and has a Tempo chain entry
  const match = protocols.find((p) => {
    const protocolName: string = (p.name ?? "").toLowerCase();
    if (!protocolName.includes(nameLower) && !nameLower.includes(protocolName))
      return false;
    const chains: string[] = p.chains ?? [];
    return chains.some((c: string) => c.toLowerCase() === "tempo");
  });

  if (!match) return null;

  // Low-confidence filter: skip bridges and marketplaces (they match any token name)
  const category: string = (match.category ?? "").toLowerCase();
  if (
    category.includes("bridge") ||
    category.includes("marketplace") ||
    category.includes("nft")
  ) {
    return null;
  }

  return {
    slug: match.slug ?? match.name,
    description: match.description?.trim() || null,
  };
}
