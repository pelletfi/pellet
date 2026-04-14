# Launch thread — backend v1

Three options, pick one.

---

## Option A — Concise (Twitter/X, 5 tweets)

**1/** Pellet is now monitoring every TIP-20 stablecoin on Tempo end-to-end.

Peg health, supply dynamics, policy state, cross-stable flows, role holders, reserves — refreshed continuously, served as a free API.

🔗 pelletfi.com/explorer

**2/** Tempo runs on stablecoins. We index every event from genesis, sample peg pricing every block, and detect peg breaks the moment they happen.

12 stables. 36k+ events. Sub-minute latency.

**3/** New today: **forensic role discovery**.

Tempo's TIP-20 doesn't emit role events or expose enumeration. So we trace every mint/burn transaction with debug_traceTransaction, find the immediate caller, and verify with hasRole().

Result: real ISSUER addresses, derived from on-chain only.

**4/** Already discovered:
• USDC.e ISSUER → 0x8c76e2f6...
• USDT0 ISSUER → 0xaf37e8b6...

No other Tempo tool can show this. The data isn't in any standard event log — we're the only ones reconstructing it.

**5/** Webhooks, composite risk score, MCP server (`@pelletfi/mcp` for AI agents), full docs, status page.

All free tier or pay-per-call via MPP. No accounts.

📚 pelletfi.com/docs

---

## Option B — Long-form Farcaster post

We just shipped Pellet's full backend for Tempo stablecoin intelligence.

What's monitored, continuously and automatically:
→ Peg health (1h/24h/7d aggregates)
→ Detected peg-break events (mild + severe, in real time)
→ Composite risk scores (peg + supply + policy weighted)
→ Reserves and backing (per-stable, with attestation links)
→ Cross-stable flow anomalies (z-score detection)
→ Role holders (forensically derived — see below)
→ Webhooks for everything (HMAC-signed, retried, exponential backoff)

What's novel: **forensic role discovery**.

Tempo's TIP-20 RBAC doesn't emit role events and doesn't expose enumeration like OZ's AccessControlEnumerable. So no off-the-shelf indexer can show you who holds ISSUER_ROLE on a stable.

We do it by:
1. Indexing every Mint/Burn event (28k+ from full genesis backfill)
2. Calling debug_traceTransaction on each tx
3. Walking the call tree to find the immediate caller (msg.sender from the stable's POV)
4. Verifying with hasRole()

The data isn't in any standard log. We reconstruct it.

USDC.e ISSUER → 0x8c76e2f6c5ceda9aa7772e7eff30280226c44392
USDT0 ISSUER → 0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff

Try it: pelletfi.com/explorer

Or hit the API: https://pelletfi.com/api/v1/stablecoins/0x20c000000000000000000000b9537d11c60e8b50/roles

Or use the MCP server for your agent: `npm i -g @pelletfi/mcp`

---

## Option C — Single-tweet flex

We just figured out who actually holds ISSUER_ROLE on USDC.e and USDT0 on Tempo.

The data isn't in any event log — Tempo's TIP-20 doesn't emit role events.

We reconstructed it from debug_traceTransaction on every mint, then verified with hasRole().

Live now: pelletfi.com/explorer
