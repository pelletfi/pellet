import { getToken, getTokenPools } from "@/lib/gecko";
import type { TokenMarketData, PoolData } from "@/lib/types";

/**
 * Aggregate market data from GeckoTerminal.
 * Fetches token info and all pools in parallel, then maps to our market data type.
 * Uses the highest-liquidity pool for price, sums volume and liquidity across all pools.
 */
export async function getMarketData(address: string): Promise<TokenMarketData> {
  const [tokenRes, poolsRes] = await Promise.all([
    getToken(address).catch(() => null),
    getTokenPools(address).catch(() => ({ data: [] })),
  ]);

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
          symbol: "", // GeckoTerminal doesn't include symbol in pool data, left blank
        },
        quote_token: {
          address: pool.relationships?.quote_token?.data?.id || "",
          symbol: "", // GeckoTerminal doesn't include symbol in pool data, left blank
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

  // Calculate 24h price change if available
  const priceChange24h = tokenAttrs?.price_usd
    ? parseFloat(
        // fallback to null if no change data available
        "0" // GeckoTerminal token endpoint doesn't return price_change_percentage
      ) || null
    : null;

  return {
    price_usd: bestPoolPrice,
    volume_24h: totalVolume,
    liquidity_usd: totalLiquidity,
    fdv_usd: fdv,
    price_change_24h: priceChange24h,
    pools,
  };
}
