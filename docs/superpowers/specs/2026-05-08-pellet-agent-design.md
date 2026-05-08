# Pellet Agent — Design

**Date:** 2026-05-08
**Status:** Draft for implementation

## Thesis

Pellet Agent is the cheapest and most effective agent in the MPP / x402 ecosystem. It lives in the existing Pellet terminal shell, is named `pellet`, and ships with built-in awareness of every MPP x402 service the catalog knows about.

Pellet Agent is *native* infra — it lives inside the Pellet stack, calls wallet/MPP libs directly, and is always on. BYOA (third-party agents connecting in via OAuth + MCP + webhooks) is a separate, unchanged path for power users.

## Surface

- **Default in wallet terminal:** terminal bridge auto-runs `pellet` (no args) at session start. Banner: `Pellet Agent ready. Ask anything, or /help for commands.`
- **Standalone:** `pellet agent` in a user's local shell (after `pellet auth`) opens the same REPL.
- **Slash commands** are deterministic, bypass the LLM, run instantly: `/balance`, `/spend`, `/services [query]`, `/call <service-id>`, `/send`, `/swap`, `/history`, `/budget`, `/help`, `/clear`, `/exit`.
- **Natural language** is forwarded to the LLM. The LLM either answers (read-only queries) or proposes a slash command + inline `(y/n)` confirm (action queries).

## Architecture

- **CLI (thin client):** new file `cli/src/commands/agent.ts`. Maintains REPL loop. Slash commands resolve client-side or hit deterministic API endpoints. NL input streams from `app/api/wallet/agent/chat/route.ts`.
- **Server agent loop:** `lib/agent/pellet/` houses system prompt, tool wiring, model router. Endpoint imports tools from `lib/wallet/*` and `lib/mpp/*` directly — no MCP, no HTTP between agent and tools.
- **AI plumbing:** Vercel AI Gateway via the AI SDK (v6). Model strings used as `"anthropic/claude-haiku-4-5"` through the gateway. `streamText` with prompt caching enabled.
- **Auth:** reuses existing wallet session in browser; reuses bearer token from `pellet auth` in standalone CLI.
- **Persistence:** reuse existing `wallet_chat` thread storage. One thread per user.

## Knowledge baked in — the "most effective" lever

Pellet Agent ships with two cached knowledge layers in the system prompt, both refreshed hourly, both fitting the Anthropic prompt-cache contract.

### 1. Wallet knowledge (so it answers most user questions without a round-trip)

Every Pellet user-facing doc in `content/docs/*.mdx` is loaded, stripped of frontmatter and MDX-only constructs, and injected as a **Pellet Knowledge Base** block. Sources:

- `index.mdx`, `wallet.mdx`, `wallet-cli.mdx`, `wallet-mcp.mdx`
- `mcp.mdx`, `webhooks.mdx`, `methodology.mdx`, `tempo-primer.mdx`
- `changelog.mdx`, anything under `api/`

Plus a curated cheat-sheet of high-value Q&A: passkey vs session-key auth, owner-direct vs paired sessions, BYOA flow, 402 auto-sign rules, swap routing, supported assets, error codes. Lives at `lib/agent/pellet/knowledge/wallet-cheatsheet.md` and is hand-curated.

The agent is instructed: *answer wallet questions from the knowledge base directly; only call tools for live state (balances, history, current budgets)*.

### 2. MPP / x402 service catalog (so it never has to discover)

- **Service catalog injection.** The full MPP service catalog (`lib/mpp/registry.ts`) is injected as a structured list: id, summary, pricing band, auth model, endpoint schemas.
- **Endpoint schemas pre-resolved.** Schemas live in the prompt; the agent never round-trips an x402 discovery call mid-conversation. Discovery happens at indexing time and updates the catalog.
- **Pricing intelligence.** Catalog includes per-call price, last-known latency, and known failure modes. Agent surfaces these proactively ("this will cost ~$0.03, takes ~2s").
- **Smart routing.** When a user asks for a capability ("scrape this URL", "find a person on LinkedIn", "send an email"), the agent maps to the cheapest catalog service that satisfies the schema. Tie-break: price → latency → success rate.
- **Session budget awareness.** Tool definitions include the user's current session budget; the agent refuses or escalates to confirmation when a proposed call would exceed budget.
- **Built-in protocols.** x402 micropay, MCP `-32042` catalog calls, and SIWX wallet-identity flows are hard-wired into the tool layer. The agent doesn't need to "discover" these.

## Tool surface (server-side, direct TS imports)

**Read-only (LLM may call freely):**
- `getBalance(userId)` — current balance
- `getRecentSpend(userId, range)` — spend history
- `getThread(userId, lastN)` — last N chat turns
- `listMppServices(filter?)` — catalog query
- `getServiceSchema(serviceId)` — endpoint shape + price
- `getSessionBudget(userId)` — current per-session budget + remaining
- `quoteSwap(from, to, amount)` — swap preview
- `quoteSend(to, amount, asset)` — send preview

**Action (gated):**
- `callMppService(serviceId, payload)` — auto-proceeds within session budget; over budget renders inline `(y/n)` confirmation
- `proposeSend(to, amount, asset)` — renders inline confirm; user `y` triggers deterministic send via existing wallet endpoint
- `proposeSwap(from, to, amount)` — same pattern

**Hard rule:** the agent never moves funds itself. Money movement always renders a confirmation that the user must approve.

## Cost model — cheapest

- **Model:** Haiku 4.5 only. No Sonnet escalation. Wallet / MPP ops are bounded; Haiku handles them.
- **Slash commands bypass the LLM entirely.** Most common ops (balance, services, history) cost $0 inference.
- **Aggressive prompt caching:** system prompt + tool defs + service catalog cached 1h TTL. ~95% cache hit on input tokens target.
- **Context window cap:** last 8 turns max in the LLM call.
- **Output cap:** 512 tokens.
- **Estimated cost at 1,000 DAU:** under $15/month total inference.

## Free-tier limit

- **100 NL turns/day/user.** Slash commands uncapped. Cap chosen to be generous enough that normal users never hit it; cost still bounded (~$30/mo at 1,000 DAU).
- Cap value lives in env / config — easy to tune.
- On cap hit: REPL prints `Free Pellet Agent quota hit for today. Slash commands still work, or connect your own model via 'pellet mcp' to keep going.`

## Files added / changed

**New:**
- `cli/src/commands/agent.ts` — REPL client
- `lib/agent/pellet/index.ts` — agent loop entry
- `lib/agent/pellet/system-prompt.ts` — system prompt assembly
- `lib/agent/pellet/knowledge/loader.ts` — loads + flattens `content/docs/*.mdx` for the knowledge block
- `lib/agent/pellet/knowledge/wallet-cheatsheet.md` — hand-curated Q&A for high-value wallet questions
- `lib/agent/pellet/catalog-injector.ts` — formats MPP catalog for prompt injection
- `lib/agent/pellet/tools.ts` — tool definitions wrapping `lib/wallet/*` and `lib/mpp/*`
- `lib/agent/pellet/router.ts` — model selection (currently Haiku-only)
- `app/api/wallet/agent/chat/route.ts` — streaming endpoint
- `app/api/wallet/agent/quota/route.ts` — quota check / increment

**Modified:**
- `cli/src/index.ts` — register `agent` verb; default to agent REPL when invoked with no args inside the wallet shell
- `scripts/terminal-bridge.js` — auto-launch `pellet` at session start
- `package.json` — add `@ai-sdk/gateway`, `ai` (v6)

## Out of scope (YAGNI)

- No long-term memory beyond existing `wallet_chat` thread store
- No autonomous / standing-instruction mode
- No paid tier or premium model
- No custom-trained model
- No Sonnet escalation (revisit only if Haiku underperforms in measured eval)
- No agent-initiated fund movement under any circumstances
- No multi-agent coordination

## Resolved decisions

- **Daily NL turn cap:** 100/day/user. Generous enough that normal users never hit it; cost stays under ~$30/mo at 1,000 DAU.
- **Unrecognized input:** anything that isn't a slash command goes to the LLM. No `?` prefix required. Friction kills adoption; the LLM gracefully handles typos and shell muscle memory ("did you mean `/balance`?").
- **Knowledge / catalog refresh cadence:** hourly. Matches the prompt-cache TTL naturally and keeps cache hit rate above 95%.
