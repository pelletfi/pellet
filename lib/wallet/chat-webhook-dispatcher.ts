import { createHmac, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletChatWebhookDeliveries } from "@/lib/db/schema";
import type { WalletChatRow } from "@/lib/db/wallet-chat";

// User-side chat messages are pushed to the durable agent connection they are
// addressed to. Unscoped legacy replies fan out to every connected webhook so
// old clients keep working.
//
// Fire-and-forget: failures are logged but never block the bus or the
// user's POST that triggered the message. A retry queue (mirroring the
// oli_webhook_deliveries pattern) ships in v2.
//
// Filter rule: only sender='user' messages dispatch. Agents don't need
// to be notified of their own posts (sender='agent') or system events.

const HEADER_SIGNATURE = "X-Pellet-Signature";
const HEADER_EVENT = "X-Pellet-Event";
const HEADER_DELIVERY = "X-Pellet-Delivery";
const HEADER_TIMESTAMP = "X-Pellet-Timestamp";

const POST_TIMEOUT_MS = 10_000;

type WebhookTarget = {
  clientId: string;
  url: string;
  secret: string | null;
};

async function findTargetsForUser(userId: string): Promise<WebhookTarget[]> {
  const rows = await db.execute<{
    client_id: string;
    webhook_url: string;
    webhook_secret: string | null;
  }>(sql`
    SELECT DISTINCT c.client_id, c.webhook_url, c.webhook_secret
    FROM oauth_clients c
    JOIN wallet_agent_connections cxn ON cxn.client_id = c.client_id
    WHERE cxn.user_id = ${userId}
      AND cxn.revoked_at IS NULL
      AND c.webhook_url IS NOT NULL
  `);
  return rows.rows.map((r) => ({
    clientId: r.client_id,
    url: r.webhook_url,
    secret: r.webhook_secret,
  }));
}

async function findTargetForClient(
  userId: string,
  clientId: string,
): Promise<WebhookTarget[]> {
  const rows = await db.execute<{
    client_id: string;
    webhook_url: string;
    webhook_secret: string | null;
  }>(sql`
    SELECT c.client_id, c.webhook_url, c.webhook_secret
    FROM oauth_clients c
    JOIN wallet_agent_connections cxn ON cxn.client_id = c.client_id
    WHERE cxn.user_id = ${userId}
      AND cxn.client_id = ${clientId}
      AND cxn.revoked_at IS NULL
      AND c.webhook_url IS NOT NULL
    LIMIT 1
  `);
  return rows.rows.map((r) => ({
    clientId: r.client_id,
    url: r.webhook_url,
    secret: r.webhook_secret,
  }));
}

function buildPayload(row: WalletChatRow) {
  return {
    type: "chat.message" as const,
    userId: row.userId,
    connectionId: row.connectionId,
    clientId: row.clientId,
    sessionId: row.sessionId,
    message: {
      id: row.id,
      sender: row.sender,
      kind: row.kind,
      content: row.content,
      intentId: row.intentId,
      ts: row.createdAt.toISOString(),
    },
  };
}

function signPayload(secret: string, deliveryId: string, ts: string, body: string): string {
  // Signed string includes deliveryId + timestamp + body so a captured
  // signature can't be replayed against a different payload or delivery.
  const signedBase = `${deliveryId}.${ts}.${body}`;
  return `sha256=${createHmac("sha256", secret).update(signedBase).digest("hex")}`;
}

async function postWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function dispatchUserChatToWebhooks(row: WalletChatRow): Promise<void> {
  // Filter: only user-sender messages (agents need to know about user
  // replies; we don't echo agent messages back to themselves).
  if (row.sender !== "user") return;

  const targets = row.clientId
    ? await findTargetForClient(row.userId, row.clientId)
    : await findTargetsForUser(row.userId);
  if (targets.length === 0) return;

  const payload = buildPayload(row);
  const body = JSON.stringify(payload);
  const ts = new Date().toISOString();

  // Parallel dispatch — webhooks are independent. Atomic claim per
  // (client, message) via the unique index prevents duplicate fan-out
  // when multiple bus listeners (multi-instance, HMR, etc.) all see the
  // same NOTIFY.
  await Promise.allSettled(
    targets.map(async (target) => {
      // Claim the dispatch slot. Returns the new row only on first
      // INSERT — every other instance gets nothing back and bails.
      const claim = await db
        .insert(walletChatWebhookDeliveries)
        .values({
          clientId: target.clientId,
          messageId: row.id,
          userId: row.userId,
          attemptCount: 1,
        })
        .onConflictDoNothing({
          target: [
            walletChatWebhookDeliveries.clientId,
            walletChatWebhookDeliveries.messageId,
          ],
        })
        .returning({ id: walletChatWebhookDeliveries.id });
      if (claim.length === 0) {
        // Another instance already dispatched (or is dispatching) this
        // (client, message). Skip — at-most-once guarantee.
        return;
      }
      const deliveryRowId = claim[0].id;
      const deliveryId = randomUUID();
      const signature = target.secret
        ? signPayload(target.secret, deliveryId, ts, body)
        : "unsigned";
      const headers: Record<string, string> = {
        [HEADER_EVENT]: payload.type,
        [HEADER_DELIVERY]: deliveryId,
        [HEADER_TIMESTAMP]: ts,
        [HEADER_SIGNATURE]: signature,
      };
      const result = await postWithTimeout(target.url, headers, body);
      // Update the row with the outcome — useful for the future
      // deliveries-drawer UI in the wallet.
      await db
        .update(walletChatWebhookDeliveries)
        .set({
          status: result.ok ? "delivered" : "failed",
          httpStatus: result.status,
          deliveredAt: result.ok ? new Date() : null,
          lastError: result.ok ? null : `HTTP ${result.status}`,
        })
        .where(eq(walletChatWebhookDeliveries.id, deliveryRowId))
        .catch(() => {});
      if (!result.ok) {
        console.warn(
          `[chat-webhook] ${target.clientId} → ${target.url} failed: HTTP ${result.status}`,
        );
      }
    }),
  );
}
