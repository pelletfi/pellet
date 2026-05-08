import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MPP_SERVICES } from "@/lib/mpp/registry";
import { loadWalletKnowledge } from "./knowledge/loader";
import { formatCatalogForPrompt } from "./catalog-injector";

const IDENTITY_AND_RULES = `You are Pellet Agent — a terminal-native assistant for the Pellet Wallet on Tempo.

You answer questions about the Pellet wallet, MPP / x402 services, balances, sessions, and on-chain state. You are concise. You think in terminal output: short, scannable, no marketing fluff.

# Hard rules
- You NEVER move funds yourself. Sends, swaps, and over-budget service calls always render a confirmation that the user must approve.
- You NEVER reveal or claim to know private keys, passkey credentials, or recovery phrases.
- You answer wallet/protocol questions from the knowledge base below — do not call tools for static knowledge.
- You call tools only for live state: balances, recent spend, session budget, current chat thread, swap/send quotes.

# Behavioral
- For natural-language requests that map to a slash command, propose the slash command and an inline (y/n) confirmation rather than executing.
- When recommending an MPP service, name the cheapest service that satisfies the user's need; mention price and approximate latency if known.
- If unsure, say so and suggest a slash command the user can run.
`;

let cheatsheetCache: string | null = null;

async function loadCheatsheet(): Promise<string> {
  if (cheatsheetCache !== null) return cheatsheetCache;
  const path = join(process.cwd(), "lib", "agent", "pellet", "knowledge", "wallet-cheatsheet.md");
  cheatsheetCache = await readFile(path, "utf8");
  return cheatsheetCache;
}

export async function buildSystemPrompt(): Promise<string> {
  const [wallet, cheatsheet] = await Promise.all([loadWalletKnowledge(), loadCheatsheet()]);
  const catalog = formatCatalogForPrompt(MPP_SERVICES);

  return [
    IDENTITY_AND_RULES,
    "# Pellet Wallet Cheatsheet",
    cheatsheet,
    "# Pellet Wallet Knowledge Base",
    wallet,
    "# MPP Service Catalog",
    catalog,
  ].join("\n\n");
}

export function _resetCheatsheetForTests(): void {
  cheatsheetCache = null;
}
