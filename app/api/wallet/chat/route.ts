import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import {
  insertChatMessage,
  recentChatMessages,
  type WalletChatRow,
} from "@/lib/db/wallet-chat";
import {
  getConnectedAgent,
  getConnectedAgentForSession,
} from "@/lib/db/wallet-agent-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/chat
//
// Bearer-auth'd. Agent posts a message into the user's wallet chat thread.
// The pg_notify trigger on insert pushes the new row to the realtime bus,
// which any active SSE subscriber on /api/wallet/chat/stream picks up.
//
// Body: { content, kind?, metadata?, intentId? }
//   - kind defaults to 'status'. Valid: 'status' | 'question' |
//     'approval_request' | 'reply' | 'report'.
//   - intentId is reserved for 'approval_request' messages.
//
// GET /api/wallet/chat
//
// Bearer-auth'd. Returns the user's recent chat messages (newest first).

const VALID_KINDS = new Set([
  "status",
  "question",
  "approval_request",
  "reply",
  "report",
]);

const MAX_CONTENT = 8_000;

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

  const { content, kind, metadata, intentId } = body as {
    content?: unknown;
    kind?: unknown;
    metadata?: unknown;
    intentId?: unknown;
  };

  if (typeof content !== "string" || content.length === 0) {
    return NextResponse.json(
      { error: "content must be a non-empty string" },
      { status: 400 },
    );
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json(
      { error: `content exceeds ${MAX_CONTENT} chars` },
      { status: 400 },
    );
  }

  const resolvedKind = typeof kind === "string" ? kind : "status";
  if (!VALID_KINDS.has(resolvedKind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${Array.from(VALID_KINDS).join(", ")}` },
      { status: 400 },
    );
  }

  const row = await insertChatMessage({
    userId: user.id,
    connectionId: connection?.id ?? null,
    clientId: connection?.clientId ?? null,
    sessionId: session.id,
    sender: "agent",
    kind: resolvedKind as WalletChatRow["kind"],
    content,
    intentId: typeof intentId === "string" ? intentId : null,
    metadata: metadata ?? null,
  });

  return NextResponse.json({ message: row }, { status: 201 });
}

export async function GET(req: Request) {
  const resolved = await requireSession(req);
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const { searchParams } = new URL(req.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 50;

  const connectionId = searchParams.get("connectionId") ?? searchParams.get("agent");
  const connection = connectionId
    ? await getConnectedAgent({
        userId: user.id,
        connectionId,
      })
    : await getConnectedAgentForSession({
        userId: user.id,
        sessionId: session.id,
      });
  if (connectionId && !connection) {
    return NextResponse.json({ error: "agent connection not found" }, { status: 404 });
  }
  const rows = await recentChatMessages(user.id, limit, {
    connectionId: connection?.id ?? null,
  });
  return NextResponse.json({ messages: rows });
}
