import { tempoClient } from "@/lib/rpc";
import { formatEther, type Hash, type Address } from "viem";
import {
  getBlockNumber,
  getBlock,
  getTransaction,
  getTransactionReceipt,
  getCode,
} from "viem/actions";
import { isTip20 } from "@/lib/pipeline/compliance";

// ── Input type detection ──

export type InputType = "address" | "token" | "tx" | "block" | "search";

export async function detectInputType(
  input: string
): Promise<{ type: InputType; value: string }> {
  const trimmed = input.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed))
    return { type: "tx", value: trimmed };
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    try {
      const code = await getCode(tempoClient, {
        address: trimmed as Address,
      });
      if (code && code !== "0x") {
        const tip20 = await isTip20(trimmed as `0x${string}`).catch(
          () => false
        );
        return { type: tip20 ? "token" : "address", value: trimmed };
      }
    } catch {}
    return { type: "address", value: trimmed };
  }
  if (/^\d+$/.test(trimmed)) return { type: "block", value: trimmed };
  return { type: "search", value: trimmed };
}

// ── Block data ──

export interface BlockInfo {
  number: bigint;
  timestamp: bigint;
  hash: string;
  parentHash: string;
  transactionCount: number;
  transactions: string[];
}

export async function getBlockInfo(
  blockNumber: number
): Promise<BlockInfo | null> {
  try {
    const block = await getBlock(tempoClient, {
      blockNumber: BigInt(blockNumber),
    });
    return {
      number: block.number,
      timestamp: block.timestamp,
      hash: block.hash,
      parentHash: block.parentHash,
      transactionCount: block.transactions.length,
      transactions: block.transactions as string[],
    };
  } catch {
    return null;
  }
}

export async function getLatestBlockNumber(): Promise<number> {
  return Number(await getBlockNumber(tempoClient));
}

export async function getRecentBlocks(
  count: number = 50
): Promise<{ number: number; txCount: number }[]> {
  const latest = await getLatestBlockNumber();
  const results: { number: number; txCount: number }[] = [];
  for (let i = 0; i < count; i += 10) {
    const batch = Array.from(
      { length: Math.min(10, count - i) },
      (_, j) => {
        const num = latest - i - j;
        return getBlock(tempoClient, { blockNumber: BigInt(num) })
          .then((b) => ({ number: num, txCount: b.transactions.length }))
          .catch(() => ({ number: num, txCount: 0 }));
      }
    );
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

// ── Transaction data ──

export interface TxInfo {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: number;
  gasUsed: string;
  status: "success" | "reverted" | "pending";
}

export async function getTxInfo(hash: string): Promise<TxInfo | null> {
  try {
    const [tx, receipt] = await Promise.all([
      getTransaction(tempoClient, { hash: hash as Hash }),
      getTransactionReceipt(tempoClient, { hash: hash as Hash }).catch(
        () => null
      ),
    ]);
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to ?? null,
      value: formatEther(tx.value ?? 0n),
      blockNumber: Number(tx.blockNumber ?? 0),
      gasUsed: receipt ? receipt.gasUsed.toString() : "pending",
      status: receipt
        ? receipt.status === "success"
          ? "success"
          : "reverted"
        : "pending",
    };
  } catch {
    return null;
  }
}

// ── Address data ──

export async function getAddressTxCount(address: string): Promise<number> {
  try {
    return await tempoClient.getTransactionCount({
      address: address as Address,
    });
  } catch {
    return 0;
  }
}

export async function isContract(address: string): Promise<boolean> {
  try {
    const code = await getCode(tempoClient, {
      address: address as Address,
    });
    return !!code && code !== "0x";
  } catch {
    return false;
  }
}
