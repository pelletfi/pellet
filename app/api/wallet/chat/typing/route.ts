import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireSession } from "@/lib/wallet/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/chat/typing
//
// Bearer-auth'd. Agent fires this to signal "I'm composing a response."
// The wallet UI shows a typing indicator until either the next message
// arrives OR an 8-second client-side timeout expires.
//
// Ephemeral — no DB write. We pg_notify directly with a payload of
// "userId:sessionId" so the bus can fan out to the right user's SSE
// streams. Skipping a row insert keeps the table clean (typing pings
// happen frequently during long agent responses).

export async function POST(req: Request) {
  const resolved = await requireSession(req);
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const payload = `${user.id}:${session.id}`;
  // pg_notify directly — no row, just the wire signal.
  await db.execute(sql`SELECT pg_notify('wallet_chat_typing', ${payload})`);

  return NextResponse.json({ ok: true });
}
