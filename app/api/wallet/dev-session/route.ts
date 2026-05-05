import { NextResponse } from "next/server";
import { setUserSession } from "@/lib/wallet/challenge-cookie";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 403 });
  }
  await setUserSession("7331783e-8e9d-4ca8-973e-8711a68307f1");
  return NextResponse.json({ ok: true });
}
