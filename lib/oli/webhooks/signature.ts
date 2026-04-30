import { createHmac, timingSafeEqual } from "crypto";

// Stripe-style signature: `t=<unix_seconds>,v1=<hex_hmac>`. The signed string
// is `${timestamp}.${rawBody}` so a swapped body OR a swapped timestamp both
// invalidate the HMAC. Tolerance window prevents replay of old signatures.

const HEADER_NAME = "Pellet-Signature";
const DEFAULT_TOLERANCE_SEC = 300;

export function sign(secret: string, timestamp: number, rawBody: string): string {
  const hmac = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

export function signNow(secret: string, rawBody: string): string {
  return sign(secret, Math.floor(Date.now() / 1000), rawBody);
}

function parseHeader(header: string): { t: number; v1: string } | null {
  const parts = header.split(",").map((s) => s.trim());
  let t: number | null = null;
  let v1: string | null = null;
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k === "t") t = Number(v);
    else if (k === "v1") v1 = v;
  }
  if (t === null || !Number.isFinite(t) || !v1) return null;
  return { t, v1 };
}

export function verify(
  secret: string,
  header: string | null | undefined,
  rawBody: string,
  toleranceSec: number = DEFAULT_TOLERANCE_SEC,
): boolean {
  if (!header) return false;
  const parsed = parseHeader(header);
  if (!parsed) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsed.t) > toleranceSec) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parsed.t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(parsed.v1, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SIGNATURE_HEADER = HEADER_NAME;
