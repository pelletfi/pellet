import { NextResponse } from "next/server";
import { revokeAgentConnection } from "@/lib/db/wallet-agent-connections";
import { readUserSession } from "@/lib/wallet/challenge-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/agents/[id]/revoke
//
// Cookie-auth'd. Revokes the durable user/client connection and all of that
// client's non-revoked OAuth tokens for the signed-in wallet user.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "invalid agent id" }, { status: 400 });
  }

  const result = await revokeAgentConnection({ userId, connectionId: id });
  if (!result) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...result });
}
