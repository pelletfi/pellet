import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const HEX40 = /^0x[0-9a-f]{40}$/;
const UINT_STR = /^\d+$/;

// Type the raw filter input loosely; we narrow into a clean shape on the way out.
export type FilterInput = {
  agent_id?: unknown;
  recipient_address?: unknown;
  routed_to_address?: unknown;
  min_amount_wei?: unknown;
  token_address?: unknown;
};

export type CleanFilter = {
  agent_id: string;
  recipient_address?: string;
  routed_to_address?: string;
  min_amount_wei?: string;
  token_address?: string;
};

export type ValidationError = { error: string; detail?: string };

function isLowerHex40(s: unknown): s is string {
  return typeof s === "string" && HEX40.test(s);
}

export function validateCallbackUrl(raw: unknown): string | ValidationError {
  if (typeof raw !== "string" || !raw) {
    return { error: "callback_url required" };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "callback_url must be a valid URL" };
  }
  const isProd = process.env.NODE_ENV === "production";
  if (url.protocol === "https:") {
    return url.toString();
  }
  if (url.protocol === "http:" && !isProd) {
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return url.toString();
    }
  }
  return {
    error: "callback_url must use https:// (http://localhost:* allowed in dev)",
  };
}

export async function validateFilter(
  raw: unknown,
): Promise<CleanFilter | ValidationError> {
  if (!raw || typeof raw !== "object") {
    return { error: "filters must be an object" };
  }
  const f = raw as FilterInput;

  if (typeof f.agent_id !== "string" || !f.agent_id) {
    return { error: "filters.agent_id is required" };
  }
  const agentId = f.agent_id;

  // agent must exist + be active
  const agentRow = await db
    .select({ id: agents.id, active: agents.active })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.active, true)))
    .limit(1);
  if (agentRow.length === 0) {
    return {
      error: "filters.agent_id not found or inactive",
      detail: agentId,
    };
  }

  const out: CleanFilter = { agent_id: agentId };

  if (f.recipient_address !== undefined && f.recipient_address !== null) {
    if (!isLowerHex40(f.recipient_address)) {
      return {
        error: "filters.recipient_address must be lowercase 0x + 40 hex chars",
      };
    }
    out.recipient_address = f.recipient_address;
  }
  if (f.routed_to_address !== undefined && f.routed_to_address !== null) {
    if (!isLowerHex40(f.routed_to_address)) {
      return {
        error: "filters.routed_to_address must be lowercase 0x + 40 hex chars",
      };
    }
    out.routed_to_address = f.routed_to_address;
  }
  if (f.token_address !== undefined && f.token_address !== null) {
    if (!isLowerHex40(f.token_address)) {
      return {
        error: "filters.token_address must be lowercase 0x + 40 hex chars",
      };
    }
    out.token_address = f.token_address;
  }
  if (f.min_amount_wei !== undefined && f.min_amount_wei !== null) {
    if (typeof f.min_amount_wei !== "string" || !UINT_STR.test(f.min_amount_wei)) {
      return {
        error: "filters.min_amount_wei must be a non-negative integer string",
      };
    }
    out.min_amount_wei = f.min_amount_wei;
  }
  return out;
}
