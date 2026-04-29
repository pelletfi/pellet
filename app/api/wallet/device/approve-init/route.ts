import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  walletDevicePairings,
  walletSessions,
  walletUsers,
} from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { generateSessionKey } from "@/lib/wallet/session-keys";
import { tempoChainConfig, ACCOUNT_KEYCHAIN_ADDRESS } from "@/lib/wallet/tempo-config";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 3.B.2 step 1 — generate the agent's session key, pre-create the
// wallet_session row, and return everything the browser needs to build a
// passkey-signed AccountKeychain.authorizeKey TempoTransaction itself.
// The actual on-chain call happens in the BROWSER (where the passkey
// lives); this endpoint is plumbing only.

type InitBody = {
  code: string;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
};

export async function POST(req: Request) {
  // 1. Authenticated user.
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json(
      { error: "not authenticated", detail: "complete passkey enrollment first" },
      { status: 401 },
    );
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
    return NextResponse.json({ error: "user not found" }, { status: 401 });
  }
  if (!user.publicKeyUncompressed) {
    return NextResponse.json(
      {
        error: "user missing uncompressed public key",
        detail:
          "run scripts/backfill-tempo-addresses.ts or re-enroll a passkey",
      },
      { status: 500 },
    );
  }

  // 2. Body validation.
  let body: InitBody;
  try {
    body = (await req.json()) as InitBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (
    !body.code ||
    !body.spend_cap_wei ||
    !body.per_call_cap_wei ||
    !body.session_ttl_seconds
  ) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  // 3. Pairing.
  const rows = await db
    .select()
    .from(walletDevicePairings)
    .where(eq(walletDevicePairings.code, body.code))
    .limit(1);
  const pairing = rows[0];
  if (!pairing) {
    return NextResponse.json({ error: "code not found" }, { status: 404 });
  }
  if (pairing.status !== "pending") {
    return NextResponse.json({ error: `pairing is ${pairing.status}` }, { status: 409 });
  }
  if (pairing.expiresAt.getTime() < Date.now()) {
    await db
      .update(walletDevicePairings)
      .set({ status: "expired" })
      .where(eq(walletDevicePairings.id, pairing.id));
    return NextResponse.json({ error: "code expired" }, { status: 410 });
  }

  // 4. Generate agent session key (encrypted at rest), pre-create the
  // wallet_session row with sentinel bearer hash. /approve-finalize will
  // (a) flip the pairing to approved and (b) record the on-chain tx hash
  // on this same session row.
  const sessionKey = generateSessionKey();
  const expiresAt = new Date(Date.now() + body.session_ttl_seconds * 1000);

  // Stash chosen caps on the pairing now so /approve-finalize can read them.
  await db
    .update(walletDevicePairings)
    .set({
      approvedUserId: user.id,
      approvedSpendCapWei: body.spend_cap_wei,
      approvedPerCallCapWei: body.per_call_cap_wei,
      approvedSessionTtlSeconds: body.session_ttl_seconds,
    })
    .where(eq(walletDevicePairings.id, pairing.id));

  await db.insert(walletSessions).values({
    userId: user.id,
    bearerTokenHash: `pending-${pairing.id}`,
    spendCapWei: body.spend_cap_wei,
    perCallCapWei: body.per_call_cap_wei,
    sessionKeyCiphertext: sessionKey.ciphertext,
    label: pairing.agentLabel,
    expiresAt,
  });

  // 5. Return chain config + identity material the browser needs.
  const chain = tempoChainConfig();
  return NextResponse.json({
    user_id: user.id,
    credential_id: user.passkeyCredentialId,
    public_key_uncompressed: user.publicKeyUncompressed,
    managed_address: user.managedAddress,
    rp_id: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network",
    agent_key_address: sessionKey.address,
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
    session_ttl_seconds: body.session_ttl_seconds,
  });
}
