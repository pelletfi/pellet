// One-shot: backfill wallet_users.managed_address (placeholder → real) and
// wallet_users.public_key_uncompressed for any rows enrolled before
// Phase 3.B.2. Idempotent — re-running just reprocesses the same rows
// against the same algorithm and gets the same results.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-tempo-addresses.ts

import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { tempoAddressFromCose, coseToUncompressed } from "@/lib/wallet/tempo-account";
import { isNull, or, sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: walletUsers.id,
      managedAddress: walletUsers.managedAddress,
      publicKey: walletUsers.passkeyPublicKey,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
    })
    .from(walletUsers)
    .where(
      or(
        isNull(walletUsers.publicKeyUncompressed),
        // Catch placeholder addresses too — they all start with 0x000…
        sql`${walletUsers.managedAddress} LIKE '0x000%'`,
      ),
    );

  console.log(`scanning ${rows.length} candidate rows`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.publicKey || (row.publicKey as Buffer).length === 0) {
      console.log(`  skip ${row.id.slice(0, 8)}… (no public key — pre-Phase-2)`);
      skipped++;
      continue;
    }
    try {
      const cose = Buffer.from(row.publicKey as Buffer);
      const uncompressed = coseToUncompressed(cose);
      const realAddress = tempoAddressFromCose(cose);
      await db
        .update(walletUsers)
        .set({
          managedAddress: realAddress,
          publicKeyUncompressed: uncompressed,
        })
        .where(sql`id = ${row.id}`);
      console.log(
        `  ✓ ${row.id.slice(0, 8)}…  ${row.managedAddress} → ${realAddress}`,
      );
      updated++;
    } catch (e) {
      console.error(`  ✗ ${row.id.slice(0, 8)}…  ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\ndone. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
