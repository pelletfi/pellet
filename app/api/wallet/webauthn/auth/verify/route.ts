import { NextResponse } from "next/server";
import { verifyAuthentication } from "@/lib/wallet/webauthn";
import { readChallenge, clearChallenge, setUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = {
  response: Parameters<typeof verifyAuthentication>[0]["response"];
};

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const challenge = await readChallenge();
  if (!challenge) {
    return NextResponse.json({ error: "no active challenge" }, { status: 400 });
  }

  // Pull the user by credential id (response.id is base64url of the cred id).
  const credId = body.response.id;
  const rows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.passkeyCredentialId, credId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "credential not registered" }, { status: 404 });
  }

  let result;
  try {
    result = await verifyAuthentication({
      response: body.response,
      expectedChallenge: challenge,
      credential: {
        id: user.passkeyCredentialId,
        publicKey: new Uint8Array(user.passkeyPublicKey),
        counter: user.passkeySignCount,
        transports: undefined,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verification failed", detail: String(e) },
      { status: 400 },
    );
  }

  if (!result.verified) {
    return NextResponse.json({ error: "authentication not verified" }, { status: 400 });
  }

  // Bump sign counter (replay protection signal — iCloud Keychain returns
  // 0 always, but security keys increment).
  await db
    .update(walletUsers)
    .set({
      passkeySignCount: result.authenticationInfo.newCounter,
      lastSeenAt: new Date(),
    })
    .where(eq(walletUsers.id, user.id));

  await clearChallenge();
  await setUserSession(user.id);

  return NextResponse.json({
    ok: true,
    user_id: user.id,
    managed_address: user.managedAddress,
  });
}
