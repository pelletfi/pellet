import { getToken, getTokenPools } from "@/lib/gecko";
import type { TokenMarketData, PoolData } from "@/lib/types";

/**
 * Aggregate market data from GeckoTerminal.
 * Fetches token info and all pools in parallel, then maps to our market data type.
 * Uses the highest-liquidity pool for price, sums volume and liquidity across all pools.
 *
 * Coverage discipline: if BOTH the token fetch AND the pools fetch fail,
 * we return coverage:"unavailable" so downstream consumers don't confuse
 * "GeckoTerminal is down" with "token has zero market activity".
 */
export async function getMarketData(address: string): Promise<TokenMarketData> {
  const [tokenResSettled, poolsResSettled] = await Promise.allSettled([
    getToken(address),
    getTokenPools(address),
  ]);

  const tokenRes = tokenResSettled.status === "fulfilled" ? tokenResSettled.value : null;
  const poolsRes = poolsResSettled.status === "fulfilled" ? poolsResSettled.value : { data: [] };

  // Extract token attributes, with safe fallbacks
  const tokenAttrs = tokenRes?.data?.attributes;
  const price = tokenAttrs?.price_usd ? parseFloat(tokenAttrs.price_usd) : 0;
  const fdv = tokenAttrs?.fdv_usd ? parseFloat(tokenAttrs.fdv_usd) : null;

  // Map pools to our PoolData type
  const pools: PoolData[] = (poolsRes.data || [])
    .filter((pool) => {
      // Only include pools with a valid base token price
      return (
        pool.attributes?.base_token_price_usd &&
        parseFloat(pool.attributes.base_token_price_usd) > 0
      );
    })
    .map((pool) => {
      const poolPrice = parseFloat(pool.attributes.base_token_price_usd || "0");
      const reserve = parseFloat(pool.attributes.reserve_in_usd || "0");
      const volume = parseFloat(pool.attributes.volume_usd?.h24 || "0");

      // Extract dex name from relationships (e.g., "tempo-2" → "tempo")
      const dexId = pool.relationships?.dex?.data?.id || "";
      const dex = dexId.split("-")[0] || "unknown";

      return {
        address: pool.attributes.address,
        dex,
        base_token: {
          address: pool.relationships?.base_token?.data?.id || address,
          // GeckoTerminal's pool endpoint doesn't populate symbol; leave blank
          // rather than invent one. Agent-facing consumers should not read
          // empty string as a real symbol.
          symbol: "",
        },
        quote_token: {
          address: pool.relationships?.quote_token?.data?.id || "",
          symbol: "",
        },
        reserve_usd: reserve,
        volume_24h: volume,
        price_usd: poolPrice,
      };
    });

  // Sort by liquidity descending, use best pool for price if available
  pools.sort((a, b) => b.reserve_usd - a.reserve_usd);
  const bestPoolPrice = pools[0]?.price_usd || price;

  // Sum volume and liquidity across all pools
  const totalVolume = pools.reduce((sum, pool) => sum + pool.volume_24h, 0);
  const totalLiquidity = pools.reduce((sum, pool) => sum + pool.reserve_usd, 0);

  // 24h price change is not populated by the GeckoTerminal token endpoint
  // we currently use. Return null (NOT MEASURED) rather than inventing zero.
  const priceChange24h: number | null = null;

  // Coverage: complete if either fetch returned actual data, unavailable if
  // both failed (returns look identical to "no activity" without this flag).
  const anyDataReturned = tokenRes !== null || (poolsRes.data && poolsRes.data.length > 0);
  const coverage: TokenMarketData["coverage"] = anyDataReturned ? "complete" : "unavailable";
  const coverage_note = anyDataReturned
    ? null
    : "Both GeckoTerminal token lookup and pool lookup failed. Price/volume/liquidity fields are not measurements — they are defaults for a missing response.";

  return {
    price_usd: bestPoolPrice,
    volume_24h: totalVolume,
    liquidity_usd: totalLiquidity,
    fdv_usd: fdv,
    price_change_24h: priceChange24h,
    pools,
    coverage,
    coverage_note,
  };
}
