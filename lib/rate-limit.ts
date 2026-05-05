import { NextResponse } from "next/server";

type Hit = number; // timestamp ms

const buckets = new Map<string, Hit[]>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs * 2;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => t > cutoff);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export function rateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): { ok: true } | { ok: false; response: NextResponse } {
  const now = Date.now();
  cleanup(windowMs);

  const hits = buckets.get(key) ?? [];
  const windowStart = now - windowMs;
  const recent = hits.filter((t) => t > windowStart);

  if (recent.length >= max) {
    const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(max),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  return { ok: true };
}
