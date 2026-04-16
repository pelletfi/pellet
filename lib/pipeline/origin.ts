import type { OriginResult } from "@/lib/types";
import { tempoClient } from "@/lib/rpc";
import { parseAbiItem } from "viem";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * Analyze deployer origin: tx count, account age, and funding source.
 *
 * If creatorAddress is null — i.e., the holders aggregator couldn't identify
 * a creator (holder enumeration was unavailable) — we return coverage:
 * "unavailable" with null fields rather than fabricating deployer: "unknown"
 * and zeros. The LLM evaluation layer MUST treat unavailable coverage as
 * missing data, not as confirmation of a non-existent/unknown deployer.
 */
export async function getOrigin(
  tokenAddress: `0x${string}`,
  creatorAddress: string | null
): Promise<OriginResult> {
  if (!creatorAddress) {
    return {
      deployer: null,
      deployer_tx_count: null,
      deployer_age_days: null,
      funding_source: null,
      funding_label: null,
      funding_hops: 0,
      prior_tokens: [],
      coverage: "unavailable",
      coverage_note:
        "Creator address could not be identified upstream (holder Transfer-event enumeration was unavailable or returned no mint events). Deployer identity cannot be inferred without it.",
    };
  }

  const deployer = creatorAddress as `0x${string}`;

  // Fetch deployer tx count — distinguish "RPC read failed" from "truly zero".
  // Zero would be bizarre for an account that deployed a token, so we return
  // null on failure and let consumers surface it as unmeasured.
  let txCount: number | null;
  try {
    txCount = await tempoClient.getTransactionCount({ address: deployer });
  } catch {
    txCount = null;
  }

  // Scan early Transfer events TO the deployer to find the funding source
  // (first inbound transfer from block 0 → 10000 is a reasonable heuristic)
  const fundingSource = await findFundingSource(deployer);

  // Deployer age: we don't yet have a block-to-timestamp lookup path wired up
  // in this pipeline. Report null (NOT MEASURED) rather than 0 (which would
  // be indistinguishable from "deployer account is brand new" — exactly the
  // kind of silent-zero bug we're eliminating elsewhere).
  const deployerAgeDays: number | null = null;

  const coverage_note =
    txCount === null
      ? "Deployer tx-count RPC read failed. Other deployer fields may be stale."
      : "Deployer age not measured — block-to-timestamp lookup not yet implemented in this pipeline.";

  return {
    deployer: creatorAddress,
    deployer_tx_count: txCount,
    deployer_age_days: deployerAgeDays,
    funding_source: fundingSource?.address ?? null,
    funding_label: fundingSource?.label ?? null,
    funding_hops: fundingSource ? 1 : 0,
    prior_tokens: [],
    coverage: "complete",
    coverage_note,
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
