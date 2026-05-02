import { createHash, timingSafeEqual } from "node:crypto";

// PKCE per RFC 7636. OAuth 2.1 mandates PKCE for ALL clients (not just
// public ones), and S256 is the only `code_challenge_method` we accept.
//
// The auth flow:
//   1. Client generates a random `code_verifier` (43-128 chars).
//   2. Computes `code_challenge` = base64url(SHA256(code_verifier)).
//   3. Sends code_challenge + method='S256' to /authorize.
//   4. /authorize stores both verbatim with the issued code.
//   5. On /token exchange, client sends code_verifier; we recompute and
//      timing-safe-compare against the stored code_challenge.

export type CodeChallengeMethod = "S256";

const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/; // base64url SHA256 hash

export function isValidVerifier(verifier: string): boolean {
  return VERIFIER_RE.test(verifier);
}

export function isValidChallenge(challenge: string): boolean {
  return CHALLENGE_RE.test(challenge);
}

export function isSupportedMethod(method: string): method is CodeChallengeMethod {
  return method === "S256";
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function computeChallenge(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function verifyChallenge(
  verifier: string,
  challenge: string,
  method: CodeChallengeMethod,
): boolean {
  if (method !== "S256") return false;
  if (!isValidVerifier(verifier)) return false;
  const expected = computeChallenge(verifier);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(challenge, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
