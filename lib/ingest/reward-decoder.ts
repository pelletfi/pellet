import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

// Tempo TIP-20 reward event topic0 hashes (keccak256 of event signature).
// Source: node_modules/viem/tempo/Abis.ts
const TOPIC_REWARD_DISTRIBUTED = "0xe34918ff1c7084970068b53fd71ad6d8b04e9f15d3886cbf006443e6cdc52ea6";
const TOPIC_REWARD_RECIPIENT_SET = "0xbbf8c20751167a65b38d4dd87c3eba00bfae01d85fb809a89eee1ba842673b98";

const DECODER_CURSOR = "__reward_decoder__";

// Strip left-padding from an address-packed topic (0x000...000 + 20-byte addr).
function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40).toLowerCase()}`;
}

// uint256 hex → decimal string (BigInt preserves full precision).
function uint256ToString(hex: string): string {
  if (!hex || hex === "0x") return "0";
  return BigInt(hex).toString();
}

export interface DecodeResult {
  scanned: number;
  distributionsInserted: number;
  recipientsUpserted: number;
  fromBlock: number;
  toBlock: number;
}

export async function decodeRewardEvents(): Promise<DecodeResult> {
  // Stablecoin addresses we track — only decode events from these contracts.
  const stableSet = new Set(KNOWN_STABLECOINS.map((s) => s.address.toLowerCase()));

  // Read cursor — last block we've fully decoded.
  const cursorResult = await db.execute(sql`
    SELECT last_block FROM ingestion_cursors WHERE contract = ${DECODER_CURSOR} LIMIT 1
  `);
  const cursorRows = ((cursorResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (cursorResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const fromBlock = Number(cursorRows[0]?.last_block ?? 0);

  // Pull only reward-topic events from the `events` table above our cursor.
  const eventsResult = await db.execute(sql`
    SELECT tx_hash, log_index, contract, block_number, block_timestamp, event_type, args
    FROM events
    WHERE event_type IN (${TOPIC_REWARD_DISTRIBUTED}, ${TOPIC_REWARD_RECIPIENT_SET})
      AND block_number > ${fromBlock}
    ORDER BY block_number ASC, log_index ASC
  `);
  const rows = ((eventsResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (eventsResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

  let distributionsInserted = 0;
  let recipientsUpserted = 0;
  let toBlock = fromBlock;

  for (const row of rows) {
    const contract = (row.contract as string).toLowerCase();
    if (!stableSet.has(contract)) continue; // guardrail — shouldn't happen but filter anyway

    const args = row.args as { topics: string[]; data: string };
    const blockNumber = Number(row.block_number);
    const blockTimestamp = row.block_timestamp as Date;
    toBlock = Math.max(toBlock, blockNumber);

    if (row.event_type === TOPIC_REWARD_DISTRIBUTED) {
      // RewardDistributed(indexed funder, uint256 amount)
      // topics[1] = funder; data = amount (uint256, 32 bytes)
      const funder = topicToAddress(args.topics[1]);
      const amount = uint256ToString(args.data);
      await db.execute(sql`
        INSERT INTO reward_distributions
          (tx_hash, log_index, stable, funder, amount, block_number, block_timestamp)
        VALUES (
          ${row.tx_hash as string},
          ${Number(row.log_index)},
          ${contract},
          ${funder},
          ${amount},
          ${blockNumber},
          ${blockTimestamp}
        )
        ON CONFLICT (tx_hash, log_index) DO NOTHING
      `);
      distributionsInserted += 1;
    } else if (row.event_type === TOPIC_REWARD_RECIPIENT_SET) {
      // RewardRecipientSet(indexed holder, indexed recipient)
      // topics[1] = holder; topics[2] = recipient; data = empty
      const holder = topicToAddress(args.topics[1]);
      const recipient = topicToAddress(args.topics[2]);
      await db.execute(sql`
        INSERT INTO reward_recipients
          (stable, holder, recipient, set_at, tx_hash, log_index, block_number)
        VALUES (
          ${contract},
          ${holder},
          ${recipient},
          ${blockTimestamp},
          ${row.tx_hash as string},
          ${Number(row.log_index)},
          ${blockNumber}
        )
        ON CONFLICT (stable, holder) DO UPDATE SET
          recipient = EXCLUDED.recipient,
          set_at = EXCLUDED.set_at,
          tx_hash = EXCLUDED.tx_hash,
          log_index = EXCLUDED.log_index,
          block_number = EXCLUDED.block_number
      `);
      recipientsUpserted += 1;
    }
  }

  // Advance cursor. If no new events, still bump cursor to the events-table tip
  // so we don't re-scan the same range next run.
  if (rows.length === 0) {
    const tipResult = await db.execute(sql`
      SELECT COALESCE(MAX(block_number), 0)::bigint AS max_block FROM events
    `);
    const tipRows = ((tipResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (tipResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    toBlock = Number(tipRows[0]?.max_block ?? fromBlock);
  }

  if (toBlock > fromBlock) {
    await db.execute(sql`
      UPDATE ingestion_cursors
      SET last_block = ${toBlock}, updated_at = NOW()
      WHERE contract = ${DECODER_CURSOR}
    `);
  }

  return {
    scanned: rows.length,
    distributionsInserted,
    recipientsUpserted,
    fromBlock,
    toBlock,
  };
}
