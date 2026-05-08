import { createInterface } from "node:readline";
import { defaultBaseUrl, readSession } from "../config.js";
import { authStart } from "./auth.js";

export type ParsedInput =
  | { kind: "slash"; verb: string; args: string[] }
  | { kind: "nl"; text: string }
  | { kind: "empty" };

export function parseInput(line: string): ParsedInput {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "empty" };
  if (trimmed.startsWith("/")) {
    const [verb, ...args] = trimmed.slice(1).split(/\s+/);
    return { kind: "slash", verb, args };
  }
  return { kind: "nl", text: trimmed };
}

const HELP = `
  /balance              show current balances
  /services [query]     list MPP services (filter by id/name/category)
  /auth                 re-pair this CLI session (use when bearer expires)
  /help                 show this help
  /clear                clear screen
  /exit                 quit

  Or just type a question — Pellet Agent will answer.
`;

function dim(s: string): string {
  return `\x1b[2m${s}\x1b[0m`;
}

function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}

async function streamNl(text: string): Promise<void> {
  const session = await readSession();
  if (!session) {
    process.stdout.write("  not authenticated — run `pellet auth start` first.\n");
    return;
  }
  const baseUrl = session?.baseUrl ?? defaultBaseUrl();
  const res = await fetch(`${baseUrl}/api/wallet/agent/chat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.bearer}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
  });

  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    process.stdout.write(`  ${body.message ?? "quota exhausted"}\n`);
    return;
  }
  if (res.status === 401 || res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    const msg = body.detail ?? body.error ?? `auth failed (${res.status})`;
    process.stdout.write(`  ${msg}\n`);
    process.stdout.write(`  → type /auth to re-pair your session.\n`);
    return;
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    process.stdout.write(`  request failed: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}\n`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
  }
  process.stdout.write("\n");
}

async function runSlash(verb: string, args: string[]): Promise<void> {
  const session = await readSession();
  if (
    !session &&
    verb !== "help" &&
    verb !== "clear" &&
    verb !== "exit" &&
    verb !== "auth"
  ) {
    process.stdout.write("  not authenticated — type /auth to pair.\n");
    return;
  }
  const baseUrl = session?.baseUrl ?? defaultBaseUrl();
  switch (verb) {
    case "help":
      process.stdout.write(HELP);
      return;
    case "clear":
      process.stdout.write("\x1b[2J\x1b[H");
      return;
    case "auth": {
      const baseFlag = args.find((a) => a.startsWith("--base="))?.slice("--base=".length);
      const labelFlag = args.find((a) => a.startsWith("--label="))?.slice("--label=".length);
      await authStart({
        baseUrl: baseFlag ?? session?.baseUrl,
        agentLabel: labelFlag,
      });
      return;
    }
    case "balance": {
      const res = await fetch(`${baseUrl}/api/wallet/balance`, {
        headers: { authorization: `Bearer ${session!.bearer}` },
      });
      const body = (await res.json()) as { balances?: Array<{ symbol: string; display: string }> };
      for (const b of body.balances ?? []) {
        process.stdout.write(`  ${b.symbol.padEnd(10)} ${b.display}\n`);
      }
      return;
    }
    case "services": {
      const res = await fetch(`${baseUrl}/api/services`);
      const body = (await res.json()) as {
        services?: Array<{ id: string; label?: string; name?: string; category: string }>;
      };
      const q = args.join(" ").toLowerCase();
      const filtered = q
        ? (body.services ?? []).filter((s) =>
            [s.id, s.label, s.name, s.category].some((f) => f?.toLowerCase().includes(q)),
          )
        : body.services ?? [];
      for (const s of filtered) {
        const name = s.label ?? s.name ?? s.id;
        process.stdout.write(`  ${s.id.padEnd(20)} ${name.padEnd(20)} ${dim(s.category)}\n`);
      }
      return;
    }
    case "exit":
      process.exit(0);
    default:
      process.stdout.write(`  unknown command: /${verb}. Try /help.\n`);
  }
}

export async function runAgentRepl(): Promise<number> {
  process.stdout.write(`\n  ${bold("Pellet Agent")} ready. Ask anything, or /help for commands.\n\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  rl.setPrompt("pellet> ");
  rl.prompt();

  for await (const line of rl) {
    const parsed = parseInput(line);
    try {
      if (parsed.kind === "slash") await runSlash(parsed.verb, parsed.args);
      else if (parsed.kind === "nl") await streamNl(parsed.text);
    } catch (e) {
      process.stdout.write(`  error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
    rl.prompt();
  }
  return 0;
}
