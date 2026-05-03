import { NextResponse } from "next/server";
import { consumeAuthorizationCode } from "@/lib/oauth/codes";
import { verifyChallenge, isSupportedMethod } from "@/lib/oauth/pkce";
import { issueAccessToken } from "@/lib/oauth/tokens";
import { recordAgentConnection } from "@/lib/db/wallet-agent-connections";
import type { ScopeName } from "@/lib/oauth/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /oauth/token
//
// OAuth 2.1 token endpoint. Public clients only (no client_secret) — PKCE
// is the auth mechanism. Only the authorization_code grant is supported.
//
// Request (form-urlencoded per RFC 6749):
//   grant_type=authorization_code
//   code=<code from /authorize redirect>
//   redirect_uri=<must equal the URI used at /authorize>
//   client_id=<must equal the client_id used at /authorize>
//   code_verifier=<the PKCE verifier whose SHA256 hash matches code_challenge>
//
// Response: { access_token, token_type: "Bearer", expires_in, scope }
//
// All errors return RFC-shaped { error, error_description } JSON.

function err(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  // RFC 6749 §3.2: token endpoint requires application/x-www-form-urlencoded.
  // Accept JSON too for ergonomics (some MCP clients may send JSON).
  const contentType = req.headers.get("content-type") ?? "";
  let params: URLSearchParams;
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, string>;
      params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "string") params.set(k, v);
      }
    } else {
      const text = await req.text();
      params = new URLSearchParams(text);
    }
  } catch {
    return err("invalid_request", "could not parse request body");
  }

  const grantType = params.get("grant_type");
  if (grantType !== "authorization_code") {
    return err(
      "unsupported_grant_type",
      "only authorization_code is supported",
    );
  }

  const code = params.get("code");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const codeVerifier = params.get("code_verifier");

  if (!code || !clientId || !redirectUri || !codeVerifier) {
    return err(
      "invalid_request",
      "code, client_id, redirect_uri, and code_verifier are all required",
    );
  }

  // Atomic single-use consume — race-safe.
  const codeRow = await consumeAuthorizationCode(code);
  if (!codeRow) {
    return err("invalid_grant", "code is invalid, expired, or already used");
  }

  // Validate code wasn't bound to a different client / redirect.
  if (codeRow.clientId !== clientId) {
    return err("invalid_grant", "client_id mismatch");
  }
  if (codeRow.redirectUri !== redirectUri) {
    return err("invalid_grant", "redirect_uri mismatch");
  }

  // PKCE verification — code_verifier must hash to the stored code_challenge.
  if (!isSupportedMethod(codeRow.codeChallengeMethod)) {
    return err("invalid_grant", "stored challenge method unsupported");
  }
  const valid = verifyChallenge(
    codeVerifier,
    codeRow.codeChallenge,
    codeRow.codeChallengeMethod,
  );
  if (!valid) {
    return err("invalid_grant", "code_verifier does not match");
  }

  // Mint the access token, audience-bound to the resource the code was for.
  // Scopes were validated at /authorize time before being stored, so we
  // can safely narrow the array type here.
  const scopes = codeRow.scopes as ScopeName[];
  const { token, tokenId, expiresAt } = await issueAccessToken({
    clientId: codeRow.clientId,
    userId: codeRow.userId,
    scopes,
    audience: codeRow.audience,
  });
  await recordAgentConnection({
    clientId: codeRow.clientId,
    userId: codeRow.userId,
    tokenId,
    scopes,
    audience: codeRow.audience,
  });
  const expiresInSeconds = Math.max(
    1,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );

  return NextResponse.json(
    {
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresInSeconds,
      scope: codeRow.scopes.join(" "),
    },
    { headers: { "cache-control": "no-store", pragma: "no-cache" } },
  );
}
