import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const rows = await db
    .select({
      passkeyCredentialId: walletUsers.passkeyCredentialId,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
    })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user?.publicKeyUncompressed) {
    return NextResponse.json({ error: "user missing identity" }, { status: 500 });
  }

  const chain = tempoChainConfig();
  return NextResponse.json({
    chain_id: chain.chainId,
    rpc_url: chain.rpcUrl,
    sponsor_url: chain.sponsorUrl,
    usdc_e: chain.usdcE,
    demo_stable: chain.demoStable,
    rp_id: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network",
    credential_id: user.passkeyCredentialId,
    public_key_uncompressed: user.publicKeyUncompressed,
  });
}
