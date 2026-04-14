import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { keccak256, toBytes, isAddress, getAddress } from "viem";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

// Topic0 hashes for the role events we replay
const ROLE_GRANTED_TOPIC = keccak256(toBytes("RoleGranted(bytes32,address,address)")).toLowerCase();
const ROLE_REVOKED_TOPIC = keccak256(toBytes("RoleRevoked(bytes32,address,address)")).toLowerCase();

// Precomputed role-name lookup
const KNOWN_ROLES: Record<string, string> = {
  "0x0000000000000000000000000000000000000000000000000000000000000000": "DEFAULT_ADMIN_ROLE",
  [keccak256(toBytes("MINTER_ROLE")).toLowerCase()]: "MINTER_ROLE",
  [keccak256(toBytes("BURNER_ROLE")).toLowerCase()]: "BURNER_ROLE",
  [keccak256(toBytes("PAUSER_ROLE")).toLowerCase()]: "PAUSER_ROLE",
  [keccak256(toBytes("UPGRADER_ROLE")).toLowerCase()]: "UPGRADER_ROLE",
  [keccak256(toBytes("REWARDS_ROLE")).toLowerCase()]: "REWARDS_ROLE",
  [keccak256(toBytes("BLACKLISTER_ROLE")).toLowerCase()]: "BLACKLISTER_ROLE",
};

function decodeRoleName(hash: string): string {
  return KNOWN_ROLES[hash.toLowerCase()] ?? hash;
}

// Topic is a 32-byte left-padded address hex (0x + 24 zeroes + 40-char address).
function topicToAddress(topic: string): string | null {
  if (!topic.startsWith("0x") || topic.length !== 66) return null;
  const candidate = `0x${topic.slice(26)}`;
  if (!isAddress(candidate)) return null;
  return getAddress(candidate).toLowerCase();
}

export interface BuildResult {
  stablesProcessed: number;
  rolesSeen: number;
  currentHolders: number;
}

export async function rebuildRoleHolders(): Promise<BuildResult> {
  let currentHolders = 0;
  const rolesSeen = new Set<string>();

  for (const stable of KNOWN_STABLECOINS) {
    const stableAddr = stable.address.toLowerCase();

    // Pull all role-change events for this stable in chronological order.
    // Now that we have full event history, this finds every grant / revoke
    // since the contract was deployed.
    const result = await db.execute(sql`
      SELECT block_number, block_timestamp, tx_hash, log_index, event_type, args
      FROM events
      WHERE contract = ${stableAddr}
        AND LOWER(event_type) IN (${ROLE_GRANTED_TOPIC}, ${ROLE_REVOKED_TOPIC})
      ORDER BY block_number ASC, log_index ASC
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<{
      block_number: number;
      block_timestamp: string;
      tx_hash: string;
      log_index: number;
      event_type: string;
      args: { topics?: string[] };
    }>;

    interface Membership {
      roleHash: string;
      roleName: string;
      grantedAt: string;
      grantedTxHash: string;
    }
    const current = new Map<string, Membership>();

    for (const row of rows) {
      const topics = row.args?.topics ?? [];
      if (topics.length < 3) continue;
      const roleHash = (topics[1] ?? "").toLowerCase();
      const holder = topicToAddress(topics[2] ?? "");
      if (!holder) continue;
      rolesSeen.add(roleHash);

      const key = `${roleHash}:${holder}`;
      if (row.event_type.toLowerCase() === ROLE_GRANTED_TOPIC) {
        current.set(key, {
          roleHash,
          roleName: decodeRoleName(roleHash),
          grantedAt: row.block_timestamp,
          grantedTxHash: row.tx_hash,
        });
      } else {
        current.delete(key);
      }
    }

    // Wipe + reinsert current snapshot
    await db.execute(sql`DELETE FROM role_holders WHERE stable = ${stableAddr}`);
    for (const [key, m] of current) {
      const holder = key.split(":")[1];
      await db.execute(sql`
        INSERT INTO role_holders (stable, role_hash, role_name, holder, granted_at, granted_tx_hash)
        VALUES (${stableAddr}, ${m.roleHash}, ${m.roleName}, ${holder}, ${m.grantedAt}, ${m.grantedTxHash})
        ON CONFLICT (stable, role_hash, holder) DO NOTHING
      `);
      currentHolders += 1;
    }
  }

  return {
    stablesProcessed: KNOWN_STABLECOINS.length,
    rolesSeen: rolesSeen.size,
    currentHolders,
  };
}
