import { NextResponse } from "next/server";
import { issuerUrl, mcpResourceUrl } from "@/lib/oauth/issuer";
import { SCOPE_NAMES_ORDERED } from "@/lib/oauth/scopes";

export const runtime = "nodejs";
export const dynamic = "force-static";

// OAuth 2.0 Protected Resource Metadata (RFC 9728). Served at
// /.well-known/oauth-protected-resource. The Pellet MCP server returns
// `WWW-Authenticate: Bearer resource_metadata="<this URL>"` on 401, and
// MCP clients fetch this to discover which authorization server to use.

export function GET() {
  return NextResponse.json({
    resource: mcpResourceUrl(),
    authorization_servers: [issuerUrl()],
    scopes_supported: SCOPE_NAMES_ORDERED,
    bearer_methods_supported: ["header"],
    resource_documentation: `${issuerUrl()}/docs/mcp`,
  });
}
