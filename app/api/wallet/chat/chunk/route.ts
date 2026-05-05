import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireSession } from "@/lib/wallet/bearer-auth";
import {
  insertChatMessage,
  updateChatMessageContent,
  getChatMessageById,
  type WalletChatRow,
} from "@/lib/db/wallet-chat";
import { getConnectedAgentForSession } from "@/lib/db/wallet-agent-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/chat/chunk
//
// Bearer-auth'd. Agent streams a response token-by-token.
//
// Start a stream (no messageId):
//   { delta: "Hello", kind?: "reply" }
//   → inserts a new message row with delta as initial content
//   → returns { messageId }
//   → INSERT trigger fires pg_notify wallet_chat (normal message flow)
//
// Continue streaming:
//   { messageId: "uuid", delta: " world" }
//   → fires pg_notify wallet_chat_chunk with the delta
//   → no DB write (ephemeral, like typing pings)
//
// Finish:
//   { messageId: "uuid", done: true, content: "Hello world!" }
//   → fires final pg_notify wallet_chat_chunk with done flag
//   → updates DB row with full content

const VALID_KINDS = new Set([
  "status",
  "question",
  "approval_request",
  "reply",
  "report",
]);

const MAX_CONTENT = 32_000;

export async function POST(req: Request) {
  const resolved = await requireSession(req);
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;
  const connection = await getConnectedAgentForSession({
    userId: user.id,
    sessionId: session.id,
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const { messageId, delta, done, content, kind } = body as {
    messageId?: string;
    delta?: string;
    done?: boolean;
    content?: string;
    kind?: string;
  };

  // --- Start a new stream ---
  if (!messageId) {
    if (typeof delta !== "string" || delta.length === 0) {
      return NextResponse.json(
        { error: "delta must be a non-empty string" },
        { status: 400 },
      );
    }
    const resolvedKind = typeof kind === "string" && VALID_KINDS.has(kind) ? kind : "reply";
    const row = await insertChatMessage({
      userId: user.id,
      connectionId: connection?.id ?? null,
      clientId: connection?.clientId ?? null,
      sessionId: session.id,
      sender: "agent",
      kind: resolvedKind as WalletChatRow["kind"],
      content: delta,
      metadata: { streaming: true },
    });
    return NextResponse.json({ messageId: row.id }, { status: 201 });
  }

  // --- Continue or finish an existing stream ---
  const existing = await getChatMessageById(messageId);
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }

  if (done) {
    const finalContent = typeof content === "string" ? content : existing.content;
    if (finalContent.length > MAX_CONTENT) {
      return NextResponse.json(
        { error: `content exceeds ${MAX_CONTENT} chars` },
        { status: 400 },
      );
    }
    await updateChatMessageContent(messageId, finalContent);
    const payload = JSON.stringify({
      messageId,
      userId: user.id,
      connectionId: connection?.id ?? null,
      delta: typeof delta === "string" ? delta : "",
      done: true,
    });
    await db.execute(sql`SELECT pg_notify('wallet_chat_chunk', ${payload})`);
    return NextResponse.json({ messageId, done: true });
  }

  if (typeof delta !== "string" || delta.length === 0) {
    return NextResponse.json(
      { error: "delta must be a non-empty string" },
      { status: 400 },
    );
  }

  const payload = JSON.stringify({
    messageId,
    userId: user.id,
    connectionId: connection?.id ?? null,
    delta,
    done: false,
  });
  await db.execute(sql`SELECT pg_notify('wallet_chat_chunk', ${payload})`);

  return NextResponse.json({ messageId });
}
