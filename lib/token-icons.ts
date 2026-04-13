/**
 * Token icon resolver for Tempo.
 * Fetches the official token list and only serves icons for registered tokens.
 * Falls back to null for unknown tokens (UI shows a letter placeholder).
 */

const TOKENLIST_API = "https://tokenlist.tempo.xyz";
const CHAIN_ID = 4217;

interface TokenListEntry {
  address: string;
  name: string;
  symbol: string;
  logoURI: string;
}

let cachedList: Map<string, TokenListEntry> | null = null;

/** Fetch and cache the official Tempo token list. */
async function getTokenList(): Promise<Map<string, TokenListEntry>> {
  if (cachedList) return cachedList;

  try {
    const res = await fetch(`${TOKENLIST_API}/list/${CHAIN_ID}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();

    const tokens: TokenListEntry[] = data.tokens ?? data ?? [];
    const map = new Map<string, TokenListEntry>();
    for (const t of tokens) {
      if (t.address) {
        map.set(t.address.toLowerCase(), t);
      }
    }
    cachedList = map;
    return map;
  } catch {
    return new Map();
  }
}

/** Get the icon URL for a token. Returns null if not in the official list. */
export async function getTokenIconUrl(address: string): Promise<string | null> {
  const list = await getTokenList();
  const entry = list.get(address.toLowerCase());
  if (entry?.logoURI) return entry.logoURI;
  return null;
}

/** Synchronous version — uses the tokenlist icon endpoint directly.
 *  Use this in client components where you can't await. */
export function getTokenIconUrlSync(address: string): string {
  return `${TOKENLIST_API}/icon/${CHAIN_ID}/${address.toLowerCase()}`;
}

/** Get icon + name info for a batch of addresses (server-side). */
export async function getTokenIcons(
  addresses: string[]
): Promise<Map<string, { iconUrl: string | null; name: string; symbol: string }>> {
  const list = await getTokenList();
  const result = new Map<string, { iconUrl: string | null; name: string; symbol: string }>();

  for (const addr of addresses) {
    const entry = list.get(addr.toLowerCase());
    result.set(addr.toLowerCase(), {
      iconUrl: entry?.logoURI ?? null,
      name: entry?.name ?? "",
      symbol: entry?.symbol ?? "",
    });
  }

  return result;
}
