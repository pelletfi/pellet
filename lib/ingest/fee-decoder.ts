import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { TEMPO_ADDRESSES } from "@/lib/types";

// Tempo fee manager precompile event topic0 hashes.
// Source signatures: viem/tempo/Abis.ts feeManager ABI.
const TOPIC_USER_TOKEN_SET = "0xabc7758d4ca817ce0d125eb731121a1304c36077b791253be835b95472368856";
const TOPIC_VALIDATOR_TOKEN_SET = "0x6eb51f8f7e857fb2caf4257da4219a86adeed7128412764e41334968165f5f0c";
const TOPIC_FEES_DISTRIBUTED = "0xfe29ed2b7edbf126f3c1660fa23703a1c600aff44409f07b3c848bbb03631f95";

const DECODER_CURSOR = "__fee_decoder__";
const FEE_MANAGER = TEMPO_ADDRESSES.feeManager.toLowerCase();

function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40).toLowerCase()}`;
}

function uint256ToString(hex: string): string {
  if (!hex || hex === "0x") return "0";
  return BigInt(hex).toString();
}

export interface DecodeResult {
  scanned: number;
  distributionsInserted: number;
  userPrefsUpserted: number;
  validatorPrefsUpserted: number;
  fromBlock: number;
  toBlock: number;
}

export async function decodeFeeEvents(): Promise<DecodeResult> {
  const cursorResult = await db.execute(sql`
    SELECT last_block FROM ingestion_cursors WHERE contract = ${DECODER_CURSOR} LIMIT 1
  `);
  const cursorRows = ((cursorResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (cursorResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const fromBlock = Number(cursorRows[0]?.last_block ?? 0);

  const eventsResult = await db.execute(sql`
    SELECT tx_hash, log_index, contract, block_number, block_timestamp, event_type, args
    FROM events
    WHERE contract = ${FEE_MANAGER}
      AND event_type IN (${TOPIC_USER_TOKEN_SET}, ${TOPIC_VALIDATOR_TOKEN_SET}, ${TOPIC_FEES_DISTRIBUTED})
      AND block_number > ${fromBlock}
    ORDER BY block_number ASC, log_index ASC
  `);
  const rows = ((eventsResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (eventsResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

  let distributionsInserted = 0;
  let userPrefsUpserted = 0;
  let validatorPrefsUpserted = 0;
  let toBlock = fromBlock;

  for (const row of rows) {
    const args = row.args as { topics: string[]; data: string };
    const blockNumber = Number(row.block_number);
    const blockTimestamp = row.block_timestamp as Date;
    toBlock = Math.max(toBlock, blockNumber);

    if (row.event_type === TOPIC_FEES_DISTRIBUTED) {
      // FeesDistributed(indexed validator, indexed token, uint256 amount)
      const validator = topicToAddress(args.topics[1]);
      const token = topicToAddress(args.topics[2]);
      const amount = uint256ToString(args.data);
      await db.execute(sql`
        INSERT INTO fee_distributions
          (tx_hash, log_index, validator, token, amount, block_number, block_timestamp)
        VALUES (
          ${row.tx_hash as string},
          ${Number(row.log_index)},
          ${validator},
          ${token},
          ${amount},
          ${blockNumber},
          ${blockTimestamp}
        )
        ON CONFLICT (tx_hash, log_index) DO NOTHING
      `);
      distributionsInserted += 1;
    } else if (row.event_type === TOPIC_USER_TOKEN_SET) {
      // UserTokenSet(indexed user, indexed token)
      const user = topicToAddress(args.topics[1]);
      const token = topicToAddress(args.topics[2]);
      await db.execute(sql`
        INSERT INTO fee_token_users
          ("user", token, set_at, tx_hash, log_index, block_number)
        VALUES (
          ${user},
          ${token},
          ${blockTimestamp},
          ${row.tx_hash as string},
          ${Number(row.log_index)},
          ${blockNumber}
        )
        ON CONFLICT ("user") DO UPDATE SET
          token = EXCLUDED.token,
          set_at = EXCLUDED.set_at,
          tx_hash = EXCLUDED.tx_hash,
          log_index = EXCLUDED.log_index,
          block_number = EXCLUDED.block_number
      `);
      userPrefsUpserted += 1;
    } else if (row.event_type === TOPIC_VALIDATOR_TOKEN_SET) {
      // ValidatorTokenSet(indexed validator, indexed token)
      const validator = topicToAddress(args.topics[1]);
      const token = topicToAddress(args.topics[2]);
      await db.execute(sql`
        INSERT INTO fee_token_validators
          (validator, token, set_at, tx_hash, log_index, block_number)
        VALUES (
          ${validator},
          ${token},
          ${blockTimestamp},
          ${row.tx_hash as string},
          ${Number(row.log_index)},
          ${blockNumber}
        )
        ON CONFLICT (validator) DO UPDATE SET
          token = EXCLUDED.token,
          set_at = EXCLUDED.set_at,
          tx_hash = EXCLUDED.tx_hash,
          log_index = EXCLUDED.log_index,
          block_number = EXCLUDED.block_number
      `);
      validatorPrefsUpserted += 1;
    }
  }

  // Bump cursor to the events table tip if no new rows (otherwise to toBlock).
  if (rows.length === 0) {
    const tipResult = await db.execute(sql`
      SELECT COALESCE(MAX(block_number), 0)::bigint AS max_block FROM events
      WHERE contract = ${FEE_MANAGER}
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
    userPrefsUpserted,
    validatorPrefsUpserted,
    fromBlock,
    toBlock,
  };
}
