import { and, eq, isNull, isNotNull, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletSessions } from "@/lib/db/schema";

export async function findActiveSession(userId: string) {
  const rows = await db
    .select({ id: walletSessions.id })
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.userId, userId),
        isNull(walletSessions.revokedAt),
        isNotNull(walletSessions.authorizeTxHash),
        gt(walletSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(walletSessions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
