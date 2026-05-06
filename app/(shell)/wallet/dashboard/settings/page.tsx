import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers, walletSessions } from "@/lib/db/schema";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { SpecimenWalletSettings } from "./SpecimenWalletSettings";

export const metadata: Metadata = {
  title: "Settings — Pellet Wallet",
  description: "Passkey identity, session management, and account controls.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletSettingsPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/wallet/sign-in");

  const rows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) redirect("/wallet/sign-in");

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

  const pubKeyHex =
    user.publicKeyUncompressed ?? `0x${Buffer.from(user.passkeyPublicKey).toString("hex")}`;

  const chain = tempoChainConfig();

  return (
    <SpecimenWalletSettings
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
      chain={{ name: chain.name, chainId: chain.chainId, rpcUrl: chain.rpcUrl, explorerUrl: chain.explorerUrl }}
      basePath="/wallet"
    />
  );
}
