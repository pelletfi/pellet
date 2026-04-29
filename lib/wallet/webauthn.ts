// Pellet Wallet WebAuthn config + helpers.
//
// Phase 2 lays the passkey enrollment + login surface. Phase 3 wires the
// resulting credential to an on-chain Tempo account via AccountKeychain.
// For now, managedAddress is a deterministic placeholder derived from the
// credential id (NOT a real on-chain address — phase 3 replaces this).

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";

// ── Relying-party config ─────────────────────────────────────────────────

export type WebAuthnEnv = {
  rpId: string;
  rpName: string;
  origin: string;
};

export function webauthnEnv(): WebAuthnEnv {
  // In Vercel preview/prod, NEXT_PUBLIC_BASE_URL or VERCEL_URL surfaces the
  // host. Locally, defaults to localhost:3000. The RP id MUST match the
  // browser's origin host (no scheme, no port) — passkeys are scoped to
  // exactly that label.
  const explicit = process.env.NEXT_PUBLIC_RP_ID;
  if (explicit) {
    return {
      rpId: explicit,
      rpName: "Pellet Wallet",
      origin: process.env.NEXT_PUBLIC_RP_ORIGIN ?? `https://${explicit}`,
    };
  }
  if (process.env.VERCEL_ENV === "production") {
    return {
      rpId: "pellet.network",
      rpName: "Pellet Wallet",
      origin: "https://pellet.network",
    };
  }
  return {
    rpId: "localhost",
    rpName: "Pellet Wallet (dev)",
    origin: "http://localhost:3000",
  };
}

// ── Registration ─────────────────────────────────────────────────────────

export async function makeRegistrationOptions(opts: {
  userId: string;
  userName: string;
  excludeCredentialIds?: string[];
}) {
  const env = webauthnEnv();
  const config: GenerateRegistrationOptionsOpts = {
    rpName: env.rpName,
    rpID: env.rpId,
    userID: new TextEncoder().encode(opts.userId),
    userName: opts.userName,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: (opts.excludeCredentialIds ?? []).map((id) => ({ id })),
    authenticatorSelection: {
      // Platform passkeys preferred (cross-device sync via iCloud Keychain
      // / Google Password Manager). Don't require resident keys; allow
      // non-discoverable credentials so security keys still work.
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  };
  return generateRegistrationOptions(config);
}

export async function verifyRegistration(opts: {
  response: VerifyRegistrationResponseOpts["response"];
  expectedChallenge: string;
}) {
  const env = webauthnEnv();
  return verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: env.origin,
    expectedRPID: env.rpId,
    requireUserVerification: false,
  });
}

// ── Authentication ───────────────────────────────────────────────────────

export async function makeAuthenticationOptions(opts: {
  allowCredentialIds?: string[];
}) {
  const env = webauthnEnv();
  const config: GenerateAuthenticationOptionsOpts = {
    rpID: env.rpId,
    timeout: 60_000,
    userVerification: "preferred",
    allowCredentials: (opts.allowCredentialIds ?? []).map((id) => ({ id })),
  };
  return generateAuthenticationOptions(config);
}

export async function verifyAuthentication(opts: {
  response: VerifyAuthenticationResponseOpts["response"];
  expectedChallenge: string;
  credential: VerifyAuthenticationResponseOpts["credential"];
}) {
  const env = webauthnEnv();
  return verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: env.origin,
    expectedRPID: env.rpId,
    credential: opts.credential,
    requireUserVerification: false,
  });
}

// ── Placeholder address derivation (phase 3 replaces this) ───────────────

// Phase 2: derive a deterministic, valid-looking 0x address from the
// credential id so wallet_users.managed_address is non-null and unique.
// This is NOT a real Tempo account address — funds sent here go nowhere.
// Phase 3 swaps this for the actual passkey-derived Tempo account.
export function placeholderAddressFromCredId(credId: string): string {
  // SHA-256 the cred id; take the last 20 bytes (40 hex chars). Stable per
  // credential, never collides in practice.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto");
  const hex = createHash("sha256").update(credId).digest("hex");
  return ("0x" + hex.slice(-40)).toLowerCase();
}
