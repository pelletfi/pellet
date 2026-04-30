#!/usr/bin/env node
// @pelletnetwork/cli — open agent wallet on Tempo.
//
// Phase 1: only `pellet auth start` and `pellet auth status` are wired.
// `pellet pay` lands in phase 4 once on-chain signing is plumbed.

import { authStart, authStatus, authRevoke } from "./commands/auth.js";
import { pay, type PayArgs } from "./commands/pay.js";
import { runMcpServer } from "./commands/mcp.js";

const args = process.argv.slice(2);
const [verb, sub, ...rest] = args;

async function main(): Promise<number> {
  if (!verb || verb === "help" || verb === "--help" || verb === "-h") {
    printHelp();
    return 0;
  }

  if (verb === "version" || verb === "--version" || verb === "-v") {
    // Mirrors package.json — kept hand-synced for v0; harvest from package.json later.
    console.log("0.1.0");
    return 0;
  }

  if (verb === "auth") {
    if (!sub || sub === "start") return authStart(parseAuthStartArgs(rest));
    if (sub === "status") return authStatus();
    if (sub === "revoke") return authRevoke();
    console.error(`unknown auth subcommand: ${sub}`);
    return 2;
  }

  if (verb === "pay") {
    return pay(parsePayArgs([sub, ...rest]));
  }

  if (verb === "mcp") {
    return runMcpServer();
  }

  console.error(`unknown command: ${verb}`);
  printHelp();
  return 2;
}

function parseAuthStartArgs(argv: string[]): { agentLabel?: string; baseUrl?: string } {
  const out: { agentLabel?: string; baseUrl?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--label" && argv[i + 1]) {
      out.agentLabel = argv[++i];
    } else if (a === "--base-url" && argv[i + 1]) {
      out.baseUrl = argv[++i];
    }
  }
  return out;
}

function parsePayArgs(argv: (string | undefined)[]): PayArgs {
  const out: PayArgs = {};
  const args = argv.filter((a): a is string => typeof a === "string");
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--to" && args[i + 1]) {
      out.to = args[++i];
    } else if (a === "--amount" && args[i + 1]) {
      out.amountUsdc = args[++i];
    } else if (a === "--amount-wei" && args[i + 1]) {
      out.amountWei = args[++i];
    } else if (a === "--memo" && args[i + 1]) {
      out.memo = args[++i];
    } else if (a === "--token" && args[i + 1]) {
      out.token = args[++i];
    }
  }
  return out;
}

function printHelp(): void {
  process.stdout.write(`pellet — open agent wallet on Tempo

usage:
  pellet auth start [--label <name>] [--base-url <url>]
                    pair this CLI to your Pellet Wallet via device-code

  pellet auth status
                    show the active session (caps, expiry, label)

  pellet auth revoke
                    drop the local bearer (server revoke comes in phase 3)

  pellet pay --to <address> --amount <usdc> [--memo <text>] [--token <addr>]
                    sign + submit a transferWithMemo on Tempo. uses the
                    agent's on-chain-authorized session key; spend is
                    capped by AccountKeychain at the chain level.
                    --amount in USDC (e.g. 1.50 = $1.50). Use --amount-wei
                    for raw 6-decimal wei. Defaults to chain's USDC.e
                    unless --token is provided.

  pellet mcp        run an MCP server on stdio so agent runtimes
                    (Claude Code, Cursor, Cloudflare Agents, Anthropic
                    API) can call pellet_status + pellet_pay as tools.
                    install line: see README "MCP install".

  pellet version    print version

env:
  PELLET_BASE_URL   override the API host (default https://pellet.network)

docs:
  https://pellet.network/wallet
  https://pellet.network/skill.md
`);
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
