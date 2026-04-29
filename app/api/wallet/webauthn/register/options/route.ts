import { NextResponse } from "next/server";
import { makeRegistrationOptions } from "@/lib/wallet/webauthn";
import { setChallenge } from "@/lib/wallet/challenge-cookie";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Browser kicks off passkey registration. We mint a fresh user id (the
// real wallet_users.id will be created at /verify time, keyed to this id).
export async function POST() {
  const userId = randomUUID();
  const options = await makeRegistrationOptions({
    userId,
    userName: `pellet user ${userId.slice(0, 8)}`,
  });
  await setChallenge(options.challenge);
  return NextResponse.json({ ...options, userId });
}
