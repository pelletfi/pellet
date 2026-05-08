import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { readUserSession } from "@/lib/wallet/challenge-cookie";

// Resolves the owning wallet user for management endpoints. Accepts either
// a bearer-auth'd session (CLI / agent runtimes) OR the browser cookie set
// after the passkey ceremony. Returns the user id on success or a
// NextResponse to return verbatim.

export type OwnerContext = {
  userId: string;
  managedAddress: string | null;
};

export async function requireOwner(req: Request): Promise<OwnerContext | NextResponse> {
  // Bearer first — agents and the CLI authenticate this way and don't have
  // a cookie. We swallow the bearer-auth response if no Authorization header
  // is set so we can fall through to the cookie path.
  const hasAuthHeader = !!req.headers.get("authorization");
  if (hasAuthHeader) {
    const resolved = await requireSession(req);
    if (resolved instanceof NextResponse) return resolved;
    return {
      userId: resolved.user.id,
      managedAddress: resolved.user.managedAddress,
    };
  }

  // Cookie path — browser callers hitting /api/webhooks from the Wallet UI.
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json(
      { error: "not authenticated", detail: "send Authorization: Bearer <token> or sign in via passkey" },
      { status: 401 },
    );
  }
  const rows = await db
    .select({ id: walletUsers.id, managedAddress: walletUsers.managedAddress })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "wallet user missing" }, { status: 401 });
  }
  return { userId: user.id, managedAddress: user.managedAddress };
}
