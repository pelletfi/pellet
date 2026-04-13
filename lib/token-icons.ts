/**
 * Token icon resolver for Tempo.
 *
 * Resolution order:
 * 1. Official Tempo token list (tokenlist.tempo.xyz)
 * 2. GeckoTerminal token images (CoinGecko-sourced)
 * 3. null → UI shows a letter placeholder
 */

const TOKENLIST_API = "https://tokenlist.tempo.xyz";
const GECKO_API = "https://api.geckoterminal.com/api/v2";
const ENSHRINED_API = "https://launch.enshrined.exchange/api";
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

/** Fetch token images from enshrined launchpad. */
let cachedEnshrined: Map<string, string> | null = null;
async function getEnshrinedImages(): Promise<Map<string, string>> {
  if (cachedEnshrined) return cachedEnshrined;
  try {
    const res = await fetch(`${ENSHRINED_API}/tokens`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new Map();
    const tokens = await res.json();
    const map = new Map<string, string>();
    for (const t of tokens) {
      if (t.address && t.image_uri) {
        map.set(t.address.toLowerCase(), t.image_uri);
      }
    }
    cachedEnshrined = map;
    return map;
  } catch {
    return new Map();
  }
}

/** Fetch token images from GeckoTerminal for a batch of addresses. */
async function getGeckoImages(
  addresses: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (addresses.length === 0) return result;

  // GeckoTerminal multi endpoint accepts up to 30 addresses
  const batch = addresses.slice(0, 30).join(",");
  try {
    const res = await fetch(
      `${GECKO_API}/networks/tempo/tokens/multi/${batch}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return result;
    const data = await res.json();

    for (const token of data.data ?? []) {
      const addr = token.attributes?.address;
      const img = token.attributes?.image_url;
      if (addr && img) {
        result.set(addr.toLowerCase(), img);
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/** Get the icon URL for a single token. Returns null if no icon found. */
export async function getTokenIconUrl(
  address: string
): Promise<string | null> {
  const list = await getTokenList();
  const entry = list.get(address.toLowerCase());
  if (entry?.logoURI) return entry.logoURI;

  // Try enshrined launchpad
  const enshrined = await getEnshrinedImages();
  const enshrinedUrl = enshrined.get(address.toLowerCase());
  if (enshrinedUrl) return enshrinedUrl;

  // Try GeckoTerminal
  const gecko = await getGeckoImages([address]);
  return gecko.get(address.toLowerCase()) ?? null;
}

/** Synchronous version — uses the tokenlist icon endpoint directly.
 *  Only use for tokens known to be in the official list (stablecoins). */
export function getTokenIconUrlSync(address: string): string {
  return `${TOKENLIST_API}/icon/${CHAIN_ID}/${address.toLowerCase()}`;
}

/** Get icon URLs for a batch of addresses (server-side).
 *  Checks Tempo token list first, then GeckoTerminal for the rest. */
export async function getTokenIcons(
  addresses: string[]
): Promise<
  Map<string, { iconUrl: string | null; name: string; symbol: string }>
> {
  const list = await getTokenList();
  const result = new Map<
    string,
    { iconUrl: string | null; name: string; symbol: string }
  >();

  const missingAddresses: string[] = [];

  for (const addr of addresses) {
    const entry = list.get(addr.toLowerCase());
    if (entry?.logoURI) {
      result.set(addr.toLowerCase(), {
        iconUrl: entry.logoURI,
        name: entry.name,
        symbol: entry.symbol,
      });
    } else {
      missingAddresses.push(addr);
      result.set(addr.toLowerCase(), {
        iconUrl: null,
        name: "",
        symbol: "",
      });
    }
  }

  // Batch fetch from enshrined + GeckoTerminal for tokens not in the official list
  if (missingAddresses.length > 0) {
    const [enshrinedImages, geckoImages] = await Promise.all([
      getEnshrinedImages(),
      getGeckoImages(missingAddresses),
    ]);

    for (const addr of missingAddresses) {
      const existing = result.get(addr.toLowerCase());
      if (existing && !existing.iconUrl) {
        existing.iconUrl =
          enshrinedImages.get(addr.toLowerCase()) ??
          geckoImages.get(addr.toLowerCase()) ??
          null;
      }
    }
  }

  return result;
}
