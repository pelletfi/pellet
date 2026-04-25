# Pellet — Agent Infrastructure Layer for Hyperliquid

Identity, execution, accountability for autonomous agents trading on-chain.

## What this is

Pellet is the middleware AI agents use to trade on Hyperliquid and build a verifiable reputation. It ships:

1. **ERC-8004 registries** on HyperEVM — Identity, Reputation, Validation. Block-pinned, re-verifiable, permissionless.
2. **TypeScript SDK** (`@pelletfi/hl`) — typed client for agents to mint IDs, read reputation, post attestations, route execution.
3. **MCP server** (`@pelletfi/hl-mcp`) — expose the SDK as tools for any AI agent (Claude, GPT, Hermes, etc.).
4. **Public dashboard** (`pellet.network`) — registry landing, per-agent profiles, live volume + reputation.

The Stripe parallel: Stripe is payment infrastructure for internet commerce. Pellet is agent infrastructure for on-chain finance.

## Repository structure

```
pellet-hl/
├── packages/
│   └── hl-contracts/          Foundry project — ERC-8004 registries
│       ├── src/
│       │   ├── IdentityRegistry.sol
│       │   ├── ReputationRegistry.sol
│       │   ├── ValidationRegistry.sol
│       │   └── interfaces/    Minimal interfaces for sister contracts + SDK
│       ├── test/              Foundry tests (30 tests, all passing)
│       └── script/            Deployment scripts
├── public/
│   └── brand/                 Brand v2 assets (mark + palette + copyright)
└── docs/
    ├── specs/                 Design specs
    └── plans/                 Implementation plans
```

## Quickstart

### Contracts

```bash
cd packages/hl-contracts
forge install OpenZeppelin/openzeppelin-contracts
forge build
forge test -vv
```

Expected: 30 passed, 0 failed.

### Deploy to HyperEVM testnet

```bash
cd packages/hl-contracts
cp .env.example .env
# Edit .env and set PRIVATE_KEY to a testnet-only deployer wallet
forge script script/Deploy.s.sol --rpc-url hyperevm_testnet --broadcast
```

## Relationship to earlier work

Pellet-on-Tempo (stablecoin intelligence, TIP-20 indexing) is archived at [`pelletnetwork/pellet-tempo-archive`](https://github.com/pelletnetwork/pellet-tempo-archive) for historical reference. This repo is the current, active direction — agent infrastructure for Hyperliquid. Different product, different audience, different brand system.

## Brand

- Primary: Navy `#00006D`
- Paper: `#E8F1F3`
- Typography: IBM Plex Mono + Inter
- Mark: `public/brand/pellet-mark.svg`
- License: MIT — full exclusive usage rights per `public/brand/copyright-transfer.pdf`

## Design + plans

- **Spec:** [`docs/specs/2026-04-22-pellet-hl-agent-infrastructure.md`](docs/specs/2026-04-22-pellet-hl-agent-infrastructure.md)
- **Phase 1 plan:** [`docs/plans/2026-04-22-pellet-hl-phase-1.md`](docs/plans/2026-04-22-pellet-hl-phase-1.md)

## License

MIT (contracts + SDK + MCP server). Brand assets per `public/brand/copyright-transfer.pdf`.
