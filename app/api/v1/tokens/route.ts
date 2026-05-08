import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v0 stub — the landing's HeroTerminal queries this. Returns an empty list
// gracefully so the terminal renders the "no token data available" branch
// rather than crashing. Real token coverage rebuilds when the Wallet tokens
// surface re-lands.
export async function GET() {
  return NextResponse.json({ tokens: [] });
}
