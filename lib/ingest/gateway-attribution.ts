import { db } from "@/lib/db/client";
import { agentEvents } from "@/lib/db/schema";
import { ingestClient } from "@/lib/rpc";
import { sql, eq } from "drizzle-orm";

// The Tempo MPP Gateway routes payments through a settlement contract that
// emits a custom Settlement-style event. The provider address (the underlying
// service receiving funds) is in topic[2].
const SETTLEMENT_CONTRACT =
  "0x33b901018174ddabe4841042ab76ba85d4e24f25" as const;
const SETTLEMENT_TOPIC =
  "0x92ed5fe0fe56b3f4185e688efb342e92a4492b9df29ad5de596c44e64d097b51" as const;
const GATEWAY_AGENT_ID = "tempo-gateway-mpp" as const;

function topicToAddress(topic: string): string | null {
  // Topic format: 0x + 24 zero hex chars + 40 hex chars (the address).
  const hex = topic.replace(/^0x/i, "").toLowerCase();
  if (hex.length !== 64) return null;
  return `0x${hex.slice(24)}`;
}

// Walks a tx receipt's logs looking for the Settlement event from the
// gateway's settlement contract; returns the provider address from topic[2].
// Returns null if the tx didn't go through the settlement path (e.g., the
// gateway received funds directly without onward routing).
async function findRoutedAddress(txHash: string): Promise<string | null> {
  try {
    const receipt = await ingestClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== SETTLEMENT_CONTRACT) continue;
      if (log.topics[0]?.toLowerCase() !== SETTLEMENT_TOPIC) continue;
      const providerTopic = log.topics[2];
      if (!providerTopic) continue;
      return topicToAddress(providerTopic);
    }
  } catch {
    // Swallow — receipt fetch failures shouldn't block the cron; we'll retry
    // on the next pass since routed_to_address is still NULL.
  }
  return null;
}

export async function runAttribution(limit = 100): Promise<{
  scanned: number;
  attributed: number;
  unresolved: number;
}> {
  // Pull gateway-routed events that haven't been attributed yet. We dedupe by
  // tx_hash so multi-row txs only do one RPC fetch.
  const rows = await db.execute<{ id: number; tx_hash: string }>(sql`
    SELECT DISTINCT ON (tx_hash)
      id::int        AS id,
      tx_hash        AS tx_hash
    FROM agent_events
    WHERE agent_id = ${GATEWAY_AGENT_ID}
      AND routed_to_address IS NULL
    ORDER BY tx_hash, id ASC
    LIMIT ${limit}
  `);

  let attributed = 0;
  let unresolved = 0;

  for (const r of rows.rows) {
    const provider = await findRoutedAddress(r.tx_hash);
    if (!provider) {
      unresolved += 1;
      continue;
    }
    // Apply to ALL rows in this tx that match the gateway agent — there's
    // typically only one, but be defensive.
    await db
      .update(agentEvents)
      .set({ routedToAddress: provider })
      .where(
        sql`${agentEvents.agentId} = ${GATEWAY_AGENT_ID}
            AND ${agentEvents.txHash} = ${r.tx_hash}
            AND ${agentEvents.routedToAddress} IS NULL`,
      );
    attributed += 1;
  }

  return { scanned: rows.rows.length, attributed, unresolved };
}
