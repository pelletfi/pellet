import { tempoClient } from "@/lib/rpc";
import { neon } from "@neondatabase/serverless";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import { TEMPO_ADDRESSES } from "@/lib/types";

const sql = neon(process.env.DATABASE_URL!);

// Enshrined DEX quoteSwap ABI fragment
const DEX_ABI = [
  {
    name: "quoteSwapExactAmountIn",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint128" },
    ],
    outputs: [{ name: "amountOut", type: "uint128" }],
  },
] as const;

// Sample 1 unit at 6 decimals (pathUSD scale)
const SAMPLE_AMOUNT = 1_000_000n;

export interface SampleResult {
  block: number;
  sampledAt: Date;
  samples: number;
  errors: number;
}

export async function sampleAllPegs(): Promise<SampleResult> {
  const block = await tempoClient.getBlockNumber();
  const blockData = await tempoClient.getBlock({ blockNumber: block });
  const sampledAt = new Date(Number(blockData.timestamp) * 1000);

  interface Row {
    stable: string;
    blockNumber: number;
    sampledAt: Date;
    priceVsPathusd: string;
    spreadBps: string;
  }
  const rows: Row[] = [];
  let errors = 0;

  // Sample every stable in parallel
  const promises = KNOWN_STABLECOINS.map(async (s) => {
    const isPathUsd = s.address.toLowerCase() === TEMPO_ADDRESSES.pathUsd.toLowerCase();
    if (isPathUsd) {
      // pathUSD is the peg anchor — always $1.
      return {
        stable: s.address.toLowerCase(),
        blockNumber: Number(block),
        sampledAt,
        priceVsPathusd: "1",
        spreadBps: "0",
      };
    }
    try {
      const result = await tempoClient.readContract({
        address: TEMPO_ADDRESSES.stablecoinDex,
        abi: DEX_ABI,
        functionName: "quoteSwapExactAmountIn",
        args: [s.address, TEMPO_ADDRESSES.pathUsd, SAMPLE_AMOUNT],
      });
      const amountOut = result as unknown as bigint;
      // Price = amountOut / amountIn, both at 6 decimals
      const price = Number(amountOut) / Number(SAMPLE_AMOUNT);
      const spreadBps = Math.abs(price - 1) * 10_000;
      return {
        stable: s.address.toLowerCase(),
        blockNumber: Number(block),
        sampledAt,
        priceVsPathusd: price.toFixed(8),
        spreadBps: spreadBps.toFixed(2),
      };
    } catch {
      errors += 1;
      return null;
    }
  });

  const settled = await Promise.all(promises);
  for (const r of settled) if (r) rows.push(r);

  // Use raw neon tag to avoid Drizzle emitting `DEFAULT` for serial `id` —
  // the Neon HTTP driver rejects prepared statements that contain unquoted
  // DEFAULT keywords among their values.
  for (const r of rows) {
    await sql`
      INSERT INTO peg_samples (stable, block_number, sampled_at, price_vs_pathusd, spread_bps)
      VALUES (${r.stable}, ${r.blockNumber}, ${r.sampledAt}, ${r.priceVsPathusd}, ${r.spreadBps})
    `;
  }

  return {
    block: Number(block),
    sampledAt,
    samples: rows.length,
    errors,
  };
}
