import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-process log of the last N deliveries — accessible via GET for
// dev-time verification. Lives in module scope so it survives between
// requests within the same Vercel function instance.
type Delivery = {
  receivedAt: string;
  event: string | null;
  deliveryId: string;
  signatureVerified: boolean;
  body: unknown;
};
const RECENT_DELIVERIES: Delivery[] = [];
const MAX_DELIVERIES = 50;

// Dev-only webhook receiver — logs every chat-webhook delivery so we can
// verify the dispatcher end-to-end without standing up an external
// receiver. Hard-gated to non-production builds.
//
// Verifies the HMAC signature against the same secret the test client
// is provisioned with via `WEBHOOK_TEST_SECRET` env var (default: a
// fixed dev string). Logs whether the signature matched.

const TEST_SECRET = process.env.WEBHOOK_TEST_SECRET ?? "dev-test-webhook-secret";

function verifySignature(
  signature: string | null,
  deliveryId: string,
  ts: string,
  body: string,
): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;
  const provided = signature.slice("sha256=".length);
  const expected = createHmac("sha256", TEST_SECRET)
    .update(`${deliveryId}.${ts}.${body}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.text();
  const event = req.headers.get("x-pellet-event");
  const deliveryId = req.headers.get("x-pellet-delivery") ?? "";
  const ts = req.headers.get("x-pellet-timestamp") ?? "";
  const signature = req.headers.get("x-pellet-signature");

  const sigOk = verifySignature(signature, deliveryId, ts, body);

  console.log(
    `[webhook-sink] event=${event} delivery=${deliveryId} sig=${sigOk ? "OK" : "BAD"}`,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  RECENT_DELIVERIES.unshift({
    receivedAt: new Date().toISOString(),
    event,
    deliveryId,
    signatureVerified: sigOk,
    body: parsed,
  });
  if (RECENT_DELIVERIES.length > MAX_DELIVERIES) {
    RECENT_DELIVERIES.length = MAX_DELIVERIES;
  }

  return NextResponse.json({ received: true, signature_verified: sigOk });
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    count: RECENT_DELIVERIES.length,
    recent: RECENT_DELIVERIES,
  });
}
