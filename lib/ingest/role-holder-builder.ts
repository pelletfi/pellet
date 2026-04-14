import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { keccak256, toBytes, isAddress, getAddress, decodeAbiParameters } from "viem";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

// Tempo's TIP-20 RBAC uses a single combined event:
// RoleMembershipUpdated(bytes32 role indexed, address account indexed, address sender indexed, bool hasRole)
// (Different from OpenZeppelin's RoleGranted/RoleRevoked split.)
const ROLE_MEMBERSHIP_TOPIC = keccak256(
  toBytes("RoleMembershipUpdated(bytes32,address,address,bool)"),
).toLowerCase();

// Pre-hashed Tempo TIP-20 role names. Source: ox/tempo TokenRole.toPreHashed.
const KNOWN_ROLES: Record<string, string> = {
  "0x0000000000000000000000000000000000000000000000000000000000000000": "DEFAULT_ADMIN_ROLE",
  [keccak256(toBytes("ISSUER_ROLE")).toLowerCase()]: "ISSUER_ROLE",
  [keccak256(toBytes("PAUSE_ROLE")).toLowerCase()]: "PAUSE_ROLE",
  [keccak256(toBytes("UNPAUSE_ROLE")).toLowerCase()]: "UNPAUSE_ROLE",
  [keccak256(toBytes("BURN_BLOCKED_ROLE")).toLowerCase()]: "BURN_BLOCKED_ROLE",
};

function decodeRoleName(hash: string): string {
  return KNOWN_ROLES[hash.toLowerCase()] ?? hash;
}

function topicToAddress(topic: string): string | null {
  if (!topic.startsWith("0x") || topic.length !== 66) return null;
  const candidate = `0x${topic.slice(26)}`;
  if (!isAddress(candidate)) return null;
  return getAddress(candidate).toLowerCase();
}

// args.data is the abi-encoded `bool hasRole` (32 bytes, last byte 0 or 1)
function decodeHasRole(data: string): boolean {
  try {
    const [b] = decodeAbiParameters([{ type: "bool" }], data as `0x${string}`);
    return b as boolean;
  } catch {
    return false;
  }
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

    const result = await db.execute(sql`
      SELECT block_number, block_timestamp, tx_hash, log_index, args
      FROM events
      WHERE contract = ${stableAddr}
        AND LOWER(event_type) = ${ROLE_MEMBERSHIP_TOPIC}
      ORDER BY block_number ASC, log_index ASC
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<{
      block_number: number;
      block_timestamp: string;
      tx_hash: string;
      log_index: number;
      args: { topics?: string[]; data?: string };
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
      const account = topicToAddress(topics[2] ?? "");
      if (!account) continue;
      const hasRole = decodeHasRole(row.args?.data ?? "0x");
      rolesSeen.add(roleHash);

      const key = `${roleHash}:${account}`;
      if (hasRole) {
        // Granted (or maintained)
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
