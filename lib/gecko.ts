const BASE_URL = "https://api.geckoterminal.com/api/v2";
const NETWORK = "tempo";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeckoRelationship {
  data: { id: string; type: string } | null;
}

export interface GeckoPool {
  id: string;
  type: "pool";
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string | null;
    quote_token_price_usd: string | null;
    fdv_usd: string | null;
    reserve_in_usd: string | null;
    volume_usd: {
      h24: string | null;
      h6?: string | null;
      h1?: string | null;
      m5?: string | null;
    };
    price_change_percentage: {
      h24: string | null;
      h6?: string | null;
      h1?: string | null;
      m5?: string | null;
    };
    transactions: {
      h24: {
        buys: number;
        sells: number;
        buyers: number;
        sellers: number;
      };
    };
    pool_created_at: string | null;
  };
  relationships: {
    base_token: GeckoRelationship;
    quote_token: GeckoRelationship;
    dex: GeckoRelationship;
  };
}

export interface GeckoToken {
  id: string;
  type: "token";
  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image_url: string | null;
    coingecko_coin_id: string | null;
    price_usd: string | null;
    fdv_usd: string | null;
    total_reserve_in_usd: string | null;
    volume_usd: {
      h24: string | null;
    };
    market_cap_usd: string | null;
  };
  relationships: {
    top_pools: {
      data: Array<{ id: string; type: string }>;
    };
  };
}

export interface GeckoTokenResponse {
  data: GeckoToken;
}

export interface GeckoPoolsResponse {
  data: GeckoPool[];
  links?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface GeckoOHLCVBar {
  dt: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface GeckoOHLCVResponse {
  data: {
    id: string;
    type: "ohlcv";
    attributes: {
      ohlcv_list: Array<[number, number, number, number, number, number]>;
    };
  };
}

// ── Shared fetch helper ────────────────────────────────────────────────────

async function geckoFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(
      `GeckoTerminal API error: ${res.status} ${res.statusText} — ${url}`
    );
  }

  return res.json() as Promise<T>;
}

// ── API Functions ──────────────────────────────────────────────────────────

/** Fetch top pools on Tempo sorted by 24h volume, paginated. */
export async function getPools(page = 1): Promise<GeckoPoolsResponse> {
  return geckoFetch<GeckoPoolsResponse>(
    `/networks/${NETWORK}/pools?page=${page}&sort=h24_volume_usd_desc`
  );
}

/** Fetch recently created pools on Tempo. */
export async function getNewPools(): Promise<GeckoPoolsResponse> {
  return geckoFetch<GeckoPoolsResponse>(`/networks/${NETWORK}/new_pools`);
}

/** Fetch all pools for a given token address on Tempo. */
export async function getTokenPools(address: string): Promise<GeckoPoolsResponse> {
  return geckoFetch<GeckoPoolsResponse>(
    `/networks/${NETWORK}/tokens/${address}/pools`
  );
}

/** Fetch token info by address on Tempo. */
export async function getToken(address: string): Promise<GeckoTokenResponse> {
  return geckoFetch<GeckoTokenResponse>(
    `/networks/${NETWORK}/tokens/${address}`
  );
}

/** Search pools by query string, filtered to Tempo network. */
export async function searchTokens(query: string): Promise<GeckoPoolsResponse> {
  return geckoFetch<GeckoPoolsResponse>(
    `/search/pools?query=${encodeURIComponent(query)}&network=${NETWORK}`
  );
}

/** Fetch OHLCV candlestick data for a pool.
 *
 * @param poolAddress - Pool contract address
 * @param timeframe   - One of: "day", "hour", "minute"
 * @param limit       - Number of bars to return (max 1000)
 */
export async function getOHLCV(
  poolAddress: string,
  timeframe: "day" | "hour" | "minute",
  limit: number
): Promise<GeckoOHLCVResponse> {
  return geckoFetch<GeckoOHLCVResponse>(
    `/networks/${NETWORK}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}`
  );
}
