import { NextResponse } from "next/server";
import { listAgents } from "@/lib/wallet/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ agents: await listAgents() });
}
