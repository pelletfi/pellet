import type { OriginResult } from "@/lib/types";
import { tempoClient } from "@/lib/rpc";
import { parseAbiItem } from "viem";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * Analyze deployer origin: tx count, account age, and funding source.
 * If creatorAddress is null, returns conservative defaults.
 */
export async function getOrigin(
  tokenAddress: `0x${string}`,
  creatorAddress: string | null
): Promise<OriginResult> {
  if (!creatorAddress) {
    return {
      deployer: "unknown",
      deployer_tx_count: 0,
      deployer_age_days: 0,
      funding_source: null,
      funding_label: null,
      funding_hops: 0,
      prior_tokens: [],
    };
  }

  const deployer = creatorAddress as `0x${string}`;

  // Fetch deployer tx count
  const txCount = await tempoClient
    .getTransactionCount({ address: deployer })
    .catch(() => 0);

  // Scan early Transfer events TO the deployer to find the funding source
  // (first inbound transfer from block 0 → 10000 is a reasonable heuristic)
  const fundingSource = await findFundingSource(deployer);

  // Deployer age: estimate from first tx block number if available
  // We don't have a block-to-timestamp lookup here, so default to 0
  const deployerAgeDays = 0;

  return {
    deployer: creatorAddress,
    deployer_tx_count: txCount,
    deployer_age_days: deployerAgeDays,
    funding_source: fundingSource?.address ?? null,
    funding_label: fundingSource?.label ?? null,
    funding_hops: fundingSource ? 1 : 0,
    prior_tokens: [],
  };
}

// --- Funding source helpers ---

interface FundingSource {
  address: string;
  label: string | null;
}

/**
 * Scan Transfer events in the first 10k blocks for transfers TO the deployer.
 * Returns the first (earliest) inbound sender as the likely funding source.
 */
async function findFundingSource(
  deployer: `0x${string}`
): Promise<FundingSource | null> {
  try {
    const logs = await tempoClient.getLogs({
      event: TRANSFER_EVENT,
      args: { to: deployer },
      fromBlock: 0n,
      toBlock: 10000n,
    });

    if (!logs.length) return null;

    // Sort ascending by block number, pick the earliest
    logs.sort((a, b) => Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)));
    const earliest = logs[0];
    const fromAddress = earliest.args.from as string | undefined;

    if (!fromAddress) return null;

    return {
      address: fromAddress,
      label: labelKnownAddress(fromAddress),
    };
  } catch {
    return null;
  }
}

/**
 * Light lookup table for known funding sources.
 * Expand as more labeled addresses are identified.
 */
function labelKnownAddress(address: string): string | null {
  const KNOWN: Record<string, string> = {
    // Add known exchange/bridge hot wallets here as they're identified
  };
  return KNOWN[address.toLowerCase()] ?? null;
}
