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

- Primary: Pellet YInMn blue `#2E5090`
- Paper: `#FFFFFF`
- Typography: Courier Prime (body) + IBM Plex Mono (numeric/protocol) + Inter (sparingly)
- Mark: [`apps/web/public/brand/pellet-mark.svg`](apps/web/public/brand/pellet-mark.svg) (also `.png` and `-white.svg` for dark surfaces)
- Live tokens: [`apps/web/app/globals.css`](apps/web/app/globals.css) · system reference: [`apps/web/public/brand/README.md`](apps/web/public/brand/README.md)
- License: MIT — full exclusive usage rights per [`apps/web/public/brand/copyright-transfer.pdf`](apps/web/public/brand/copyright-transfer.pdf)

## Design + plans

- **Spec:** [`docs/specs/2026-04-22-pellet-hl-agent-infrastructure.md`](docs/specs/2026-04-22-pellet-hl-agent-infrastructure.md)
- **Phase 1 plan:** [`docs/plans/2026-04-22-pellet-hl-phase-1.md`](docs/plans/2026-04-22-pellet-hl-phase-1.md)

## License

MIT (contracts + SDK + MCP server). Brand assets per [`apps/web/public/brand/copyright-transfer.pdf`](apps/web/public/brand/copyright-transfer.pdf).
