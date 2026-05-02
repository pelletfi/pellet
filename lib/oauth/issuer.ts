// Single source of truth for the OAuth issuer URL + the MCP resource URI.
// Used by discovery endpoints, token audience binding, and the consent UI.
//
// In dev (no NEXT_PUBLIC_APP_URL), defaults to localhost so curl tests
// against `http://localhost:3000/.well-known/...` work without env setup.

export function appUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (env) return env.replace(/\/+$/, "");
  return "http://localhost:3000";
}

// The OAuth 2.1 issuer identifier. Tokens will list this as `iss` and
// metadata documents anchor here.
export function issuerUrl(): string {
  return appUrl();
}

// The MCP server's resource URI. Audience-binding (RFC 8707) — every
// access token is minted FOR this resource and checked at validation time.
export function mcpResourceUrl(): string {
  return `${appUrl()}/mcp`;
}

export function authorizationEndpoint(): string {
  return `${appUrl()}/oauth/authorize`;
}

export function tokenEndpoint(): string {
  return `${appUrl()}/oauth/token`;
}
