import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Current OLI specification version that Pellet conforms to.  Keep this in
// sync with the version declared at the top of /docs/spec.mdx.  Consumers
// use the presence of this header to detect an OLI-aware service — per the
// spec, a response without this header MUST NOT be assumed conforming
// regardless of whether its shape matches §3-5.
const OLI_VERSION = "0.1";

// Only tag API responses.  The docs site, explorer, and marketing pages
// aren't OLI measurements — stamping them would dilute the signal.
const API_PREFIX = "/api/";

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.headers.set("X-OLI-Version", OLI_VERSION);
  return res;
}

export const config = {
  // Match every route under /api/* so both the free v1 surface and the
  // MPP-protocol mirrors carry the conformance header.
  matcher: ["/api/:path*"],
};
