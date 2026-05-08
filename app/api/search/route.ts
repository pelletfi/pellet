import { NextResponse } from "next/server";
import { search } from "@/lib/wallet/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const hits = await search(q);
  return NextResponse.json({ hits });
}
