// Parses `?as_of=` from a request. Returns a Date or null (meaning "now").
//
// Accepted formats:
//   - ISO 8601 timestamp: "2026-04-14T12:00:00Z"
//   - Unix epoch seconds:  "1744632000"
//   - Relative duration:   "1h", "24h", "7d", "30m" (ago from now)
//   - Literal "now":       "now"
//
// Throws InvalidAsOfError on malformed input so the caller returns a 400.

export class InvalidAsOfError extends Error {
  constructor(input: string) {
    super(
      `Invalid as_of: "${input}". Expected ISO 8601 timestamp, unix seconds, ` +
        `relative duration (e.g. "1h", "24h", "7d"), or "now".`,
    );
    this.name = "InvalidAsOfError";
  }
}

const RELATIVE_RE = /^(\d+)(s|m|h|d|w)$/;
const UNITS_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export function parseAsOfParam(raw: string | null): Date | null {
  if (!raw || raw === "now") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Relative (e.g. "1h", "7d")
  const rel = trimmed.match(RELATIVE_RE);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const ms = UNITS_MS[unit];
    if (!ms || !isFinite(n)) throw new InvalidAsOfError(trimmed);
    return new Date(Date.now() - n * ms);
  }

  // Unix epoch seconds (all digits, reasonable length)
  if (/^\d{9,11}$/.test(trimmed)) {
    const epoch = parseInt(trimmed, 10);
    return new Date(epoch * 1000);
  }

  // ISO 8601 fallback
  const iso = new Date(trimmed);
  if (isNaN(iso.getTime())) throw new InvalidAsOfError(trimmed);

  // Reject future dates — time travel is historical only
  if (iso.getTime() > Date.now() + 60_000) {
    throw new InvalidAsOfError(`${trimmed} (future)`);
  }
  return iso;
}

export function parseAsOfFromRequest(req: Request): Date | null {
  const url = new URL(req.url);
  return parseAsOfParam(url.searchParams.get("as_of"));
}
