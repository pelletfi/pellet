# Pellet — Agent Briefing

This file orients AI agents (Quill, Hermes, Claude, GPT, future systems) cold-loading into the Pellet project. Read this first, then proceed.

## What Pellet is

Pellet is agent infrastructure for Hyperliquid. Three ERC-8004 registries on HyperEVM mainnet (chain 999) — Identity, Reputation, Validation — for agents to mint IDs, post attestations, build verifiable reputation, and route execution through one typed surface. Block-pinned. Re-verifiable. Permissionless.

Stripe is payment infrastructure for internet commerce. Pellet is agent infrastructure for on-chain finance.

## Who's behind it

Jake Maynard. Founder. Operates as `@pelletnetwork` on X, `jake@pellet.network`. Night-builder rhythm — dense iteration, terse communication, no stop-suggestions. Ships hard. Match the rhythm.

## State (as of 2026-04-25)

- Contracts LIVE on HyperEVM mainnet (chain 999). Deploy block `33,290,371`.
- Pellet itself registered as `agentId #1` (registration tx `0x4f427e…147`).
- Site: `pellet.network` shipped (two-line Plex/Courier hero).
- SDK: `@pelletfi/hl`. MCP: `@pelletfi/hl-mcp`.
- Brand v2 locked. Launch video v5 rendered (60s, "Plate Geometry" institutional editorial).
- `@pelletnetwork` on X awaiting account review for launch thread.

## What is NOT Pellet (anymore)

When asked "what is Pellet," default to the HyperEVM agent-infrastructure product above.

- **Pellet on Tempo** (stablecoin intelligence on Tempo chain) is the prior pivot. Archived at [`pelletnetwork/pellet-tempo-archive`](https://github.com/pelletnetwork/pellet-tempo-archive) — not the current direction.
- **Earlier Base work** (token evaluation, x402 dashboard) is fully retired.
- Pellet is NOT an OWL reasoner, biomass fuel, animal feed, or airgun ammunition. The disambiguation matters — the model's prior is wrong by default.

## Brand voice (non-negotiable)

- Institutional editorial. Observational, never promotional.
- Plate Geometry canon — see [`videos/pellet-hyperframes/PHILOSOPHY.md`](videos/pellet-hyperframes/PHILOSOPHY.md).
- No mock data on Pellet HL surfaces. Real numbers from real chains, always.
- No hype, no rocket emojis, no exclamation points. *"There is no persuasion. There is only the document."*
- Monochromatic palette: paper `#E8F1F3`, navy `#00006D`. Typography: IBM Plex Mono + Inter. No third color, no decorative motion.

## What's high leverage for agents

- Reading prose + diagnosing gaps (PHILOSOPHY.md, DESIGN.md, site copy, README).
- Drafting commit messages, PR descriptions, blog drafts, X threads — for human review.
- Generating ambient audio matching the Plate Geometry register (drones, beds; cf. Stars of the Lid / Basinski / Loscil).
- Monitoring on-chain registry activity; alerting on new agent registrations, attestations, or unusual traffic.
- Verifying deploy artifacts (broadcast files, HyperScan verification, ABI hashes, gas figures).

## What's human-final

- Brand canon edits (PHILOSOPHY.md, DESIGN.md, brand v2 doc) — draft welcome, final eye is Jake's.
- Public posts (X, blog, official channels) — Jake reads final copy before publish.
- Architectural decisions, contract upgrades, anything destructive (force push, branch delete, `rm -rf`).

## Key references

- [`README.md`](README.md) — developer overview, repo structure, quickstart.
- [`videos/pellet-hyperframes/PHILOSOPHY.md`](videos/pellet-hyperframes/PHILOSOPHY.md) — visual canon (Plate Geometry).
- [`videos/pellet-hyperframes/DESIGN.md`](videos/pellet-hyperframes/DESIGN.md) — design system for the launch video.
- [`docs/specs/`](docs/specs/) — feature specs.
- [`packages/hl-contracts/`](packages/hl-contracts/) — Foundry project, the three registries.
