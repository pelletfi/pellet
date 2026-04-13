import { NextRequest, NextResponse } from "next/server";
import { getPools, searchTokens } from "@/lib/gecko";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  try {
    if (q && q.trim().length > 0) {
      const res = await searchTokens(q.trim());

      // Extract unique base token addresses from pool search results
      const seen = new Set<string>();
      const tokens: { address: string; name: string; symbol: string; price_usd: number; liquidity_usd: number }[] = [];

      for (const pool of res.data ?? []) {
        const baseId = pool.relationships?.base_token?.data?.id;
        if (!baseId) continue;

        // GeckoTerminal pool IDs are "network_address" or just "address"
        const addr = baseId.includes("_") ? baseId.split("_").pop()! : baseId;
        if (!addr || seen.has(addr.toLowerCase())) continue;
        seen.add(addr.toLowerCase());

        tokens.push({
          address: addr,
          name: pool.attributes.name ?? "",
          symbol: "",
          price_usd: parseFloat(pool.attributes.base_token_price_usd ?? "0"),
          liquidity_usd: parseFloat(pool.attributes.reserve_in_usd ?? "0"),
        });
      }

      return NextResponse.json({ tokens, page: 1 });
    }

    // No query — return top tokens from pools
    const res = await getPools(page);

    const seen = new Set<string>();
    const tokens: { address: string; price_usd: number; liquidity_usd: number; volume_24h: number }[] = [];

    for (const pool of res.data ?? []) {
      const baseId = pool.relationships?.base_token?.data?.id;
      if (!baseId) continue;

      const addr = baseId.includes("_") ? baseId.split("_").pop()! : baseId;
      if (!addr || seen.has(addr.toLowerCase())) continue;
      seen.add(addr.toLowerCase());

      tokens.push({
        address: addr,
        price_usd: parseFloat(pool.attributes.base_token_price_usd ?? "0"),
        liquidity_usd: parseFloat(pool.attributes.reserve_in_usd ?? "0"),
        volume_24h: parseFloat(pool.attributes.volume_usd?.h24 ?? "0"),
      });
    }

    return NextResponse.json({ tokens, page });
  } catch (err) {
    console.error("[GET /api/v1/tokens]", err);
    return NextResponse.json(
      { error: { code: "ENRICHMENT_FAILED", message: "Failed to fetch token list" } },
      { status: 502 }
    );
  }
}
