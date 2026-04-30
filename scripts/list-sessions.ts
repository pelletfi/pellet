import { db } from "@/lib/db/client";
import { walletSessions } from "@/lib/db/schema";
import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: walletSessions.id,
      label: walletSessions.label,
      createdAt: walletSessions.createdAt,
      revokedAt: walletSessions.revokedAt,
      hasCipher: walletSessions.sessionKeyCiphertext,
    })
    .from(walletSessions)
    .orderBy(desc(walletSessions.createdAt))
    .limit(10);

  for (const r of rows) {
    let decryptStatus = "no-cipher";
    if (r.hasCipher) {
      try {
        decryptSessionKey(Buffer.from(r.hasCipher));
        decryptStatus = "ok";
      } catch (e) {
        decryptStatus = "FAIL: " + (e instanceof Error ? e.message : String(e));
      }
    }
    console.log(
      r.createdAt.toISOString(),
      r.id.slice(0, 8),
      "label=" + (r.label ?? "-"),
      "rev=" + (r.revokedAt ? "yes" : "no"),
      "decrypt=" + decryptStatus,
    );
  }
}

main().then(() => process.exit(0));
