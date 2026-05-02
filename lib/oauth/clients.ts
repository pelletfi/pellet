import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oauthClients } from "@/lib/db/schema";

// Client registration v1.
//
// Two registration paths shipped:
//   * 'cimd' (Client ID Metadata Document) — `client_id` IS the URL of an
//     RFC 7591-shaped metadata document. First time we see this client_id
//     we fetch the URL, validate basic shape, and cache the metadata. No
//     pre-registration required; this is the modern MCP-friendly path.
//   * 'pre' — manually inserted into oauth_clients, fixed redirect_uris.
//     Used for first-party clients (the wallet UI itself, internal tools).
//
// Dynamic client registration (RFC 7591 /register endpoint) ships in v2.

const METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type ClientMetadata = {
  client_name?: string;
  redirect_uris?: string[];
  // Other RFC 7591 fields (token_endpoint_auth_method, scope, etc.) are
  // accepted but not enforced in v1.
  [k: string]: unknown;
};

export type Client = {
  clientId: string;
  clientName: string;
  clientType: "cimd" | "pre" | "dynamic";
  redirectUris: string[];
  metadata: ClientMetadata | null;
};

function isHttpsOrLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function fetchAndCacheCimd(clientId: string): Promise<Client | null> {
  if (!isHttpsOrLocalhost(clientId)) return null;
  let metadata: ClientMetadata;
  try {
    const res = await fetch(clientId, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    metadata = (await res.json()) as ClientMetadata;
  } catch {
    return null;
  }
  const redirectUris = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris.filter((u): u is string => typeof u === "string" && isHttpsOrLocalhost(u))
    : [];
  if (redirectUris.length === 0) return null;
  const clientName =
    typeof metadata.client_name === "string" && metadata.client_name.length > 0
      ? metadata.client_name
      : new URL(clientId).hostname;

  await db
    .insert(oauthClients)
    .values({
      clientId,
      clientName,
      clientType: "cimd",
      metadataUrl: clientId,
      metadata,
      metadataFetchedAt: new Date(),
      redirectUris,
    })
    .onConflictDoUpdate({
      target: oauthClients.clientId,
      set: {
        clientName,
        metadata,
        metadataFetchedAt: new Date(),
        redirectUris,
        updatedAt: new Date(),
      },
    });

  return {
    clientId,
    clientName,
    clientType: "cimd",
    redirectUris,
    metadata,
  };
}

// Lookup by client_id. For CIMD clients, refreshes the cache if stale.
// Returns null if the client_id is unknown and not a fetchable CIMD URL.
export async function resolveClient(clientId: string): Promise<Client | null> {
  const rows = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  const row = rows[0];

  if (row) {
    const isStale =
      row.clientType === "cimd" &&
      (!row.metadataFetchedAt ||
        row.metadataFetchedAt.getTime() < Date.now() - METADATA_CACHE_TTL_MS);
    if (isStale) {
      const refreshed = await fetchAndCacheCimd(clientId);
      if (refreshed) return refreshed;
      // Fall through to stale-cache return.
    }
    return {
      clientId: row.clientId,
      clientName: row.clientName,
      clientType: row.clientType as Client["clientType"],
      redirectUris: row.redirectUris,
      metadata: row.metadata as ClientMetadata | null,
    };
  }

  // Unknown client_id — try CIMD discovery.
  return fetchAndCacheCimd(clientId);
}

// Validates that the supplied redirect_uri is one this client registered.
// Strict-equal match on the entire URI (including query/fragment) per OAuth
// 2.1 — no partial matching.
export function isAllowedRedirectUri(client: Client, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}
