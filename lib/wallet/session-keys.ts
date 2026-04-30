// Session-key generation + encryption for Pellet Wallet.
//
// Each approved agent gets a fresh secp256k1 EOA the server holds (encrypted)
// and signs payments with on the agent's behalf. The KEY POINT: this EOA
// only has spending authority because the user's passkey-rooted account
// will (in phase 3.B) call AccountKeychain.authorizeKey on Tempo to grant it
// caps + expiry. Even if our encryption-at-rest were compromised, an
// attacker can't exceed the caps the chain itself enforces.
//
// Encryption: AES-256-GCM with a 32-byte master key (WALLET_MASTER_KEY,
// base64url). Each ciphertext is { iv (12B), tag (16B), ct (32B) } packed
// as iv||tag||ct → 60 bytes. Stored as bytea on wallet_sessions.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

// Dev fallback fingerprint, surfaced via /api/wallet/debug-key in dev so
// the operator can sanity-check what's actually being used.
export const DEV_FALLBACK_MASTER_KEY_FINGERPRINT = "d4f5ccd3c37e7531";

let didWarnFallback = false;

function getMasterKey(): Buffer {
  const raw = process.env.WALLET_MASTER_KEY;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "WALLET_MASTER_KEY must be set (>=32 chars base64url) in production",
      );
    }
    // Dev fallback only — never used in prod (env check above). Warn once
    // per process so operators notice when their env didn't take effect
    // (the silent fallback caused 5 hours of "decrypt fails" debugging on
    // 2026-04-30 when an old key encrypted sessions and a later restart
    // dropped to fallback — every existing session became unrecoverable).
    if (!didWarnFallback) {
      didWarnFallback = true;
      console.warn(
        "[wallet/session-keys] WALLET_MASTER_KEY not set; using deterministic dev fallback. " +
          "Sessions encrypted with a different key will fail to decrypt. " +
          "Set WALLET_MASTER_KEY (>=32 base64url chars) and re-pair.",
      );
    }
    return Buffer.from(
      "dev-only-pellet-wallet-master-key-do-not-use-in-prod-32",
    ).subarray(0, 32);
  }
  // Accept either base64url (preferred) or hex.
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return Buffer.from(raw, "base64url");
}

export type GeneratedSessionKey = {
  /** secp256k1 private key, 0x-prefixed hex (32 bytes). Held in memory only. */
  privateKey: `0x${string}`;
  /** EOA address derived from privateKey. This is the keyId the user authorizes on-chain. */
  address: `0x${string}`;
  /** Ciphertext blob to persist (iv||tag||ct), 60 bytes. */
  ciphertext: Buffer;
};

export function generateSessionKey(): GeneratedSessionKey {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  // Encrypt the 32-byte private key bytes.
  const pkBytes = Buffer.from(privateKey.replace(/^0x/, ""), "hex");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getMasterKey(), iv);
  const ct = Buffer.concat([cipher.update(pkBytes), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    privateKey,
    address: account.address,
    ciphertext: Buffer.concat([iv, tag, ct]),
  };
}

export function decryptSessionKey(ciphertext: Buffer): `0x${string}` {
  if (ciphertext.length !== IV_LEN + TAG_LEN + 32) {
    throw new Error(`session key ciphertext: bad length ${ciphertext.length}`);
  }
  const iv = ciphertext.subarray(0, IV_LEN);
  const tag = ciphertext.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = ciphertext.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, getMasterKey(), iv);
  decipher.setAuthTag(tag);
  const pk = Buffer.concat([decipher.update(ct), decipher.final()]);
  if (pk.length !== 32) throw new Error("decrypted key: bad length");
  return ("0x" + pk.toString("hex")) as `0x${string}`;
}
