import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers, walletSessions } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Settings } from "./Settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Settings — Pellet Wallet",
  description: "Passkey identity, session management, and account controls.",
};

export default async function SettingsPage() {
  redirect("/wallet");
}

export async function renderSettings(basePath: string) {
  const userId = await readUserSession();
  if (!userId) redirect(`${basePath}/sign-in`);

  const rows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) redirect(`${basePath}/sign-in`);

  const activeRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.userId, userId),
        isNull(walletSessions.revokedAt),
        sql`${walletSessions.expiresAt} > now()`,
      ),
    );
  const activeSessionCount = activeRows[0]?.count ?? 0;

  // Format passkey material for display. publicKeyUncompressed is hex; raw
  // passkey_public_key is COSE-encoded bytea — we just show a short hex prefix.
  const pubKeyHex = user.publicKeyUncompressed ?? `0x${Buffer.from(user.passkeyPublicKey).toString("hex")}`;

  return (
    <Settings
      user={{
        id: user.id,
        managedAddress: user.managedAddress,
        displayName: user.displayName,
        passkeyCredentialId: user.passkeyCredentialId,
        passkeyPubKeyHex: pubKeyHex,
        passkeySignCount: user.passkeySignCount,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt.toISOString(),
      }}
      activeSessionCount={activeSessionCount}
      basePath={basePath}
    />
  );
}
