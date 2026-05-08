// Pure function: given an attempt number (0-indexed; 0 = first attempt) and
// the current time, return when to attempt next, or null if we've exhausted
// retries. Steps: 30s, 2m, 10m, 30m, 2h, 6h, 12h. ±20% jitter on each step.

const STEPS_SEC = [30, 2 * 60, 10 * 60, 30 * 60, 2 * 60 * 60, 6 * 60 * 60, 12 * 60 * 60];

export const MAX_ATTEMPTS = STEPS_SEC.length + 1;

function jitter(baseSec: number): number {
  const span = baseSec * 0.4;
  return Math.round(baseSec - span / 2 + Math.random() * span);
}

/**
 * Returns the timestamp at which to retry next, or null if no more retries.
 *
 * `attempt` is the count of attempts already made. So `attempt=1` means the
 * first attempt has been made and we're scheduling the second; the first
 * step (30s) applies. Returning null means: stop, mark dead.
 */
export function nextRetryAt(attempt: number, now: Date): Date | null {
  if (attempt < 1) return null;
  const stepIdx = attempt - 1;
  if (stepIdx >= STEPS_SEC.length) return null;
  const delaySec = jitter(STEPS_SEC[stepIdx]);
  return new Date(now.getTime() + delaySec * 1000);
}
