import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletSessions, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { generateSessionKey } from "@/lib/wallet/session-keys";
import {
  tempoChainConfig,
  ACCOUNT_KEYCHAIN_ADDRESS,
} from "@/lib/wallet/tempo-config";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IssueBody = {
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
  label?: string;
  client_id?: string;
};

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const userRows = await db
    .select({
      id: walletUsers.id,
      passkeyCredentialId: walletUsers.passkeyCredentialId,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
      managedAddress: walletUsers.managedAddress,
    })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (!user.publicKeyUncompressed) {
    return NextResponse.json(
      { error: "user missing uncompressed public key" },
      { status: 500 },
    );
  }

  let body: IssueBody;
  try {
    body = (await req.json()) as IssueBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (
    !body.spend_cap_wei ||
    !body.per_call_cap_wei ||
    !body.session_ttl_seconds
  ) {
    return NextResponse.json(
      { error: "missing required fields" },
      { status: 400 },
    );
  }

  const sessionKey = generateSessionKey();
  const expiresAt = new Date(Date.now() + body.session_ttl_seconds * 1000);

  const [row] = await db
    .insert(walletSessions)
    .values({
      userId: user.id,
      bearerTokenHash: `browser-${crypto.randomUUID()}`,
      spendCapWei: body.spend_cap_wei,
      perCallCapWei: body.per_call_cap_wei,
      sessionKeyCiphertext: sessionKey.ciphertext,
      label: body.label ?? null,
      expiresAt,
    })
    .returning({ id: walletSessions.id });

  const chain = tempoChainConfig();
  return NextResponse.json({
    session_id: row.id,
    credential_id: user.passkeyCredentialId,
    public_key_uncompressed: user.publicKeyUncompressed,
    managed_address: user.managedAddress,
    rp_id: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network",
    agent_key_address: sessionKey.address,
    agent_private_key: sessionKey.privateKey,
    chain: {
      id: chain.chainId,
      name: chain.name,
      rpc_url: chain.rpcUrl,
      sponsor_url: chain.sponsorUrl,
      explorer_url: chain.explorerUrl,
      usdc_e: chain.usdcE,
    },
    account_keychain_address: ACCOUNT_KEYCHAIN_ADDRESS,
    expiry_unix: Math.floor(expiresAt.getTime() / 1000),
    spend_cap_wei: body.spend_cap_wei,
    per_call_cap_wei: body.per_call_cap_wei,
    client_id: body.client_id ?? null,
  });
}
