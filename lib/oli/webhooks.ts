// Server-side fetch helpers for the OLI webhooks UI. The API/dispatcher is
// built by a parallel agent; this module shapes the contract the UI reads.
// Helpers fail open: on 4xx/5xx/network we return null/[] so pages render
// an empty state rather than crashing.
//
// Types + display helpers live in webhooks-types.ts (client-safe). Don't
// import from this file in a client component — it depends on next/headers.

import { cookies, headers } from "next/headers";
import type {
  Subscription,
  SubscriptionDetail,
  Delivery,
} from "./webhooks-types";

export * from "./webhooks-types";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function forwardedCookie(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function apiFetch(
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<Response> {
  const origin = await getOrigin();
  const cookie = await forwardedCookie();
  return fetch(`${origin}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.headers ?? {}),
      cookie,
    },
  });
}

export async function listWebhooks(): Promise<Subscription[]> {
  try {
    const res = await apiFetch("/api/oli/webhooks");
    if (!res.ok) return [];
    const data = (await res.json()) as { subscriptions?: Subscription[] } | Subscription[];
    if (Array.isArray(data)) return data;
    return data.subscriptions ?? [];
  } catch {
    return [];
  }
}

export async function getWebhook(id: string): Promise<SubscriptionDetail | null> {
  try {
    const res = await apiFetch(`/api/oli/webhooks/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as SubscriptionDetail;
  } catch {
    return null;
  }
}

export async function listDeliveries(id: string): Promise<Delivery[]> {
  try {
    const res = await apiFetch(`/api/oli/webhooks/${encodeURIComponent(id)}/deliveries`);
    if (!res.ok) return [];
    const data = (await res.json()) as { deliveries?: Delivery[] } | Delivery[];
    if (Array.isArray(data)) return data;
    return data.deliveries ?? [];
  } catch {
    return [];
  }
}
