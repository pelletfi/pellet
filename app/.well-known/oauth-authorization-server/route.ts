import { NextResponse } from "next/server";
import {
  authorizationEndpoint,
  issuerUrl,
  tokenEndpoint,
} from "@/lib/oauth/issuer";
import { SCOPE_NAMES_ORDERED } from "@/lib/oauth/scopes";

export const runtime = "nodejs";
export const dynamic = "force-static";

// OAuth 2.1 Authorization Server Metadata (RFC 8414). Discovery document
// served at /.well-known/oauth-authorization-server. Used by MCP clients
// (Claude Code, Claude.ai Connectors, etc.) to find the authorize/token
// endpoints, supported scopes, PKCE methods, etc.
//
// Pellet only supports the authorization_code grant + PKCE (S256). No
// implicit, no password, no client_credentials. Public clients only —
// PKCE is the auth mechanism, no client secret.

export function GET() {
  return NextResponse.json({
    issuer: issuerUrl(),
    authorization_endpoint: authorizationEndpoint(),
    token_endpoint: tokenEndpoint(),
    scopes_supported: SCOPE_NAMES_ORDERED,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    // RFC 8707 Resource Indicators — clients MUST include `resource` in
    // their /authorize request to bind the issued token's audience.
    authorization_response_iss_parameter_supported: true,
  });
}
