import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

const client = createPublicClient({
  chain: tempo,
  transport: http("https://rpc.presto.tempo.xyz"),
}).extend(tempoActions());

// Role hashes we'll probe on each stable. If the contract returns a valid
// member count, we enumerate. If the call reverts, we skip (contract doesn't
// implement that role).
const KNOWN_ROLES = [
  { name: "DEFAULT_ADMIN_ROLE", hash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}` },
  { name: "MINTER_ROLE", hash: keccak256(toBytes("MINTER_ROLE")) },
  { name: "BURNER_ROLE", hash: keccak256(toBytes("BURNER_ROLE")) },
  { name: "PAUSER_ROLE", hash: keccak256(toBytes("PAUSER_ROLE")) },
  { name: "UPGRADER_ROLE", hash: keccak256(toBytes("UPGRADER_ROLE")) },
  { name: "REWARDS_ROLE", hash: keccak256(toBytes("REWARDS_ROLE")) },
  { name: "BLACKLISTER_ROLE", hash: keccak256(toBytes("BLACKLISTER_ROLE")) },
] as const;

const ACCESS_CONTROL_ENUMERABLE_ABI = [
  {
    name: "getRoleMemberCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "role", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getRoleMember",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export interface BuildResult {
  stablesProcessed: number;
  rolesFound: number;
  currentHolders: number;
  errors: number;
}

export async function rebuildRoleHolders(): Promise<BuildResult> {
  let currentHolders = 0;
  let rolesFound = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const stable of KNOWN_STABLECOINS) {
    const stableAddr = stable.address.toLowerCase() as `0x${string}`;
    const stableLower = stable.address.toLowerCase();
    interface Member {
      roleHash: string;
      roleName: string;
      holder: string;
    }
    const members: Member[] = [];

    for (const role of KNOWN_ROLES) {
      try {
        const count = await client.readContract({
          address: stableAddr,
          abi: ACCESS_CONTROL_ENUMERABLE_ABI,
          functionName: "getRoleMemberCount",
          args: [role.hash],
        });
        const n = Number(count);
        if (n === 0) continue;
        rolesFound += 1;
        for (let i = 0; i < n; i++) {
          const holder = await client.readContract({
            address: stableAddr,
            abi: ACCESS_CONTROL_ENUMERABLE_ABI,
            functionName: "getRoleMember",
            args: [role.hash, BigInt(i)],
          });
          members.push({
            roleHash: role.hash.toLowerCase(),
            roleName: role.name,
            holder: (holder as string).toLowerCase(),
          });
        }
      } catch {
        errors += 1;
      }
    }

    await db.execute(sql`DELETE FROM role_holders WHERE stable = ${stableLower}`);
    for (const m of members) {
      await db.execute(sql`
        INSERT INTO role_holders (stable, role_hash, role_name, holder, granted_at, granted_tx_hash)
        VALUES (${stableLower}, ${m.roleHash}, ${m.roleName}, ${m.holder}, ${now}, ${"0x"})
        ON CONFLICT (stable, role_hash, holder) DO NOTHING
      `);
      currentHolders += 1;
    }
  }

  return {
    stablesProcessed: KNOWN_STABLECOINS.length,
    rolesFound,
    currentHolders,
    errors,
  };
}
