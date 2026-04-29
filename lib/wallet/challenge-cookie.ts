// HTTP-only signed-cookie based WebAuthn challenge storage. Avoids a DB
// round-trip per registration / auth attempt; challenges are short-lived
// (5 min) and bound to the request that initiated them.
//
// The cookie value is `<challenge>.<expiresUnixMs>.<hmac>` — HMAC ensures
// we can't be tricked into accepting a forged challenge. Server-side secret
// is WALLET_CHALLENGE_SECRET (env var, required in production).

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pellet_wa_challenge";
const TTL_MS = 5 * 60 * 1000;

function getSecret(): string {
  const s = process.env.WALLET_CHALLENGE_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("WALLET_CHALLENGE_SECRET must be set (>=16 chars) in production");
    }
    // Dev fallback so the local server boots without env setup. NEVER use
    // in prod — the env check above guards it.
    return "dev-only-pellet-challenge-secret-do-not-use-in-prod";
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export async function setChallenge(challenge: string): Promise<void> {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${challenge}.${expiresAt}`;
  const sig = sign(payload);
  const value = `${payload}.${sig}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function readChallenge(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [challenge, expiresStr, sig] = parts;
  const payload = `${challenge}.${expiresStr}`;
  const expected = sign(payload);
  // constant-time compare
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(expiresStr)) return null;
  return challenge;
}

export async function clearChallenge(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// User session cookie — set after successful auth, used by /api/wallet/device/approve
// to know which user is approving.
const USER_COOKIE = "pellet_wa_user";
const USER_TTL_MS = 30 * 60 * 1000; // 30 min

export async function setUserSession(userId: string): Promise<void> {
  const expiresAt = Date.now() + USER_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = sign(payload);
  const value = `${payload}.${sig}`;
  const jar = await cookies();
  jar.set(USER_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_TTL_MS / 1000,
  });
}

export async function readUserSession(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(USER_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, sig] = parts;
  const payload = `${userId}.${expiresStr}`;
  const expected = sign(payload);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(expiresStr)) return null;
  return userId;
}

export async function clearUserSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(USER_COOKIE);
}
