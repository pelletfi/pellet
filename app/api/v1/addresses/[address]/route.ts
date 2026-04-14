import { NextResponse } from "next/server";
import { lookupLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const lc = address.toLowerCase();
  const label = await lookupLabel(lc);
  if (!label) {
    return NextResponse.json({ address: lc, label: null }, { status: 404 });
  }
  return NextResponse.json(label);
}
