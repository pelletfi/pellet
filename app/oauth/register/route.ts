import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { oauthClients } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /oauth/register
//
// RFC 7591 Dynamic Client Registration. Lets MCP clients (Claude Code,
// Claude Desktop, Cursor, etc.) self-register without a user manually
// inserting them into the DB.
//
// Open registration — no authentication required. Safe because:
//   * All clients are public (no client_secret issued)
//   * Tokens require user OAuth approval via passkey (real auth gate)
//   * Tokens are audience-bound (RFC 8707) — can't be replayed
//   * Scopes are least-privilege; user approves each via consent UI
//
// We accept the standard RFC 7591 metadata fields and ignore unknown
// ones (forward-compatible). We require `redirect_uris` because that's
// our gate against OAuth redirect attacks.

const MAX_REDIRECT_URIS = 10;
const MAX_CLIENT_NAME_LEN = 200;

function isHttpsOrLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return true;
    if (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function err(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { "cache-control": "no-store" } },
  );
}

type RegisterBody = {
  client_name?: unknown;
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  scope?: unknown;
  client_uri?: unknown;
  software_id?: unknown;
  software_version?: unknown;
};

export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return err("invalid_request", "body must be JSON");
  }

  // redirect_uris is required + must contain at least one https/localhost URI.
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return err("invalid_redirect_uri", "redirect_uris is required");
  }
  if (body.redirect_uris.length > MAX_REDIRECT_URIS) {
    return err(
      "invalid_redirect_uri",
      `at most ${MAX_REDIRECT_URIS} redirect_uris`,
    );
  }
  const redirectUris: string[] = [];
  for (const u of body.redirect_uris) {
    if (typeof u !== "string" || !isHttpsOrLocalhost(u)) {
      return err(
        "invalid_redirect_uri",
        `redirect_uri must be https or http://localhost: ${String(u)}`,
      );
    }
    redirectUris.push(u);
  }

  // Token endpoint auth method — we only support 'none' (public clients
  // with PKCE). Reject anything else explicitly so clients know.
  const authMethod = body.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") {
    return err(
      "invalid_client_metadata",
      "token_endpoint_auth_method must be 'none' (PKCE-only public clients)",
    );
  }

  // Client name — derive from client_uri or use 'Unnamed Client' if
  // neither provided. RFC says client_name is optional.
  let clientName: string;
  if (typeof body.client_name === "string" && body.client_name.length > 0) {
    clientName = body.client_name.slice(0, MAX_CLIENT_NAME_LEN);
  } else if (typeof body.client_uri === "string") {
    try {
      clientName = new URL(body.client_uri).hostname;
    } catch {
      clientName = "Unnamed Client";
    }
  } else {
    clientName = "Unnamed Client";
  }

  // Mint a fresh client_id. UUIDv4 — opaque, not user-meaningful.
  const clientId = `dcr_${randomUUID()}`;
  const issuedAt = Math.floor(Date.now() / 1000);

  // Stash the metadata for forward-compat; we may surface it in the
  // consent UI later (e.g., software_id / software_version for "this
  // client identifies itself as ...").
  const metadata = {
    token_endpoint_auth_method: authMethod,
    grant_types: body.grant_types ?? ["authorization_code"],
    response_types: body.response_types ?? ["code"],
    scope: typeof body.scope === "string" ? body.scope : undefined,
    client_uri: typeof body.client_uri === "string" ? body.client_uri : undefined,
    software_id:
      typeof body.software_id === "string" ? body.software_id : undefined,
    software_version:
      typeof body.software_version === "string" ? body.software_version : undefined,
  };

  await db.insert(oauthClients).values({
    clientId,
    clientName,
    clientType: "dynamic",
    redirectUris,
    metadata,
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
