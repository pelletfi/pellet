// Pure types + display helpers — safe to import from client components.
// Server-only fetchers live in webhooks.ts (which imports next/headers).

export type SubscriptionStatus =
  | "pending_verify"
  | "active"
  | "paused"
  | "disabled_by_failures"
  | "deleted";

export type SubscriptionFilters = {
  agent_id: string;
  recipient_address?: string;
  routed_to_address?: string;
  min_amount_wei?: string;
  token_address?: string;
};

export type Subscription = {
  id: string;
  callback_url: string;
  label: string | null;
  filters: SubscriptionFilters;
  status: SubscriptionStatus;
  verified_at: string | null;
  consecutive_failures: number;
  created_at: string;
  last_delivered_at: string | null;
};

export type DeliveryStatus = "pending" | "in_flight" | "success" | "retry" | "dead";

export type Delivery = {
  id: string;
  delivery_id: string;
  event_id: number;
  attempt_count: number;
  status: DeliveryStatus;
  response_code: number | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type SubscriptionDetail = Subscription & {
  recent_delivery_counts?: Record<DeliveryStatus, number>;
};

export type CreateSubscriptionResponse = {
  id: string;
  signing_secret: string;
  verify_token: string;
} & Partial<Subscription>;

export type RotateSecretResponse = { signing_secret: string };

// ── Display helpers ──────────────────────────────────────────────────────

export function truncateMiddle(input: string, head = 24, tail = 18): string {
  if (input.length <= head + tail + 1) return input;
  return `${input.slice(0, head)}…${input.slice(-tail)}`;
}

export function shortAddr(addr: string | undefined | null): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function filterSummary(f: SubscriptionFilters | undefined | null): string {
  if (!f) return "—";
  const parts: string[] = [];
  if (f.agent_id) parts.push(`agent=${f.agent_id}`);
  if (f.recipient_address) parts.push(`recipient=${shortAddr(f.recipient_address)}`);
  if (f.routed_to_address) parts.push(`routed=${shortAddr(f.routed_to_address)}`);
  if (f.token_address) parts.push(`token=${shortAddr(f.token_address)}`);
  if (f.min_amount_wei) parts.push(`min=${f.min_amount_wei}`);
  return parts.length === 0 ? "—" : parts.join(" · ");
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (!Number.isFinite(diff) || diff < 0) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
