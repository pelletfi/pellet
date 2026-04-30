# @pelletnetwork/cli

Open agent wallet on Tempo. Pair, approve, pay — every settlement recorded on the public [OLI ledger](https://pellet.network/oli).

## Install

```sh
npm i -g @pelletnetwork/cli
```

Or invoke without install:

```sh
npx -y @pelletnetwork/cli auth start
```

## Quick start

### 1. Pair this CLI to your wallet

```sh
pellet auth start
#
#   Starting connection…
#   └ Calling pellet auth start
#
#   Visit https://pellet.network/wallet/device?code=blue-tape-river
#   and follow the instructions to connect your Pellet wallet.
#   When prompted, verify or enter the following passphrase:
#   blue-tape-river
#
#   Waiting for approval…
```

In the browser: sign in with your passkey, pick spend caps, click Approve. Your passkey signs an `AccountKeychain.authorizeKey` transaction on Tempo (sponsored gas), the agent's session key gets on-chain authority bounded by the caps, and the CLI receives a bearer token.

### 2. Pay

```sh
pellet pay --to 0xRECIPIENT --amount 0.50 --memo "first payment"
#
#   ✓ payment confirmed.
#
#   from:      0x… (your agent EOA)
#   to:        0xRECIPIENT
#   amount:    $0.5000
#   memo:      0x… (keccak256 of "first payment")
#   tx:        0x…
#   explorer:  https://explore.testnet.tempo.xyz/tx/0x…
#
#   session: $0.50 of $5.00 used
```

Spend bounded by the on-chain caps Tempo enforces. No mobile prompt, no human-in-loop required for each tx — the chain is the policy engine.

### 3. (Optional) Use as an MCP server in your agent

Pellet bundles an MCP (Model Context Protocol) server so any agent runtime can call `pellet_status` and `pellet_pay` directly.

**Claude Code** — add to `~/.config/claude-code/mcp.json` (or run `claude-code mcp add pellet`):
```json
{
  "mcpServers": {
    "pellet": {
      "command": "npx",
      "args": ["-y", "@pelletnetwork/cli", "mcp"]
    }
  }
}
```

**Cursor** — Settings → MCP → Add Server:
```json
{
  "name": "pellet",
  "command": "npx",
  "args": ["-y", "@pelletnetwork/cli", "mcp"]
}
```

**Cloudflare Agents / Anthropic API direct** — point at `npx -y @pelletnetwork/cli mcp` over stdio.

Once installed, the agent can call `pellet_pay({ to, amount_usdc })` whenever it needs to settle a TIP-20 transfer on Tempo.

## Commands

| Command | What it does |
|---|---|
| `pellet auth start [--label <name>]` | Pair this CLI to your Pellet Wallet via device-code flow. |
| `pellet auth status` | Show current session — caps, expiry, label. |
| `pellet auth revoke` | Drop the local bearer (server-side revoke ships separately). |
| `pellet pay --to <addr> --amount <usdc> [--memo] [--token]` | Sign + submit a transferWithMemo on Tempo. |
| `pellet pay --to <addr> --amount-wei <wei>` | Same, but raw 6-decimal wei. |
| `pellet mcp` | Run as an MCP server on stdio for agent runtimes. |
| `pellet version` | Print version. |

## How it works

1. **Passkey** is the root of trust. Your WebAuthn credential is enrolled at `pellet.network/wallet/device` and persisted as a `wallet_users` row server-side. The address it derives is your **managed Tempo account**: `keccak256(uncompressed_p256_pubkey)[12:]`.
2. **Approve** triggers an on-chain `AccountKeychain.authorizeKey` T3 tx, signed by your passkey, sponsored gas via `sponsor.moderato.tempo.xyz`. The agent's secp256k1 session key is granted spending authority bounded by your caps.
3. **Each payment** is a `transferWithMemo` TempoTransaction signed by the session key, sponsored gas. The chain enforces caps at execution time. Server checks caps first too, so over-cap requests fail without wasting gas.
4. **Audit trail** is the public chain. Every payment has a deep-linkable Tempo tx hash. Pellet's [OLI dashboard](https://pellet.network/oli) ingests them automatically.

## Status

Phase 4 of the [v0 plan](https://github.com/pelletnetwork/pellet/blob/main/docs/wallet/research-2026-04-29.md). Live end-to-end against Moderato testnet (chainId 42431). **Don't trust mainnet funds yet** — mainnet sponsor + production-grade key custody land in Phase 5+.

## Env

| Var | Default | Use |
|---|---|---|
| `PELLET_BASE_URL` | saved at pair-time, falls back to `https://pellet.network` | Override API host (overrides the saved value too) |

## Links

- [pellet.network/wallet](https://pellet.network/wallet) — manifesto + roadmap
- [pellet.network/skill.md](https://pellet.network/skill.md) — agent install metadata
- [pellet.network/oli/methodology](https://pellet.network/oli/methodology) — the ledger every payment writes to

## License

MIT.
