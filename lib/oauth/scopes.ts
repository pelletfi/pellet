// Pellet wallet OAuth scope schema. Each scope is a least-privilege
// permission for an agent acting via an OAuth-issued bearer. Scope names
// are stable strings — agents request them at /authorize, the consent UI
// renders the human description for each, and resource servers (the MCP
// server) check `requireScope` before serving each tool.

export const SCOPES = {
  "wallet:read":
    "Read your balance, transaction history, and the list of your agents.",
  "wallet:chat":
    "Post messages to your wallet chat thread and read its history.",
  "wallet:spend:request":
    "Request your approval for transactions. You approve each one.",
  "wallet:spend:authorized":
    "Spend within an authorized Access Key cap (no per-transaction approval).",
  "wallet:keys:manage":
    "Issue or revoke access keys. Requires re-confirming with your passkey.",
} as const;

export type ScopeName = keyof typeof SCOPES;

const SCOPE_NAMES = new Set<string>(Object.keys(SCOPES));

export function isValidScope(s: string): s is ScopeName {
  return SCOPE_NAMES.has(s);
}

export function parseScopeParam(raw: string | null): {
  scopes: ScopeName[];
  invalid: string[];
} {
  if (!raw) return { scopes: [], invalid: [] };
  const parts = raw.split(/\s+/).filter(Boolean);
  const scopes: ScopeName[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (isValidScope(p)) scopes.push(p);
    else invalid.push(p);
  }
  return { scopes, invalid };
}

// Scopes that require step-up auth (a fresh passkey signature at consent
// time, regardless of the user's existing wallet session). Currently just
// keys:manage, which can issue or revoke spending authority.
const STEP_UP_SCOPES: ReadonlySet<ScopeName> = new Set(["wallet:keys:manage"]);

export function requiresStepUp(scopes: readonly ScopeName[]): boolean {
  return scopes.some((s) => STEP_UP_SCOPES.has(s));
}

export function describeScope(s: ScopeName): string {
  return SCOPES[s];
}

export const SCOPE_NAMES_ORDERED = Object.keys(SCOPES) as ScopeName[];
