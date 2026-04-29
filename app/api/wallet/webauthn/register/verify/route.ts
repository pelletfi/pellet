import { NextResponse } from "next/server";
import { verifyRegistration, placeholderAddressFromCredId } from "@/lib/wallet/webauthn";
import { readChallenge, clearChallenge, setUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = {
  response: Parameters<typeof verifyRegistration>[0]["response"];
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

  let result;
  try {
    result = await verifyRegistration({
      response: body.response,
      expectedChallenge: challenge,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verification failed", detail: String(e) },
      { status: 400 },
    );
  }

  if (!result.verified || !result.registrationInfo) {
    return NextResponse.json({ error: "registration not verified" }, { status: 400 });
  }

  const { credential } = result.registrationInfo;
  // Credential ID is already a base64url string in v13+ of @simplewebauthn.
  // (The signature on isoBase64URL.fromBuffer is strict ArrayBuffer-backed
  // Uint8Array, which the credential.id type isn't, so just use the string.)
  const credIdRaw = credential.id;
  const credId =
    typeof credIdRaw === "string"
      ? credIdRaw
      : isoBase64URL.fromBuffer(new Uint8Array(credIdRaw as Uint8Array));
  const publicKeyBuf = Buffer.from(credential.publicKey);
  const managedAddress = placeholderAddressFromCredId(credId);

  // Insert the wallet_user row. Conflict on cred id should be impossible
  // (we just minted a fresh credential), but guard against re-replays.
  const [user] = await db
    .insert(walletUsers)
    .values({
      passkeyCredentialId: credId,
      passkeyPublicKey: publicKeyBuf,
      managedAddress,
      passkeySignCount: credential.counter,
      displayName: null,
    })
    .returning({ id: walletUsers.id });

  await clearChallenge();
  await setUserSession(user.id);

  return NextResponse.json({
    ok: true,
    user_id: user.id,
    managed_address: managedAddress,
    credential_id: credId,
  });
}
