import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { insertChatMessage } from "@/lib/db/wallet-chat";
import { getConnectedAgent } from "@/lib/db/wallet-agent-connections";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/chat/reply
//
// Cookie-auth'd. The user posts a reply into their chat thread from the
// wallet UI. Sender is forced to 'user' regardless of body. Kind defaults
// to 'reply'.
//
// If connectionId/agentId is supplied, the reply is scoped to that durable
// agent connection. The bus uses client_id to dispatch the reply only to that
// agent's registered webhook.

const MAX_CONTENT = 8_000;

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`chat:${userId}`, { max: 30, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const { content, intentId, connectionId, agentId } = body as {
    content?: unknown;
    intentId?: unknown;
    connectionId?: unknown;
    agentId?: unknown;
  };

  if (typeof content !== "string" || content.trim().length === 0) {
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

  const requestedConnectionId =
    typeof connectionId === "string"
      ? connectionId
      : typeof agentId === "string"
        ? agentId
        : null;
  const connection = requestedConnectionId
    ? await getConnectedAgent({ userId, connectionId: requestedConnectionId })
    : null;
  if (requestedConnectionId && !connection) {
    return NextResponse.json(
      { error: "agent connection not found" },
      { status: 404 },
    );
  }

  const row = await insertChatMessage({
    userId,
    connectionId: connection?.id ?? null,
    clientId: connection?.clientId ?? null,
    sessionId: null,
    sender: "user",
    kind: "reply",
    content: content.trim(),
    intentId: typeof intentId === "string" ? intentId : null,
  });

  return NextResponse.json({ message: row }, { status: 201 });
}
