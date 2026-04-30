import { createServer } from "http";
import { randomBytes } from "crypto";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions, oliWebhookDeliveries } from "@/lib/db/schema";
import { dispatchToWebhooks } from "@/lib/oli/webhooks/dispatcher";
import { verify, SIGNATURE_HEADER } from "@/lib/oli/webhooks/signature";
import { eq } from "drizzle-orm";

type Captured = {
  headers: Record<string, string>;
  body: string;
  parsed: any;
  signatureValid: boolean;
};

async function main() {
  const eventId = 4182;
  const recipient = "0x7a23cf19274fe1ec21c502ba8fc112535b30aa77";
  const ownerUserId = "f164edd0-b5a8-4987-b77b-7ca0d5b8122d";
  const agentId = "enshrined-dex";

  const captured: Captured[] = [];
  const secret = randomBytes(32).toString("hex");

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const headers = Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)]),
      );
      const sig = headers[SIGNATURE_HEADER.toLowerCase()];
      const sigValid = verify(secret, sig, body);
      let parsed: any = null;
      try { parsed = JSON.parse(body); } catch {}
      captured.push({ headers, body, parsed, signatureValid: sigValid });
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no addr");
  const callbackUrl = `http://127.0.0.1:${addr.port}/hook`;
  console.log(`receiver: ${callbackUrl}`);

  await db.delete(oliWebhookSubscriptions).where(eq(oliWebhookSubscriptions.label, "smoke-test-1"));

  const [sub] = await db
    .insert(oliWebhookSubscriptions)
    .values({
      ownerUserId,
      callbackUrl,
      signingSecret: secret,
      label: "smoke-test-1",
      filters: { agent_id: agentId, recipient_address: recipient },
      status: "active",
      verifiedAt: new Date(),
    })
    .returning();
  console.log(`sub: ${sub.id} status=${sub.status}`);

  console.log(`dispatch #1 → eventId ${eventId}`);
  await dispatchToWebhooks(eventId);
  await sleep(2000);
  console.log(`captured after #1: ${captured.length} POST(s)`);

  const deliveries1 = await db
    .select()
    .from(oliWebhookDeliveries)
    .where(eq(oliWebhookDeliveries.subscriptionId, sub.id));
  console.log(`delivery rows after #1: ${deliveries1.length}`);

  console.log(`dispatch #2 (dedupe check)`);
  await dispatchToWebhooks(eventId);
  await sleep(1000);

  const deliveries2 = await db
    .select()
    .from(oliWebhookDeliveries)
    .where(eq(oliWebhookDeliveries.subscriptionId, sub.id));
  console.log(`delivery rows after #2: ${deliveries2.length}`);
  console.log(`captured after #2: ${captured.length} POST(s)`);

  const checks = {
    posted_exactly_once: captured.length === 1,
    delivery_row_inserted: deliveries1.length === 1,
    dedupe_blocked_second_insert: deliveries2.length === 1,
    delivery_status_delivered: deliveries2[0]?.status === "delivered",
    response_code_200: deliveries2[0]?.responseCode === 200,
    pellet_delivery_header_stable: !!captured[0]?.headers["pellet-delivery"],
    delivery_id_matches_header: captured[0]?.headers["pellet-delivery"] === deliveries2[0]?.deliveryId,
    signature_valid: captured[0]?.signatureValid === true,
    envelope_type: captured[0]?.parsed?.type === "oli.event.v1",
    envelope_subscription_id: captured[0]?.parsed?.subscription_id === sub.id,
    payload_event_id: captured[0]?.parsed?.data?.id === eventId,
    payload_recipient: (captured[0]?.parsed?.data?.counterparty_address ?? "").toLowerCase() === recipient,
  };

  console.log("\n── checks ─────────────────────────");
  let allPass = true;
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✓" : "✗"} ${k}`);
    if (!v) allPass = false;
  }

  await db.delete(oliWebhookSubscriptions).where(eq(oliWebhookSubscriptions.id, sub.id));
  server.close();

  console.log(allPass ? "\nALL PASS" : "\nFAILURES");
  process.exit(allPass ? 0 : 1);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

main().catch((e) => { console.error(e); process.exit(1); });
