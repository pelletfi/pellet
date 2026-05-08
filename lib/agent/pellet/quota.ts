// Per-user daily NL turn cap. In-memory; resets at UTC midnight or on
// process restart. Migrate to Postgres if multi-instance becomes a concern.

export const DAILY_NL_CAP = Number(process.env.PELLET_AGENT_DAILY_CAP ?? 100);

type Bucket = { dayKey: string; count: number };
const buckets = new Map<string, Bucket>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type QuotaResult = { allowed: boolean; remaining: number };

export async function checkAndIncrementQuota(userId: string): Promise<QuotaResult> {
  const today = todayKey();
  const cur = buckets.get(userId);
  if (!cur || cur.dayKey !== today) {
    buckets.set(userId, { dayKey: today, count: 1 });
    return { allowed: true, remaining: DAILY_NL_CAP - 1 };
  }
  if (cur.count >= DAILY_NL_CAP) {
    return { allowed: false, remaining: 0 };
  }
  cur.count += 1;
  return { allowed: true, remaining: DAILY_NL_CAP - cur.count };
}

export function _resetForTests(): void {
  buckets.clear();
}
