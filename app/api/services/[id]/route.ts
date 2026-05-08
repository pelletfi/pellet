import { NextResponse } from "next/server";
import { serviceDetail } from "@/lib/wallet/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await serviceDetail(id);
  if (!detail.head) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
