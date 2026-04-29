import { NextResponse } from "next/server";
import { makeAuthenticationOptions } from "@/lib/wallet/webauthn";
import { setChallenge } from "@/lib/wallet/challenge-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Browser kicks off passkey assertion (sign-in for an existing wallet user).
// We don't pre-filter by credential id — the user's authenticator will
// surface whatever Pellet credentials it holds for this RP.
export async function POST() {
  const options = await makeAuthenticationOptions({});
  await setChallenge(options.challenge);
  return NextResponse.json(options);
}
