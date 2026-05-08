import { createInterface } from "node:readline";
import { defaultBaseUrl, readSession } from "../config.js";

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
  /spend [days]         recent spend
  /services [query]     list MPP services
  /call <id>            call a service (interactive)
  /send                 start a guided send
  /swap                 start a guided swap
  /history              show recent chat history
  /budget               show session budget
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
  const baseUrl = defaultBaseUrl();
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
  if (!res.ok || !res.body) {
    process.stdout.write(`  request failed: ${res.status}\n`);
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
  if (!session && verb !== "help" && verb !== "clear" && verb !== "exit") {
    process.stdout.write("  not authenticated — run `pellet auth start` first.\n");
    return;
  }
  const baseUrl = defaultBaseUrl();
  switch (verb) {
    case "help":
      process.stdout.write(HELP);
      return;
    case "clear":
      process.stdout.write("\x1b[2J\x1b[H");
      return;
    case "balance": {
      const res = await fetch(`${baseUrl}/api/wallet/dashboard/balance`, {
        headers: { authorization: `Bearer ${session!.bearer}` },
      });
      const body = (await res.json()) as { balances?: Array<{ symbol: string; display: string }> };
      for (const b of body.balances ?? []) {
        process.stdout.write(`  ${b.symbol.padEnd(10)} ${b.display}\n`);
      }
      return;
    }
    case "services": {
      const q = args.join(" ");
      const url = q
        ? `${baseUrl}/api/services?q=${encodeURIComponent(q)}`
        : `${baseUrl}/api/services`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${session!.bearer}` },
      });
      const body = (await res.json()) as { services?: Array<{ id: string; name: string; category: string }> };
      for (const s of body.services ?? []) {
        process.stdout.write(`  ${s.id.padEnd(20)} ${s.name.padEnd(20)} ${dim(s.category)}\n`);
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
