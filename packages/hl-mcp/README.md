# @pelletnetwork/hl-mcp

MCP server for Pellet's HyperEVM agent infrastructure. Exposes Identity, Reputation, and Validation registries as Model Context Protocol tools.

## Install

```bash
npm install -g @pelletnetwork/hl-mcp
```

Or run directly with npx:

```bash
npx @pelletnetwork/hl-mcp
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HL_CHAIN` | `mainnet` | `mainnet` or `testnet` |
| `HL_RPC_URL` | SDK default | Override RPC endpoint |
| `HL_IDENTITY_ADDRESS` | SDK default | Override Identity registry address |
| `HL_REPUTATION_ADDRESS` | SDK default | Override Reputation registry address |
| `HL_VALIDATION_ADDRESS` | SDK default | Override Validation registry address |
| `PRIVATE_KEY` | — | Required for write tools (`pellet_mint_agent_id`, `pellet_post_attestation`, `pellet_post_validation`) |

## Tools

### Read tools (no auth required)

- `pellet_read_agent` — `{ agentId: number }` → `{ controller, registeredAt, metadataURI }`
- `pellet_read_reputation` — `{ agentId: number }` → `Attestation[]`
- `pellet_read_validation` — `{ agentId: number }` → `Validation[]`

### Write tools (requires `PRIVATE_KEY`)

- `pellet_mint_agent_id` — `{ metadataURI: string }` → `{ agentId, txHash }`
- `pellet_post_attestation` — `{ agentId, attestationType, score, metadataURI }` → `{ attestationId, txHash }`
- `pellet_post_validation` — `{ agentId, claimHash, proofURI }` → `{ validationId, txHash }`

## Claude Code config

Add to your Claude Code MCP config (`~/.claude/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pellet": {
      "command": "npx",
      "args": ["@pelletnetwork/hl-mcp"],
      "env": {
        "HL_CHAIN": "mainnet"
      }
    }
  }
}
```

For write access, include `PRIVATE_KEY` in the `env` block.

## Example usage

Ask Claude:

> Read agent 1 from Pellet

Claude calls `pellet_read_agent` and returns:

```json
{
  "controller": "0x2cbd7730994D3Ee1aAc4B1d0F409b1b62d7C1834",
  "registeredAt": "1745600000",
  "metadataURI": "https://pellet.network/.well-known/agent.json"
}
```
