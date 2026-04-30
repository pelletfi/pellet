// One-off: revoke every wallet session whose session_key_ciphertext can't
// be decrypted with the current WALLET_MASTER_KEY. Use this when the
// master key drifted and old sessions are dead weight. Re-pair after.
import { db } from "@/lib/db/client";
import { walletSessions } from "@/lib/db/schema";
import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { eq, isNull } from "drizzle-orm";

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await db
    .select()
    .from(walletSessions)
    .where(isNull(walletSessions.revokedAt));

  let bad = 0;
  let good = 0;
  for (const s of rows) {
    let decryptable = false;
    if (s.sessionKeyCiphertext) {
      try {
        decryptSessionKey(Buffer.from(s.sessionKeyCiphertext));
        decryptable = true;
      } catch {}
    }
    if (decryptable) {
      good++;
      continue;
    }
    bad++;
    console.log(
      "BAD",
      s.createdAt.toISOString(),
      s.id.slice(0, 8),
      "label=" + (s.label ?? "-"),
    );
    if (apply) {
      await db
        .update(walletSessions)
        .set({ revokedAt: new Date() })
        .where(eq(walletSessions.id, s.id));
    }
  }
  console.log(`\nactive sessions checked: ${rows.length}, decryptable: ${good}, bad: ${bad}`);
  if (!apply) {
    console.log("\nDRY RUN. Re-run with --apply to revoke the bad ones.");
  } else {
    console.log("\nDONE. Re-pair via `pellet auth start`.");
  }
}

main().then(() => process.exit(0));
