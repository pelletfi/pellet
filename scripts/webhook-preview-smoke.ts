// Preview-deploy smoke: drives a real cross-region webhook delivery.
//
//  1. Inserts a sub + a queued retry-row in DB pointed at webhook.site.
//  2. Hits the preview's /api/cron/webhook-retry → fires attemptDelivery on Vercel.
//  3. Polls webhook.site for the captured POST.
//  4. Verifies signature, envelope, and that the DB row flipped to 'delivered'.
//
// Run after `git push` once the Vercel preview is live.

import { randomBytes } from "crypto";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions, oliWebhookDeliveries } from "@/lib/db/schema";
import { verify, SIGNATURE_HEADER } from "@/lib/oli/webhooks/signature";
import { eq } from "drizzle-orm";

const PREVIEW = "https://pellet-git-pellet-pellet.vercel.app";
const WEBHOOK_SITE = "https://webhook.site";
const TOKEN_UUID = process.env.WEBHOOK_SITE_TOKEN ?? "";

async function main() {
  const tokenUuid = TOKEN_UUID || (await mintToken());
  const callbackUrl = `${WEBHOOK_SITE}/${tokenUuid}`;
  const eventId = 4182;
  const recipient = "0x7a23cf19274fe1ec21c502ba8fc112535b30aa77";
  const ownerUserId = "f164edd0-b5a8-4987-b77b-7ca0d5b8122d";
  const agentId = "enshrined-dex";
  const secret = randomBytes(32).toString("hex");

  console.log(`receiver: ${callbackUrl}`);
  console.log(`viewer:   ${WEBHOOK_SITE}/#!/${tokenUuid}`);

  await db.delete(oliWebhookSubscriptions).where(eq(oliWebhookSubscriptions.label, "preview-smoke-1"));

  const [sub] = await db
    .insert(oliWebhookSubscriptions)
    .values({
      ownerUserId,
      callbackUrl,
      signingSecret: secret,
      label: "preview-smoke-1",
      filters: { agent_id: agentId, recipient_address: recipient },
      status: "active",
      verifiedAt: new Date(),
    })
    .returning();
  console.log(`sub: ${sub.id}`);

  const [delivery] = await db
    .insert(oliWebhookDeliveries)
    .values({
      subscriptionId: sub.id,
      eventId,
      status: "retry",
      nextRetryAt: new Date(Date.now() - 1000),
      attemptCount: 0,
    })
    .returning();
  console.log(`delivery: ${delivery.id} delivery_id=${delivery.deliveryId}`);

  console.log(`→ GET ${PREVIEW}/api/cron/webhook-retry`);
  const cronRes = await fetch(`${PREVIEW}/api/cron/webhook-retry`);
  const cronBody = await cronRes.text();
  console.log(`cron http=${cronRes.status} body=${cronBody.slice(0, 200)}`);

  const post = await pollWebhookSite(tokenUuid, delivery.deliveryId, 30);
  if (!post) {
    console.log("✗ no POST captured at webhook.site within 30s");
    process.exit(1);
  }
  console.log(`✓ webhook.site captured POST id=${post.uuid}`);

  const headers = post.headers ?? {};
  const sigHeader = pickHeader(headers, SIGNATURE_HEADER);
  const deliveryHeader = pickHeader(headers, "Pellet-Delivery");
  const subHeader = pickHeader(headers, "Pellet-Subscription");
  const rawBody: string = post.content ?? "";
  let parsed: any = null;
  try { parsed = JSON.parse(rawBody); } catch {}

  const sigValid = verify(secret, sigHeader, rawBody);

  const [after] = await db
    .select()
    .from(oliWebhookDeliveries)
    .where(eq(oliWebhookDeliveries.id, delivery.id));

  const checks = {
    cron_http_200: cronRes.status === 200,
    delivery_id_header_matches: deliveryHeader === delivery.deliveryId,
    subscription_header_matches: subHeader === sub.id,
    signature_valid: sigValid,
    envelope_type_v1: parsed?.type === "oli.event.v1",
    envelope_subscription_id: parsed?.subscription_id === sub.id,
    payload_event_id: parsed?.data?.id === eventId,
    payload_recipient_lowercased: (parsed?.data?.counterparty_address ?? "").toLowerCase() === recipient,
    db_status_delivered: after?.status === "delivered",
    db_response_code_200: after?.responseCode === 200,
    db_attempt_count_1: after?.attemptCount === 1,
  };

  console.log("\n── checks ─────────────────────────");
  let ok = true;
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✓" : "✗"} ${k}`);
    if (!v) ok = false;
  }

  await db.delete(oliWebhookSubscriptions).where(eq(oliWebhookSubscriptions.id, sub.id));

  console.log(ok ? "\nALL PASS" : "\nFAILURES");
  process.exit(ok ? 0 : 1);
}

async function mintToken(): Promise<string> {
  const res = await fetch(`${WEBHOOK_SITE}/token`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const j = (await res.json()) as { uuid: string };
  return j.uuid;
}

async function pollWebhookSite(tokenUuid: string, deliveryId: string, seconds: number): Promise<any | null> {
  for (let i = 0; i < seconds; i++) {
    const res = await fetch(`${WEBHOOK_SITE}/token/${tokenUuid}/requests?sorting=newest`);
    if (res.ok) {
      const j: any = await res.json();
      const reqs: any[] = j?.data ?? [];
      const match = reqs.find((r) => pickHeader(r.headers ?? {}, "Pellet-Delivery") === deliveryId);
      if (match) return match;
    }
    await sleep(1000);
  }
  return null;
}

function pickHeader(h: Record<string, any>, key: string): string {
  const lk = key.toLowerCase();
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === lk) return Array.isArray(v) ? String(v[0]) : String(v);
  }
  return "";
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

main().catch((e) => { console.error(e); process.exit(1); });
