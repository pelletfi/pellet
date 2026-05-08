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

function buildHelp(): string {
  const row = (cmd: string, desc: string) =>
    `  ${C.cyan}${cmd.padEnd(20)}${C.rst}  ${C.dim}${desc}${C.rst}`;
  return [
    "",
    row("/balance", "show current balances"),
    row("/services [query]", "list MPP services (filter by id/name/category)"),
    row("/auth", "re-pair this CLI session (use when bearer expires)"),
    row("/help", "show this help"),
    row("/clear", "clear screen"),
    row("/exit", "quit"),
    "",
    `  ${C.dim}Or just type a question — Pellet Agent will answer.${C.rst}`,
    "",
  ].join("\n");
}

// Terminal palette — 256-color values matching the wallet's TerminalCard
// banner so the CLI feels like part of the same surface.
const C = {
  rst: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  blue: "\x1b[38;5;67m",   // muted accent — used for the >_ prompt and brand marks
  cyan: "\x1b[38;5;109m",  // softer accent — used for slashes and bullets
  green: "\x1b[38;5;108m", // success / live state
  red: "\x1b[38;5;167m",   // error
};

function dim(s: string): string {
  return `${C.dim}${s}${C.rst}`;
}

function bold(s: string): string {
  return `${C.bold}${s}${C.rst}`;
}

function accent(s: string): string {
  return `${C.blue}${s}${C.rst}`;
}

// Wrap ANSI in \x01..\x02 so readline doesn't count them toward prompt width.
function rlPrompt(visible: string, ansi: string): string {
  return `\x01${ansi}\x02${visible}\x01${C.rst}\x02`;
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
    process.stdout.write(`  ${C.red}${msg}${C.rst}\n`);
    process.stdout.write(`  ${C.dim}→ type${C.rst} ${accent("/auth")} ${C.dim}to re-pair your session.${C.rst}\n`);
    return;
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    process.stdout.write(`  request failed: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}\n`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  // Strip markdown emphasis/headings as we stream — terminal renders raw text,
  // so **bold** and ## heading would show literal markers. Keep a 1-char carry
  // so paired markers split across chunks still get stripped.
  let carry = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const raw = carry + decoder.decode(value, { stream: true });
    let chunk = raw;
    const last = chunk.charCodeAt(chunk.length - 1);
    if (last === 42 /* * */ || last === 95 /* _ */) {
      carry = chunk.slice(-1);
      chunk = chunk.slice(0, -1);
    } else {
      carry = "";
    }
    chunk = chunk
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/^#{1,6}\s+/gm, "");
    process.stdout.write(chunk);
  }
  if (carry) process.stdout.write(carry);
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
      process.stdout.write(buildHelp());
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
        process.stdout.write(
          `  ${C.bold}${b.symbol.padEnd(10)}${C.rst}${C.dim}${b.display}${C.rst}\n`,
        );
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
        process.stdout.write(
          `  ${C.cyan}${s.id.padEnd(20)}${C.rst}  ${name.padEnd(20)}  ${dim(s.category)}\n`,
        );
      }
      return;
    }
    case "exit":
      process.exit(0);
    default:
      process.stdout.write(
        `  ${C.red}unknown command:${C.rst} /${verb}. Try ${accent("/help")}.\n`,
      );
  }
}

export async function runAgentRepl(): Promise<number> {
  process.stdout.write(
    `\n  ${C.blue}${C.bold}>_${C.rst} ${bold("Pellet Agent")} ready. Ask anything, or type ${accent("/help")}.\n\n`,
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  rl.setPrompt(rlPrompt("pellet> ", `${C.bold}${C.blue}`));
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
