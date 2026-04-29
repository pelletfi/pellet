import { NextResponse } from "next/server";
import { verifyRegistration } from "@/lib/wallet/webauthn";
import { readChallenge, clearChallenge, setUserSession } from "@/lib/wallet/challenge-cookie";
import { coseToUncompressed, passkeyAddress } from "@/lib/wallet/tempo-account";
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
    // Surface the exact reason — origin mismatch, RP id mismatch, signature
    // failure, etc. Helps diagnose without re-deploying. detail is safe to
    // expose since challenge is already consumed.
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[webauthn/register/verify]", detail);
    return NextResponse.json({ error: "verification failed", detail }, { status: 400 });
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

  // Phase 3.B.2: derive the REAL Tempo account address from the COSE
  // public key. Same shape as Ethereum derivation but over secp256r1.
  // Replaces placeholderAddressFromCredId from Phase 2.
  let managedAddress: string;
  let publicKeyUncompressed: string;
  try {
    publicKeyUncompressed = coseToUncompressed(publicKeyBuf);
    managedAddress = passkeyAddress(publicKeyUncompressed as `0x${string}`);
  } catch (e) {
    return NextResponse.json(
      {
        error: "could not derive Tempo address from passkey public key",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  // Insert the wallet_user row. Conflict on cred id should be impossible
  // (we just minted a fresh credential), but guard against re-replays.
  const [user] = await db
    .insert(walletUsers)
    .values({
      passkeyCredentialId: credId,
      passkeyPublicKey: publicKeyBuf,
      managedAddress,
      publicKeyUncompressed,
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
