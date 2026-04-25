# Pellet on Hyperliquid — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the minimum viable "agent identity layer for Hyperliquid" — three ERC-8004 registry contracts on HyperEVM, a TypeScript SDK, an MCP server, a public registry dashboard, and supporting indexer — in 4 weeks.

**Repo:** Standalone `pelletnetwork/pellet` monorepo at `/Users/jake/pellet/` with `apps/web` + `packages/*` layout (next-forge-ish). Brand v2 is already wired into `apps/web`.

**Note:** The Tempo-era Pellet codebase was extracted to `pelletnetwork/pellet-tempo-archive` 2026-04-22. This repo is standalone; there's no cross-project code coupling to worry about.

**Architecture:** HyperEVM-deployed Solidity contracts (Foundry) expose identity/reputation/validation registries. A Next.js cron indexer writes events to Postgres (Drizzle). Public `apps/web/app/hl/` route tree renders registry state. `@pelletfi/hl` SDK gives agents a typed client; `@pelletfi/hl-mcp` exposes the same through MCP tools.

**Tech Stack:** Solidity 0.8.x + Foundry, TypeScript + viem, Next.js 16 App Router, Drizzle ORM + Neon Postgres, npm workspaces, MCP SDK.

---

## Scope

This plan covers **Phase 1 only** from the spec [2026-04-22-pellet-hl-agent-infrastructure.md](../specs/2026-04-22-pellet-hl-agent-infrastructure.md). Phase 2 (builder-code execution router, paid SDK methods) and Phase 3 (HIP-3 deployer stack) are separate plans.

**In scope:**
- 3 ERC-8004 contracts (Identity, Reputation, Validation) deployed to HyperEVM testnet
- Drizzle schema + migrations for `hl_*` tables
- Cron indexer reading contract events
- `@pelletfi/hl` SDK (mint + read methods)
- `@pelletfi/hl-mcp` MCP server (4 core tools)
- `apps/web/app/hl/` public dashboard (registry list + per-agent profile)
- Brand v2 application to HL surfaces (IBM Plex Mono + Inter, blue palette)

**Out of scope (deferred):**
- Mainnet contract deployment (post-audit; parallel track)
- CoreWriter builder-code router (Phase 2)
- Long-form "Building Agents on HL" guide (content parallel track)
- Platform partnership outreach (founder activity, not code)
- Brand asset file integration (depends on designer delivery — use interim values)

---

## File Structure

### New files — Contracts (`packages/hl-contracts/`)

- `packages/hl-contracts/foundry.toml` — Foundry config
- `packages/hl-contracts/remappings.txt` — library remappings
- `packages/hl-contracts/src/IdentityRegistry.sol` — ERC-8004 Identity
- `packages/hl-contracts/src/ReputationRegistry.sol` — ERC-8004 Reputation
- `packages/hl-contracts/src/ValidationRegistry.sol` — ERC-8004 Validation
- `packages/hl-contracts/test/IdentityRegistry.t.sol` — Foundry tests
- `packages/hl-contracts/test/ReputationRegistry.t.sol`
- `packages/hl-contracts/test/ValidationRegistry.t.sol`
- `packages/hl-contracts/script/Deploy.s.sol` — deployment script
- `packages/hl-contracts/README.md` — how to build/test/deploy
- `packages/hl-contracts/.gitignore`
- `packages/hl-contracts/deployments/hyperevm-testnet.json` — deployed addresses

### New files — HL library (`apps/web/lib/hl/`)

- `apps/web/lib/hl/client.ts` — viem HyperEVM public client
- `apps/web/lib/hl/types.ts` — shared TypeScript types for HL module
- `apps/web/lib/hl/abi/identity.ts` — TypeScript ABI for IdentityRegistry
- `apps/web/lib/hl/abi/reputation.ts`
- `apps/web/lib/hl/abi/validation.ts`
- `apps/web/lib/hl/addresses.ts` — deployed contract addresses (env-aware)
- `apps/web/lib/hl/indexers/identity.ts` — Identity event indexer
- `apps/web/lib/hl/indexers/reputation.ts`
- `apps/web/lib/hl/indexers/validation.ts`

### New files — Cron routes

- `apps/web/app/api/cron/hl-identity-index/route.ts`
- `apps/web/app/api/cron/hl-reputation-index/route.ts`
- `apps/web/app/api/cron/hl-validation-index/route.ts`

### Modified files

- `apps/web/lib/db/schema.ts` — add `hlAgentIds`, `hlAttestations`, `hlValidations` tables (append, do not modify existing tables)
- `apps/web/vercel.json` — add 3 cron entries (daily cadence per maintenance-mode pattern)

### New files — Frontend (`apps/web/app/hl/`)

- `apps/web/app/hl/layout.tsx` — HL-specific layout (brand v2, no site-wide nav)
- `apps/web/app/hl/page.tsx` — registry landing, agent list
- `apps/web/app/hl/agent/[id]/page.tsx` — per-agent profile
- `apps/web/app/hl/docs/page.tsx` — guide placeholder (full content is parallel work)
- `apps/web/app/hl/styles.css` — brand v2 styles (fonts + palette + monospace accents)
- `apps/web/components/hl/RegistryTable.tsx` — agent list table
- `apps/web/components/hl/AgentProfile.tsx` — per-agent profile card
- `apps/web/components/hl/BrandMark.tsx` — new Pellet mark (SVG component)

### New files — SDK (`packages/hl-sdk/`)

- `packages/hl-sdk/package.json`
- `packages/hl-sdk/tsconfig.json`
- `packages/hl-sdk/src/index.ts` — main export
- `packages/hl-sdk/src/client.ts` — PelletHlClient class
- `packages/hl-sdk/src/identity.ts` — mintAgentId, readAgent
- `packages/hl-sdk/src/reputation.ts` — readReputation, attachAttestation
- `packages/hl-sdk/src/validation.ts` — submitValidation
- `packages/hl-sdk/src/types.ts`
- `packages/hl-sdk/src/abi/*.ts` — (duplicated from `apps/web/lib/hl/abi/` to avoid cross-package imports)
- `packages/hl-sdk/README.md`

### New files — MCP server (`packages/hl-mcp/`)

- `packages/hl-mcp/package.json`
- `packages/hl-mcp/tsconfig.json`
- `packages/hl-mcp/src/index.ts` — MCP server entry
- `packages/hl-mcp/src/tools.ts` — tool definitions
- `packages/hl-mcp/README.md`
- `packages/hl-mcp/bin/pellet-hl-mcp.js` — CLI entry for `npx`

---

## Conventions

- **Branch per task:** not required; commit frequently on `main` (Jake's preference, solo workflow)
- **Commit format:** Conventional Commits (`feat(hl):`, `test(hl):`, `chore(hl):`, `docs(hl):`)
- **Code style:** follow existing codebase (eslint config already configured)
- **Monorepo boundaries:** frontend + indexer code lives under `apps/web/`; shared publishable code lives under `packages/*`. No Tempo-era code exists in this repo (extracted to `pelletnetwork/pellet-tempo-archive`).

---

## Week 1 — Contracts

### Task 1: Scaffold Foundry project for HyperEVM contracts

**Files:**
- Create: `packages/hl-contracts/foundry.toml`
- Create: `packages/hl-contracts/remappings.txt`
- Create: `packages/hl-contracts/.gitignore`
- Create: `packages/hl-contracts/README.md`

- [ ] **Step 1: Install Foundry if not already available**

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

Expected: `forge 0.x.x (commit hash)`.

- [ ] **Step 2: Initialize the contracts workspace**

```bash
mkdir -p /Users/jake/pellet/packages/hl-contracts
cd /Users/jake/pellet/packages/hl-contracts
forge init --no-commit --no-git --force .
```

Expected: Foundry scaffolds `src/`, `test/`, `script/`, `lib/` directories. `Counter.sol` and `Counter.t.sol` are created — you'll delete these shortly.

- [ ] **Step 3: Install OpenZeppelin contracts as a Foundry dependency**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

Expected: `lib/openzeppelin-contracts/` directory populated.

- [ ] **Step 4: Write `foundry.toml` with HyperEVM settings**

```bash
cat > /Users/jake/pellet/packages/hl-contracts/foundry.toml <<'EOF'
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false

[rpc_endpoints]
hyperevm_testnet = "https://rpc.hyperliquid-testnet.xyz/evm"
hyperevm_mainnet = "https://rpc.hyperliquid.xyz/evm"

[etherscan]
# No block explorer verification yet; populate later if needed
EOF
```

- [ ] **Step 5: Write `remappings.txt`**

```bash
cat > /Users/jake/pellet/packages/hl-contracts/remappings.txt <<'EOF'
@openzeppelin/=lib/openzeppelin-contracts/
forge-std/=lib/forge-std/src/
EOF
```

- [ ] **Step 6: Delete the sample `Counter` files**

```bash
rm /Users/jake/pellet/packages/hl-contracts/src/Counter.sol
rm /Users/jake/pellet/packages/hl-contracts/test/Counter.t.sol
rm /Users/jake/pellet/packages/hl-contracts/script/Counter.s.sol 2>/dev/null || true
```

- [ ] **Step 7: Write `.gitignore` for Foundry artifacts**

```bash
cat > /Users/jake/pellet/packages/hl-contracts/.gitignore <<'EOF'
out/
cache/
broadcast/
node_modules/
.env
*.log
EOF
```

- [ ] **Step 8: Write `README.md` with build/test/deploy instructions**

```bash
cat > /Users/jake/pellet/packages/hl-contracts/README.md <<'EOF'
# Pellet HL Contracts

ERC-8004 registries deployed on HyperEVM for agent identity, reputation, and validation.

## Build

```bash
forge build
```

## Test

```bash
forge test -vv
```

## Deploy to HyperEVM testnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url hyperevm_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Contracts

- `IdentityRegistry` — ERC-8004 agent identity registry
- `ReputationRegistry` — ERC-8004 reputation attestations
- `ValidationRegistry` — ERC-8004 validation attestations

Deployed addresses: see `deployments/hyperevm-testnet.json`.
EOF
```

- [ ] **Step 9: Verify build works with empty `src/`**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge build
```

Expected: "No files changed, compilation skipped" or "Compiler run successful!" with zero contracts.

- [ ] **Step 10: Commit scaffold**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/foundry.toml packages/hl-contracts/remappings.txt packages/hl-contracts/.gitignore packages/hl-contracts/README.md
git commit -m "chore(hl-contracts): scaffold Foundry project for HyperEVM"
```

Note: OpenZeppelin library stays in `lib/` but `.gitignore` excludes it at commit time (submodules handled implicitly via forge).

---

### Task 2: Implement `IdentityRegistry` contract (ERC-8004 Identity)

**Files:**
- Create: `packages/hl-contracts/src/IdentityRegistry.sol`

**Reference:** ERC-8004 Identity registry assigns each agent a unique uint256 ID, maps to controller address + metadata URI, emits `AgentRegistered` and `AgentMetadataUpdated` events.

- [ ] **Step 1: Write `IdentityRegistry.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-8004 Identity Registry (Pellet HL)
/// @notice Assigns unique uint256 IDs to autonomous agents on Hyperliquid.
///         Each agent has a controller address and a metadata URI.
///         This is the reference implementation for Pellet's agent identity layer.
contract IdentityRegistry {
    struct Agent {
        uint256 id;
        address controller;
        string metadataURI;
        uint256 registeredAt;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public agentsByController;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed controller,
        string metadataURI,
        uint256 timestamp
    );

    event AgentMetadataUpdated(
        uint256 indexed agentId,
        string newMetadataURI,
        uint256 timestamp
    );

    event AgentControllerTransferred(
        uint256 indexed agentId,
        address indexed previousController,
        address indexed newController
    );

    error NotController();
    error AgentNotFound();
    error InvalidAddress();

    /// @notice Register a new agent, minting a fresh ID.
    /// @param metadataURI URI pointing to agent metadata (JSON schema per ERC-8004).
    /// @return agentId The newly assigned agent ID.
    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId] = Agent({
            id: agentId,
            controller: msg.sender,
            metadataURI: metadataURI,
            registeredAt: block.timestamp
        });
        agentsByController[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, metadataURI, block.timestamp);
    }

    /// @notice Update an agent's metadata URI. Only callable by the current controller.
    function updateMetadata(uint256 agentId, string calldata newMetadataURI) external {
        Agent storage agent = agents[agentId];
        if (agent.controller == address(0)) revert AgentNotFound();
        if (agent.controller != msg.sender) revert NotController();
        agent.metadataURI = newMetadataURI;
        emit AgentMetadataUpdated(agentId, newMetadataURI, block.timestamp);
    }

    /// @notice Transfer controller rights to a new address.
    function transferController(uint256 agentId, address newController) external {
        if (newController == address(0)) revert InvalidAddress();
        Agent storage agent = agents[agentId];
        if (agent.controller == address(0)) revert AgentNotFound();
        if (agent.controller != msg.sender) revert NotController();
        address previous = agent.controller;
        agent.controller = newController;
        agentsByController[newController].push(agentId);
        emit AgentControllerTransferred(agentId, previous, newController);
    }

    /// @notice Read an agent record.
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        Agent memory agent = agents[agentId];
        if (agent.controller == address(0)) revert AgentNotFound();
        return agent;
    }

    /// @notice Total agents registered.
    function totalAgents() external view returns (uint256) {
        return nextAgentId - 1;
    }
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge build
```

Expected: "Compiler run successful!" with `IdentityRegistry` in the artifacts.

- [ ] **Step 3: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/src/IdentityRegistry.sol
git commit -m "feat(hl-contracts): add ERC-8004 IdentityRegistry"
```

---

### Task 3: Write `IdentityRegistry` tests

**Files:**
- Create: `packages/hl-contracts/test/IdentityRegistry.t.sol`

- [ ] **Step 1: Write the Foundry test file**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry registry;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        registry = new IdentityRegistry();
    }

    function test_RegisterAgent_MintsIdStartingFromOne() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://agent-alice");
        assertEq(id, 1);
    }

    function test_RegisterAgent_IncrementsIds() public {
        vm.prank(alice);
        uint256 id1 = registry.registerAgent("ipfs://agent-1");
        vm.prank(bob);
        uint256 id2 = registry.registerAgent("ipfs://agent-2");
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RegisterAgent_StoresAgentRecord() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://meta");
        IdentityRegistry.Agent memory agent = registry.getAgent(id);
        assertEq(agent.controller, alice);
        assertEq(agent.metadataURI, "ipfs://meta");
        assertEq(uint256(agent.registeredAt), block.timestamp);
    }

    function test_RegisterAgent_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IdentityRegistry.AgentRegistered(1, alice, "ipfs://meta", block.timestamp);
        vm.prank(alice);
        registry.registerAgent("ipfs://meta");
    }

    function test_UpdateMetadata_RequiresController() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://old");
        vm.prank(bob);
        vm.expectRevert(IdentityRegistry.NotController.selector);
        registry.updateMetadata(id, "ipfs://new");
    }

    function test_UpdateMetadata_UpdatesUri() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://old");
        vm.prank(alice);
        registry.updateMetadata(id, "ipfs://new");
        IdentityRegistry.Agent memory agent = registry.getAgent(id);
        assertEq(agent.metadataURI, "ipfs://new");
    }

    function test_TransferController_MovesOwnership() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://meta");
        vm.prank(alice);
        registry.transferController(id, bob);
        IdentityRegistry.Agent memory agent = registry.getAgent(id);
        assertEq(agent.controller, bob);
    }

    function test_GetAgent_RevertsForUnknownId() public {
        vm.expectRevert(IdentityRegistry.AgentNotFound.selector);
        registry.getAgent(999);
    }

    function test_TotalAgents_ReflectsRegistrations() public {
        assertEq(registry.totalAgents(), 0);
        vm.prank(alice);
        registry.registerAgent("ipfs://1");
        vm.prank(bob);
        registry.registerAgent("ipfs://2");
        assertEq(registry.totalAgents(), 2);
    }

    function test_ControllerOf_ReturnsCurrentController() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://x");
        assertEq(registry.controllerOf(id), alice);
        vm.prank(alice);
        registry.transferController(id, bob);
        assertEq(registry.controllerOf(id), bob);
    }

    function test_ControllerOf_ReturnsZeroForUnknown() public {
        assertEq(registry.controllerOf(999), address(0));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge test -vv
```

Expected: All 9 tests pass. Output ends with `Suite result: ok. 9 passed; 0 failed`.

- [ ] **Step 3: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/test/IdentityRegistry.t.sol
git commit -m "test(hl-contracts): add IdentityRegistry tests"
```

---

### Task 4: Implement `ReputationRegistry` contract

**Files:**
- Create: `packages/hl-contracts/src/ReputationRegistry.sol`

**Reference:** ERC-8004 Reputation registry allows anyone to post a signed attestation about an agent's behavior. Each attestation has: agentId, attester address, attestation type (outcome, latency, accuracy, etc.), numeric score, and metadata URI for detail.

- [ ] **Step 1: Write `ReputationRegistry.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-8004 Reputation Registry (Pellet HL)
/// @notice Allows permissionless attestations about agent behavior.
///         Attesters post signed claims tied to an agent ID.
contract ReputationRegistry {
    struct Attestation {
        uint256 id;
        uint256 agentId;
        address attester;
        bytes32 attestationType;
        int256 score;
        string metadataURI;
        uint256 timestamp;
    }

    uint256 public nextAttestationId = 1;
    mapping(uint256 => Attestation) public attestations;
    mapping(uint256 => uint256[]) public attestationsByAgent;
    mapping(address => uint256[]) public attestationsByAttester;

    event AttestationPosted(
        uint256 indexed attestationId,
        uint256 indexed agentId,
        address indexed attester,
        bytes32 attestationType,
        int256 score,
        string metadataURI,
        uint256 timestamp
    );

    /// @notice Post an attestation about an agent.
    /// @param agentId Target agent's ID.
    /// @param attestationType bytes32 identifier for the type (e.g. keccak256("outcome:success")).
    /// @param score Numeric score (positive or negative).
    /// @param metadataURI URI pointing to full attestation detail (e.g. trade receipt).
    function postAttestation(
        uint256 agentId,
        bytes32 attestationType,
        int256 score,
        string calldata metadataURI
    ) external returns (uint256 attestationId) {
        attestationId = nextAttestationId++;
        attestations[attestationId] = Attestation({
            id: attestationId,
            agentId: agentId,
            attester: msg.sender,
            attestationType: attestationType,
            score: score,
            metadataURI: metadataURI,
            timestamp: block.timestamp
        });
        attestationsByAgent[agentId].push(attestationId);
        attestationsByAttester[msg.sender].push(attestationId);
        emit AttestationPosted(
            attestationId,
            agentId,
            msg.sender,
            attestationType,
            score,
            metadataURI,
            block.timestamp
        );
    }

    /// @notice Read an attestation record.
    function getAttestation(uint256 attestationId) external view returns (Attestation memory) {
        return attestations[attestationId];
    }

    /// @notice Get attestation count for an agent.
    function attestationCountForAgent(uint256 agentId) external view returns (uint256) {
        return attestationsByAgent[agentId].length;
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge build
```

Expected: Compiler run successful.

- [ ] **Step 3: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/src/ReputationRegistry.sol
git commit -m "feat(hl-contracts): add ERC-8004 ReputationRegistry"
```

---

### Task 5: Write `ReputationRegistry` tests

**Files:**
- Create: `packages/hl-contracts/test/ReputationRegistry.t.sol`

- [ ] **Step 1: Write the Foundry test file**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry registry;
    address attester1 = address(0xA7751);
    address attester2 = address(0xA7752);
    bytes32 constant OUTCOME_SUCCESS = keccak256("outcome:success");
    bytes32 constant OUTCOME_FAILURE = keccak256("outcome:failure");

    function setUp() public {
        registry = new ReputationRegistry();
    }

    function test_PostAttestation_MintsIdStartingFromOne() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(1, OUTCOME_SUCCESS, 100, "ipfs://receipt");
        assertEq(id, 1);
    }

    function test_PostAttestation_StoresRecord() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(42, OUTCOME_SUCCESS, 100, "ipfs://r");
        ReputationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.agentId, 42);
        assertEq(att.attester, attester1);
        assertEq(att.attestationType, OUTCOME_SUCCESS);
        assertEq(att.score, 100);
        assertEq(att.metadataURI, "ipfs://r");
    }

    function test_PostAttestation_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ReputationRegistry.AttestationPosted(
            1,
            42,
            attester1,
            OUTCOME_SUCCESS,
            100,
            "ipfs://r",
            block.timestamp
        );
        vm.prank(attester1);
        registry.postAttestation(42, OUTCOME_SUCCESS, 100, "ipfs://r");
    }

    function test_PostAttestation_AllowsNegativeScore() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(7, OUTCOME_FAILURE, -50, "ipfs://loss");
        ReputationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.score, -50);
    }

    function test_AttestationCountForAgent_ReflectsPosts() public {
        assertEq(registry.attestationCountForAgent(1), 0);
        vm.prank(attester1);
        registry.postAttestation(1, OUTCOME_SUCCESS, 10, "ipfs://a");
        vm.prank(attester2);
        registry.postAttestation(1, OUTCOME_SUCCESS, 20, "ipfs://b");
        assertEq(registry.attestationCountForAgent(1), 2);
    }

    function test_MultipleAgents_TrackIndependently() public {
        vm.prank(attester1);
        registry.postAttestation(1, OUTCOME_SUCCESS, 10, "");
        vm.prank(attester1);
        registry.postAttestation(2, OUTCOME_SUCCESS, 10, "");
        assertEq(registry.attestationCountForAgent(1), 1);
        assertEq(registry.attestationCountForAgent(2), 1);
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge test -vv
```

Expected: All tests pass (Identity + Reputation = 15 total).

- [ ] **Step 3: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/test/ReputationRegistry.t.sol
git commit -m "test(hl-contracts): add ReputationRegistry tests"
```

---

### Task 6: Implement `ValidationRegistry` contract + tests

**Files:**
- Create: `packages/hl-contracts/src/ValidationRegistry.sol`
- Create: `packages/hl-contracts/test/ValidationRegistry.t.sol`

**Reference:** ERC-8004 Validation registry lets third parties post signed validations of agent work — stronger than a simple attestation, often used for cryptographic proofs. Schema: validationId, agentId, validator, claim hash, proof URI.

- [ ] **Step 1: Write `ValidationRegistry.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-8004 Validation Registry (Pellet HL)
/// @notice Stronger-than-attestation proofs of agent work. Validators post
///         hashed claims with off-chain proof references.
contract ValidationRegistry {
    struct Validation {
        uint256 id;
        uint256 agentId;
        address validator;
        bytes32 claimHash;
        string proofURI;
        uint256 timestamp;
    }

    uint256 public nextValidationId = 1;
    mapping(uint256 => Validation) public validations;
    mapping(uint256 => uint256[]) public validationsByAgent;

    event ValidationPosted(
        uint256 indexed validationId,
        uint256 indexed agentId,
        address indexed validator,
        bytes32 claimHash,
        string proofURI,
        uint256 timestamp
    );

    /// @notice Post a validation of an agent's work.
    function postValidation(
        uint256 agentId,
        bytes32 claimHash,
        string calldata proofURI
    ) external returns (uint256 validationId) {
        validationId = nextValidationId++;
        validations[validationId] = Validation({
            id: validationId,
            agentId: agentId,
            validator: msg.sender,
            claimHash: claimHash,
            proofURI: proofURI,
            timestamp: block.timestamp
        });
        validationsByAgent[agentId].push(validationId);
        emit ValidationPosted(validationId, agentId, msg.sender, claimHash, proofURI, block.timestamp);
    }

    function getValidation(uint256 validationId) external view returns (Validation memory) {
        return validations[validationId];
    }

    function validationCountForAgent(uint256 agentId) external view returns (uint256) {
        return validationsByAgent[agentId].length;
    }
}
```

- [ ] **Step 2: Write `ValidationRegistry.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ValidationRegistry.sol";

contract ValidationRegistryTest is Test {
    ValidationRegistry registry;
    address validator = address(0xABCD);

    function setUp() public {
        registry = new ValidationRegistry();
    }

    function test_PostValidation_MintsId() public {
        bytes32 hash = keccak256("proof-of-trade");
        vm.prank(validator);
        uint256 id = registry.postValidation(1, hash, "ipfs://proof");
        assertEq(id, 1);
    }

    function test_PostValidation_StoresRecord() public {
        bytes32 hash = keccak256("outcome-x");
        vm.prank(validator);
        uint256 id = registry.postValidation(42, hash, "ipfs://p");
        ValidationRegistry.Validation memory v = registry.getValidation(id);
        assertEq(v.agentId, 42);
        assertEq(v.validator, validator);
        assertEq(v.claimHash, hash);
        assertEq(v.proofURI, "ipfs://p");
    }

    function test_ValidationCountForAgent_Tracks() public {
        assertEq(registry.validationCountForAgent(1), 0);
        vm.prank(validator);
        registry.postValidation(1, bytes32(uint256(1)), "");
        vm.prank(validator);
        registry.postValidation(1, bytes32(uint256(2)), "");
        assertEq(registry.validationCountForAgent(1), 2);
    }

    function test_PostValidation_EmitsEvent() public {
        bytes32 hash = keccak256("p");
        vm.expectEmit(true, true, true, true);
        emit ValidationRegistry.ValidationPosted(1, 7, validator, hash, "ipfs://x", block.timestamp);
        vm.prank(validator);
        registry.postValidation(7, hash, "ipfs://x");
    }
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge test -vv
```

Expected: All 19 tests pass across 3 suites.

- [ ] **Step 4: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/src/ValidationRegistry.sol packages/hl-contracts/test/ValidationRegistry.t.sol
git commit -m "feat(hl-contracts): add ERC-8004 ValidationRegistry with tests"
```

---

### Task 7: Write deployment script + deploy to HyperEVM testnet

**Files:**
- Create: `packages/hl-contracts/script/Deploy.s.sol`
- Create: `packages/hl-contracts/deployments/hyperevm-testnet.json`

- [ ] **Step 1: Write the Forge deployment script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/IdentityRegistry.sol";
import "../src/ReputationRegistry.sol";
import "../src/ValidationRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry();
        ValidationRegistry validation = new ValidationRegistry();

        vm.stopBroadcast();

        console2.log("IdentityRegistry:", address(identity));
        console2.log("ReputationRegistry:", address(reputation));
        console2.log("ValidationRegistry:", address(validation));
    }
}
```

- [ ] **Step 2: Fund a testnet deployer wallet**

Get HyperEVM testnet ETH from the HL testnet faucet (check HL docs for current URL). You'll need ~0.05 testnet ETH total.

Set the private key as env var:

```bash
export PRIVATE_KEY=0x<your-testnet-deployer-key>
```

⚠️ **Use a fresh wallet dedicated to this deployment. Do not use a wallet that holds real funds.**

- [ ] **Step 3: Deploy**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge script script/Deploy.s.sol --rpc-url hyperevm_testnet --broadcast -vvvv
```

Expected: Three contracts deploy. Console output shows three addresses like `IdentityRegistry: 0xABC...`.

- [ ] **Step 4: Record deployed addresses**

Create `packages/hl-contracts/deployments/hyperevm-testnet.json` with actual deployed addresses:

```bash
mkdir -p /Users/jake/pellet/packages/hl-contracts/deployments
cat > /Users/jake/pellet/packages/hl-contracts/deployments/hyperevm-testnet.json <<EOF
{
  "chainId": 998,
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "IdentityRegistry": "0x<actual-address-from-step-3>",
    "ReputationRegistry": "0x<actual-address-from-step-3>",
    "ValidationRegistry": "0x<actual-address-from-step-3>"
  }
}
EOF
```

Fill in the actual addresses from step 3 output.

- [ ] **Step 5: Verify deployment**

Write a quick cast call to confirm:

```bash
cast call <IdentityRegistry-address> "nextAgentId()(uint256)" --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
```

Expected: Returns `1` (no agents registered yet).

- [ ] **Step 6: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-contracts/script/Deploy.s.sol packages/hl-contracts/deployments/hyperevm-testnet.json
git commit -m "chore(hl-contracts): deploy registries to HyperEVM testnet"
```

---

## Week 2 — Indexer

### Task 8: Create `apps/web/lib/hl/` structure + viem HyperEVM client ✓ SHIPPED

**Status:** DONE as of 2026-04-22. Commit: `2e91de2` on `pelletnetwork/pellet` main. Scaffolded `apps/web/lib/hl/` with types, addresses (placeholder `0x0000...` until Task 7b), viem client, and the three auto-generated ABIs.

**Files:**
- Create: `apps/web/lib/hl/client.ts`
- Create: `apps/web/lib/hl/types.ts`
- Create: `apps/web/lib/hl/addresses.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/jake/pellet/apps/web/lib/hl/abi
mkdir -p /Users/jake/pellet/apps/web/lib/hl/indexers
```

- [ ] **Step 2: Write `apps/web/lib/hl/types.ts`**

```typescript
// Shared types for the HL (Hyperliquid) module.

export type AgentId = bigint;

export interface AgentRecord {
  id: AgentId;
  controller: `0x${string}`;
  metadataURI: string;
  registeredAt: Date;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

export interface AttestationRecord {
  id: bigint;
  agentId: AgentId;
  attester: `0x${string}`;
  attestationType: `0x${string}`; // bytes32
  score: bigint;
  metadataURI: string;
  timestamp: Date;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

export interface ValidationRecord {
  id: bigint;
  agentId: AgentId;
  validator: `0x${string}`;
  claimHash: `0x${string}`;
  proofURI: string;
  timestamp: Date;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

export type HlChain = "testnet" | "mainnet";
```

- [ ] **Step 3: Write `apps/web/lib/hl/addresses.ts`**

```typescript
import type { HlChain } from "./types";

// Deployed registry addresses per chain.
// Update when mainnet deployment happens; testnet is the Phase 1 target.
export const HL_REGISTRY_ADDRESSES: Record<HlChain, {
  identity: `0x${string}`;
  reputation: `0x${string}`;
  validation: `0x${string}`;
}> = {
  testnet: {
    // FILL IN after Task 7 deployment:
    identity: "0x0000000000000000000000000000000000000000",
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
  mainnet: {
    identity: "0x0000000000000000000000000000000000000000",
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
};

export function getRegistryAddresses(chain: HlChain = "testnet") {
  return HL_REGISTRY_ADDRESSES[chain];
}
```

After deployment in Task 7, update the testnet addresses from `packages/hl-contracts/deployments/hyperevm-testnet.json`.

- [ ] **Step 4: Write `apps/web/lib/hl/client.ts`**

```typescript
import { createPublicClient, http, type PublicClient } from "viem";
import type { HlChain } from "./types";

// HyperEVM RPC endpoints
const HL_RPC: Record<HlChain, string> = {
  testnet: "https://rpc.hyperliquid-testnet.xyz/evm",
  mainnet: "https://rpc.hyperliquid.xyz/evm",
};

const HL_CHAIN_ID: Record<HlChain, number> = {
  testnet: 998,
  mainnet: 999, // verify current chain ID from HL docs at deployment time
};

let cachedClients: Partial<Record<HlChain, PublicClient>> = {};

export function getHlClient(chain: HlChain = "testnet"): PublicClient {
  if (!cachedClients[chain]) {
    cachedClients[chain] = createPublicClient({
      chain: {
        id: HL_CHAIN_ID[chain],
        name: `Hyperliquid ${chain === "testnet" ? "Testnet" : "Mainnet"}`,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: {
          default: { http: [HL_RPC[chain]] },
        },
      },
      transport: http(HL_RPC[chain]),
    });
  }
  return cachedClients[chain]!;
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/lib/hl/types.ts apps/web/lib/hl/addresses.ts apps/web/lib/hl/client.ts
git commit -m "feat(hl): add viem client + types + address registry"
```

---

### Task 9: Generate TypeScript ABIs from compiled contracts

**Files:**
- Create: `apps/web/lib/hl/abi/identity.ts`
- Create: `apps/web/lib/hl/abi/reputation.ts`
- Create: `apps/web/lib/hl/abi/validation.ts`

- [ ] **Step 1: Extract ABIs from Foundry build artifacts**

```bash
cd /Users/jake/pellet/packages/hl-contracts
forge build
```

ABIs are at `packages/hl-contracts/out/IdentityRegistry.sol/IdentityRegistry.json` (inside `.abi` field).

- [ ] **Step 2: Write `apps/web/lib/hl/abi/identity.ts`**

Extract the `abi` array from the compiled JSON and export as TypeScript const:

```bash
node -e "
const fs = require('fs');
const abi = JSON.parse(fs.readFileSync('/Users/jake/pellet/packages/hl-contracts/out/IdentityRegistry.sol/IdentityRegistry.json')).abi;
const ts = 'export const identityRegistryAbi = ' + JSON.stringify(abi, null, 2) + ' as const;';
fs.writeFileSync('/Users/jake/pellet/apps/web/lib/hl/abi/identity.ts', ts);
"
```

- [ ] **Step 3: Write `apps/web/lib/hl/abi/reputation.ts`**

```bash
node -e "
const fs = require('fs');
const abi = JSON.parse(fs.readFileSync('/Users/jake/pellet/packages/hl-contracts/out/ReputationRegistry.sol/ReputationRegistry.json')).abi;
const ts = 'export const reputationRegistryAbi = ' + JSON.stringify(abi, null, 2) + ' as const;';
fs.writeFileSync('/Users/jake/pellet/apps/web/lib/hl/abi/reputation.ts', ts);
"
```

- [ ] **Step 4: Write `apps/web/lib/hl/abi/validation.ts`**

```bash
node -e "
const fs = require('fs');
const abi = JSON.parse(fs.readFileSync('/Users/jake/pellet/packages/hl-contracts/out/ValidationRegistry.sol/ValidationRegistry.json')).abi;
const ts = 'export const validationRegistryAbi = ' + JSON.stringify(abi, null, 2) + ' as const;';
fs.writeFileSync('/Users/jake/pellet/apps/web/lib/hl/abi/validation.ts', ts);
"
```

- [ ] **Step 5: Verify by reading one file**

```bash
head -20 /Users/jake/pellet/apps/web/lib/hl/abi/identity.ts
```

Expected: Starts with `export const identityRegistryAbi = [` followed by JSON-like ABI entries.

- [ ] **Step 6: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/lib/hl/abi/
git commit -m "feat(hl): generate TypeScript ABIs for registries"
```

---

### Task 10: Add Drizzle schema for `hl_*` tables

**Files:**
- Modify: `apps/web/lib/db/schema.ts` (append)

- [ ] **Step 1: Read the existing schema file to understand conventions**

```bash
wc -l /Users/jake/pellet/apps/web/lib/db/schema.ts
tail -30 /Users/jake/pellet/apps/web/lib/db/schema.ts
```

Understand: naming convention (camelCase export), pgTable with snake_case column names.

- [ ] **Step 2: Append HL tables to `apps/web/lib/db/schema.ts`**

Add at the end of the file (before any default export, if one exists):

```typescript
// =============================================================================
// HL (Hyperliquid) — agent infrastructure layer
// Added Phase 1, 2026-04-22.
// =============================================================================

export const hlAgentIds = pgTable("hl_agent_ids", {
  agentId: numeric("agent_id").primaryKey(), // uint256 as string
  controller: text("controller").notNull(), // 0x... address
  metadataUri: text("metadata_uri"),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  txHash: text("tx_hash").notNull(),
  chain: text("chain").notNull(), // 'testnet' | 'mainnet'
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  controllerIdx: index("hl_agent_ids_controller_idx").on(t.controller),
  chainIdx: index("hl_agent_ids_chain_idx").on(t.chain),
}));

export const hlAttestations = pgTable("hl_attestations", {
  attestationId: numeric("attestation_id").primaryKey(),
  agentId: numeric("agent_id").notNull(),
  attester: text("attester").notNull(),
  attestationType: text("attestation_type").notNull(), // bytes32 hex
  score: numeric("score").notNull(), // int256 as string
  metadataUri: text("metadata_uri"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  txHash: text("tx_hash").notNull(),
  chain: text("chain").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  agentIdx: index("hl_attestations_agent_idx").on(t.agentId),
  attesterIdx: index("hl_attestations_attester_idx").on(t.attester),
  typeIdx: index("hl_attestations_type_idx").on(t.attestationType),
}));

export const hlValidations = pgTable("hl_validations", {
  validationId: numeric("validation_id").primaryKey(),
  agentId: numeric("agent_id").notNull(),
  validator: text("validator").notNull(),
  claimHash: text("claim_hash").notNull(),
  proofUri: text("proof_uri"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  txHash: text("tx_hash").notNull(),
  chain: text("chain").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  agentIdx: index("hl_validations_agent_idx").on(t.agentId),
  validatorIdx: index("hl_validations_validator_idx").on(t.validator),
}));

export const hlIndexerCursors = pgTable("hl_indexer_cursors", {
  indexerName: text("indexer_name").primaryKey(), // 'identity' | 'reputation' | 'validation'
  chain: text("chain").notNull(),
  lastBlockNumber: bigint("last_block_number", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Generate migration**

```bash
cd /Users/jake/pellet/apps/web
npx drizzle-kit generate
```

Expected: New file in `apps/web/drizzle/` or equivalent migration directory. Output says "Migration created".

- [ ] **Step 4: Review the generated migration**

```bash
ls -lt /Users/jake/pellet/apps/web/drizzle/ | head -5
cat /Users/jake/pellet/apps/web/drizzle/<latest-migration>.sql
```

Expected: `CREATE TABLE hl_agent_ids`, `CREATE TABLE hl_attestations`, `CREATE TABLE hl_validations`, `CREATE TABLE hl_indexer_cursors`.

- [ ] **Step 5: Apply the migration to Neon**

```bash
cd /Users/jake/pellet/apps/web
npx drizzle-kit migrate
```

Expected: "Applying migration..." then "Migration applied successfully."

- [ ] **Step 6: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/lib/db/schema.ts apps/web/drizzle/
git commit -m "feat(hl): add hl_* tables + indexer cursor table"
```

---

### Task 11: Write Identity indexer

**Files:**
- Create: `apps/web/lib/hl/indexers/identity.ts`

- [ ] **Step 1: Write the indexer**

```typescript
import { getHlClient } from "../client";
import { identityRegistryAbi } from "../abi/identity";
import { getRegistryAddresses } from "../addresses";
import type { HlChain } from "../types";
import { db } from "@/lib/db";
import { hlAgentIds, hlIndexerCursors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CHUNK_SIZE = 5000n; // HyperEVM RPC max log range

export async function runIdentityIndexer(chain: HlChain = "testnet"): Promise<{
  blocksProcessed: number;
  eventsIndexed: number;
  lastBlock: bigint;
}> {
  const client = getHlClient(chain);
  const address = getRegistryAddresses(chain).identity;

  // Read cursor (last indexed block)
  const cursor = await db
    .select()
    .from(hlIndexerCursors)
    .where(and(eq(hlIndexerCursors.indexerName, "identity"), eq(hlIndexerCursors.chain, chain)))
    .limit(1);

  let fromBlock: bigint;
  if (cursor.length === 0) {
    // First run: start from contract deployment block (or 0 for testnet)
    fromBlock = 0n;
    await db.insert(hlIndexerCursors).values({
      indexerName: "identity",
      chain,
      lastBlockNumber: 0n,
    });
  } else {
    fromBlock = BigInt(cursor[0].lastBlockNumber) + 1n;
  }

  const latestBlock = await client.getBlockNumber();

  let eventsIndexed = 0;
  let currentFrom = fromBlock;

  while (currentFrom <= latestBlock) {
    const currentTo = currentFrom + CHUNK_SIZE > latestBlock ? latestBlock : currentFrom + CHUNK_SIZE;

    const logs = await client.getContractEvents({
      address,
      abi: identityRegistryAbi,
      eventName: "AgentRegistered",
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    for (const log of logs) {
      const { agentId, controller, metadataURI, timestamp } = log.args as {
        agentId: bigint;
        controller: `0x${string}`;
        metadataURI: string;
        timestamp: bigint;
      };

      await db.insert(hlAgentIds).values({
        agentId: agentId.toString(),
        controller,
        metadataUri: metadataURI,
        registeredAt: new Date(Number(timestamp) * 1000),
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
        chain,
      }).onConflictDoNothing();

      eventsIndexed++;
    }

    currentFrom = currentTo + 1n;
  }

  // Update cursor
  await db.update(hlIndexerCursors)
    .set({ lastBlockNumber: latestBlock, updatedAt: new Date() })
    .where(and(eq(hlIndexerCursors.indexerName, "identity"), eq(hlIndexerCursors.chain, chain)));

  return {
    blocksProcessed: Number(latestBlock - fromBlock + 1n),
    eventsIndexed,
    lastBlock: latestBlock,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/jake/pellet
npx tsc --noEmit
```

Expected: No type errors. If there are, fix incrementally.

- [ ] **Step 3: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/lib/hl/indexers/identity.ts
git commit -m "feat(hl): add Identity event indexer"
```

---

### Task 12: Write Reputation + Validation indexers

**Files:**
- Create: `apps/web/lib/hl/indexers/reputation.ts`
- Create: `apps/web/lib/hl/indexers/validation.ts`

- [ ] **Step 1: Write `reputation.ts`** (mirror of identity pattern)

```typescript
import { getHlClient } from "../client";
import { reputationRegistryAbi } from "../abi/reputation";
import { getRegistryAddresses } from "../addresses";
import type { HlChain } from "../types";
import { db } from "@/lib/db";
import { hlAttestations, hlIndexerCursors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CHUNK_SIZE = 5000n;

export async function runReputationIndexer(chain: HlChain = "testnet"): Promise<{
  blocksProcessed: number;
  eventsIndexed: number;
  lastBlock: bigint;
}> {
  const client = getHlClient(chain);
  const address = getRegistryAddresses(chain).reputation;

  const cursor = await db
    .select()
    .from(hlIndexerCursors)
    .where(and(eq(hlIndexerCursors.indexerName, "reputation"), eq(hlIndexerCursors.chain, chain)))
    .limit(1);

  let fromBlock: bigint;
  if (cursor.length === 0) {
    fromBlock = 0n;
    await db.insert(hlIndexerCursors).values({
      indexerName: "reputation",
      chain,
      lastBlockNumber: 0n,
    });
  } else {
    fromBlock = BigInt(cursor[0].lastBlockNumber) + 1n;
  }

  const latestBlock = await client.getBlockNumber();
  let eventsIndexed = 0;
  let currentFrom = fromBlock;

  while (currentFrom <= latestBlock) {
    const currentTo = currentFrom + CHUNK_SIZE > latestBlock ? latestBlock : currentFrom + CHUNK_SIZE;

    const logs = await client.getContractEvents({
      address,
      abi: reputationRegistryAbi,
      eventName: "AttestationPosted",
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    for (const log of logs) {
      const { attestationId, agentId, attester, attestationType, score, metadataURI, timestamp } = log.args as {
        attestationId: bigint;
        agentId: bigint;
        attester: `0x${string}`;
        attestationType: `0x${string}`;
        score: bigint;
        metadataURI: string;
        timestamp: bigint;
      };

      await db.insert(hlAttestations).values({
        attestationId: attestationId.toString(),
        agentId: agentId.toString(),
        attester,
        attestationType,
        score: score.toString(),
        metadataUri: metadataURI,
        timestamp: new Date(Number(timestamp) * 1000),
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
        chain,
      }).onConflictDoNothing();

      eventsIndexed++;
    }

    currentFrom = currentTo + 1n;
  }

  await db.update(hlIndexerCursors)
    .set({ lastBlockNumber: latestBlock, updatedAt: new Date() })
    .where(and(eq(hlIndexerCursors.indexerName, "reputation"), eq(hlIndexerCursors.chain, chain)));

  return {
    blocksProcessed: Number(latestBlock - fromBlock + 1n),
    eventsIndexed,
    lastBlock: latestBlock,
  };
}
```

- [ ] **Step 2: Write `validation.ts`** (mirror)

```typescript
import { getHlClient } from "../client";
import { validationRegistryAbi } from "../abi/validation";
import { getRegistryAddresses } from "../addresses";
import type { HlChain } from "../types";
import { db } from "@/lib/db";
import { hlValidations, hlIndexerCursors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CHUNK_SIZE = 5000n;

export async function runValidationIndexer(chain: HlChain = "testnet"): Promise<{
  blocksProcessed: number;
  eventsIndexed: number;
  lastBlock: bigint;
}> {
  const client = getHlClient(chain);
  const address = getRegistryAddresses(chain).validation;

  const cursor = await db
    .select()
    .from(hlIndexerCursors)
    .where(and(eq(hlIndexerCursors.indexerName, "validation"), eq(hlIndexerCursors.chain, chain)))
    .limit(1);

  let fromBlock: bigint;
  if (cursor.length === 0) {
    fromBlock = 0n;
    await db.insert(hlIndexerCursors).values({
      indexerName: "validation",
      chain,
      lastBlockNumber: 0n,
    });
  } else {
    fromBlock = BigInt(cursor[0].lastBlockNumber) + 1n;
  }

  const latestBlock = await client.getBlockNumber();
  let eventsIndexed = 0;
  let currentFrom = fromBlock;

  while (currentFrom <= latestBlock) {
    const currentTo = currentFrom + CHUNK_SIZE > latestBlock ? latestBlock : currentFrom + CHUNK_SIZE;

    const logs = await client.getContractEvents({
      address,
      abi: validationRegistryAbi,
      eventName: "ValidationPosted",
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    for (const log of logs) {
      const { validationId, agentId, validator, claimHash, proofURI, timestamp } = log.args as {
        validationId: bigint;
        agentId: bigint;
        validator: `0x${string}`;
        claimHash: `0x${string}`;
        proofURI: string;
        timestamp: bigint;
      };

      await db.insert(hlValidations).values({
        validationId: validationId.toString(),
        agentId: agentId.toString(),
        validator,
        claimHash,
        proofUri: proofURI,
        timestamp: new Date(Number(timestamp) * 1000),
        blockNumber: log.blockNumber!,
        txHash: log.transactionHash!,
        chain,
      }).onConflictDoNothing();

      eventsIndexed++;
    }

    currentFrom = currentTo + 1n;
  }

  await db.update(hlIndexerCursors)
    .set({ lastBlockNumber: latestBlock, updatedAt: new Date() })
    .where(and(eq(hlIndexerCursors.indexerName, "validation"), eq(hlIndexerCursors.chain, chain)));

  return {
    blocksProcessed: Number(latestBlock - fromBlock + 1n),
    eventsIndexed,
    lastBlock: latestBlock,
  };
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/jake/pellet
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/lib/hl/indexers/reputation.ts apps/web/lib/hl/indexers/validation.ts
git commit -m "feat(hl): add Reputation + Validation indexers"
```

---

### Task 13: Add cron routes + register in `vercel.json`

**Files:**
- Create: `apps/web/app/api/cron/hl-identity-index/route.ts`
- Create: `apps/web/app/api/cron/hl-reputation-index/route.ts`
- Create: `apps/web/app/api/cron/hl-validation-index/route.ts`
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Create identity cron route**

```typescript
// apps/web/app/api/cron/hl-identity-index/route.ts
import { NextResponse } from "next/server";
import { runIdentityIndexer } from "@/lib/hl/indexers/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runIdentityIndexer("testnet");
    return NextResponse.json({ ok: true, ...result, lastBlock: result.lastBlock.toString() });
  } catch (err) {
    console.error("[hl-identity-index] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create reputation cron route**

```typescript
// apps/web/app/api/cron/hl-reputation-index/route.ts
import { NextResponse } from "next/server";
import { runReputationIndexer } from "@/lib/hl/indexers/reputation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runReputationIndexer("testnet");
    return NextResponse.json({ ok: true, ...result, lastBlock: result.lastBlock.toString() });
  } catch (err) {
    console.error("[hl-reputation-index] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create validation cron route**

```typescript
// apps/web/app/api/cron/hl-validation-index/route.ts
import { NextResponse } from "next/server";
import { runValidationIndexer } from "@/lib/hl/indexers/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runValidationIndexer("testnet");
    return NextResponse.json({ ok: true, ...result, lastBlock: result.lastBlock.toString() });
  } catch (err) {
    console.error("[hl-validation-index] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Register crons in `vercel.json`**

Add to the existing `crons` array (keep daily cadence to match maintenance-mode pattern):

```json
{ "path": "/api/cron/hl-identity-index", "schedule": "15 * * * *" },
{ "path": "/api/cron/hl-reputation-index", "schedule": "20 * * * *" },
{ "path": "/api/cron/hl-validation-index", "schedule": "25 * * * *" }
```

Stagger by 5 minutes to avoid contention. Hourly (`{N} * * * *`) because HL has meaningful event volume and Phase 1 needs the registry to feel live.

- [ ] **Step 5: Test locally**

```bash
cd /Users/jake/pellet/apps/web
npm run dev
# In another terminal:
curl http://localhost:3000/api/cron/hl-identity-index
```

Expected: `{"ok":true,"blocksProcessed":..., "eventsIndexed":0, "lastBlock":"..."}` (0 events because no agents registered yet, but the cron should run without error).

- [ ] **Step 6: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/app/api/cron/hl-identity-index apps/web/app/api/cron/hl-reputation-index apps/web/app/api/cron/hl-validation-index apps/web/vercel.json
git commit -m "feat(hl): add cron routes + register in vercel.json"
```

---

### Task 14: Manual test of indexer — mint an agent, verify it indexes

**Files:** none (operational test)

- [ ] **Step 1: Mint a test agent via cast**

```bash
cast send <IdentityRegistry-testnet-address> \
  "registerAgent(string)" "ipfs://test-agent-1" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm \
  --private-key $PRIVATE_KEY
```

Expected: Transaction confirmed, tx hash returned.

- [ ] **Step 2: Trigger the indexer cron**

```bash
curl http://localhost:3000/api/cron/hl-identity-index
```

Expected: `"eventsIndexed": 1`.

- [ ] **Step 3: Verify the row in Postgres**

```bash
cd /Users/jake/pellet/apps/web
npx drizzle-kit studio
# Open browser, navigate to hl_agent_ids table
```

Expected: One row with `agent_id: 1`, `controller: <your-address>`, `metadata_uri: ipfs://test-agent-1`.

- [ ] **Step 4: Write operation note (no commit needed — this is a validation step)**

Record in a scratch notes file: "Indexer validated on <date>: agent 1 minted + indexed successfully."

---

## Week 3 — SDK + MCP

### Task 15: Scaffold `@pelletfi/hl` SDK package

**Files:**
- Create: `packages/hl-sdk/package.json`
- Create: `packages/hl-sdk/tsconfig.json`
- Create: `packages/hl-sdk/src/index.ts`
- Create: `packages/hl-sdk/README.md`

- [ ] **Step 1: Create package directory**

```bash
mkdir -p /Users/jake/pellet/packages/hl-sdk/src
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "@pelletfi/hl",
  "version": "0.1.0",
  "description": "TypeScript SDK for Pellet's Hyperliquid agent infrastructure — mint identities, read reputations, submit validations.",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "viem": "^2.0.0"
  },
  "keywords": ["hyperliquid", "agent", "erc-8004", "pellet", "identity", "reputation"],
  "author": "Pellet",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/pelletnetwork/pellet"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write placeholder `src/index.ts`**

```typescript
export { PelletHlClient } from "./client";
export type { HlChain, AgentRecord, AttestationRecord, ValidationRecord } from "./types";
```

(Client + types written in next tasks.)

- [ ] **Step 5: Write `README.md`**

```markdown
# @pelletfi/hl

TypeScript SDK for the Pellet agent infrastructure layer on Hyperliquid.

## Install

```bash
npm install @pelletfi/hl viem
```

## Quick start

```typescript
import { PelletHlClient } from "@pelletfi/hl";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, transport: http("https://rpc.hyperliquid-testnet.xyz/evm") });

const pellet = new PelletHlClient({ chain: "testnet", wallet });

const { agentId, txHash } = await pellet.mintAgentId({ metadataURI: "ipfs://my-agent" });
console.log(`Minted agent #${agentId} in tx ${txHash}`);
```

## Methods

- `pellet.mintAgentId({ metadataURI })` — register a new agent
- `pellet.readAgent({ agentId })` — fetch agent record
- `pellet.readReputation({ agentId })` — list attestations for an agent
- `pellet.postAttestation({ agentId, attestationType, score, metadataURI })` — attest to agent behavior
- `pellet.postValidation({ agentId, claimHash, proofURI })` — submit a validation

See `pellet.network/docs` for the full guide.
```

- [ ] **Step 6: Install peer deps locally (for dev)**

```bash
cd /Users/jake/pellet
npm install --workspace=@pelletfi/hl viem
```

- [ ] **Step 7: Commit scaffold**

```bash
cd /Users/jake/pellet
git add packages/hl-sdk/
git commit -m "chore(hl-sdk): scaffold @pelletfi/hl package"
```

---

### Task 16: Implement SDK client + types

**Files:**
- Create: `packages/hl-sdk/src/client.ts`
- Create: `packages/hl-sdk/src/types.ts`
- Create: `packages/hl-sdk/src/abi.ts` (consolidated ABIs for SDK)
- Create: `packages/hl-sdk/src/addresses.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export type HlChain = "testnet" | "mainnet";

export interface AgentRecord {
  id: bigint;
  controller: `0x${string}`;
  metadataURI: string;
  registeredAt: Date;
}

export interface AttestationRecord {
  id: bigint;
  agentId: bigint;
  attester: `0x${string}`;
  attestationType: `0x${string}`;
  score: bigint;
  metadataURI: string;
  timestamp: Date;
}

export interface ValidationRecord {
  id: bigint;
  agentId: bigint;
  validator: `0x${string}`;
  claimHash: `0x${string}`;
  proofURI: string;
  timestamp: Date;
}
```

- [ ] **Step 2: Copy ABIs into SDK package (avoid cross-package imports)**

```bash
cp /Users/jake/pellet/apps/web/lib/hl/abi/identity.ts /Users/jake/pellet/packages/hl-sdk/src/abi-identity.ts
cp /Users/jake/pellet/apps/web/lib/hl/abi/reputation.ts /Users/jake/pellet/packages/hl-sdk/src/abi-reputation.ts
cp /Users/jake/pellet/apps/web/lib/hl/abi/validation.ts /Users/jake/pellet/packages/hl-sdk/src/abi-validation.ts
```

- [ ] **Step 3: Write `src/addresses.ts`**

Same as `apps/web/lib/hl/addresses.ts` but standalone. After deployment, keep these in sync.

```typescript
import type { HlChain } from "./types";

export const HL_REGISTRY_ADDRESSES: Record<HlChain, {
  identity: `0x${string}`;
  reputation: `0x${string}`;
  validation: `0x${string}`;
}> = {
  testnet: {
    identity: "0x0000000000000000000000000000000000000000", // UPDATE
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
  mainnet: {
    identity: "0x0000000000000000000000000000000000000000",
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
};
```

- [ ] **Step 4: Write `src/client.ts`**

```typescript
import type { PublicClient, WalletClient } from "viem";
import { createPublicClient, http } from "viem";
import { identityRegistryAbi } from "./abi-identity";
import { reputationRegistryAbi } from "./abi-reputation";
import { validationRegistryAbi } from "./abi-validation";
import { HL_REGISTRY_ADDRESSES } from "./addresses";
import type { HlChain, AgentRecord, AttestationRecord, ValidationRecord } from "./types";

const HL_RPC: Record<HlChain, string> = {
  testnet: "https://rpc.hyperliquid-testnet.xyz/evm",
  mainnet: "https://rpc.hyperliquid.xyz/evm",
};

export interface PelletHlClientOptions {
  chain?: HlChain;
  wallet?: WalletClient;
  publicClient?: PublicClient;
}

export class PelletHlClient {
  public readonly chain: HlChain;
  public readonly publicClient: PublicClient;
  public readonly wallet: WalletClient | undefined;

  constructor(opts: PelletHlClientOptions = {}) {
    this.chain = opts.chain ?? "testnet";
    this.wallet = opts.wallet;
    this.publicClient = opts.publicClient ?? createPublicClient({
      transport: http(HL_RPC[this.chain]),
    });
  }

  private get addresses() {
    return HL_REGISTRY_ADDRESSES[this.chain];
  }

  /// ====================================================================
  /// Identity
  /// ====================================================================

  async mintAgentId(params: { metadataURI: string }): Promise<{
    agentId: bigint;
    txHash: `0x${string}`;
  }> {
    if (!this.wallet) throw new Error("mintAgentId requires a wallet client");
    const account = this.wallet.account;
    if (!account) throw new Error("wallet.account is required");

    const hash = await this.wallet.writeContract({
      address: this.addresses.identity,
      abi: identityRegistryAbi,
      functionName: "registerAgent",
      args: [params.metadataURI],
      account,
      chain: null,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    // Parse the AgentRegistered event to get agentId
    const logs = receipt.logs.filter(l => l.address.toLowerCase() === this.addresses.identity.toLowerCase());
    if (logs.length === 0) throw new Error("No AgentRegistered event in receipt");
    const parsed = logs[0];
    // The agentId is indexed topic 1 (topic 0 is the event signature)
    const agentId = BigInt(parsed.topics[1] as `0x${string}`);
    return { agentId, txHash: hash };
  }

  async readAgent(params: { agentId: bigint }): Promise<AgentRecord> {
    const result = await this.publicClient.readContract({
      address: this.addresses.identity,
      abi: identityRegistryAbi,
      functionName: "getAgent",
      args: [params.agentId],
    }) as { id: bigint; controller: `0x${string}`; metadataURI: string; registeredAt: bigint };

    return {
      id: result.id,
      controller: result.controller,
      metadataURI: result.metadataURI,
      registeredAt: new Date(Number(result.registeredAt) * 1000),
    };
  }

  /// ====================================================================
  /// Reputation
  /// ====================================================================

  async postAttestation(params: {
    agentId: bigint;
    attestationType: `0x${string}`;
    score: bigint;
    metadataURI: string;
  }): Promise<{ attestationId: bigint; txHash: `0x${string}` }> {
    if (!this.wallet) throw new Error("postAttestation requires a wallet client");
    const account = this.wallet.account;
    if (!account) throw new Error("wallet.account is required");

    const hash = await this.wallet.writeContract({
      address: this.addresses.reputation,
      abi: reputationRegistryAbi,
      functionName: "postAttestation",
      args: [params.agentId, params.attestationType, params.score, params.metadataURI],
      account,
      chain: null,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    const logs = receipt.logs.filter(l => l.address.toLowerCase() === this.addresses.reputation.toLowerCase());
    const attestationId = BigInt(logs[0].topics[1] as `0x${string}`);
    return { attestationId, txHash: hash };
  }

  async attestationCountForAgent(params: { agentId: bigint }): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.addresses.reputation,
      abi: reputationRegistryAbi,
      functionName: "attestationCountForAgent",
      args: [params.agentId],
    });
    return result as bigint;
  }

  /// ====================================================================
  /// Validation
  /// ====================================================================

  async postValidation(params: {
    agentId: bigint;
    claimHash: `0x${string}`;
    proofURI: string;
  }): Promise<{ validationId: bigint; txHash: `0x${string}` }> {
    if (!this.wallet) throw new Error("postValidation requires a wallet client");
    const account = this.wallet.account;
    if (!account) throw new Error("wallet.account is required");

    const hash = await this.wallet.writeContract({
      address: this.addresses.validation,
      abi: validationRegistryAbi,
      functionName: "postValidation",
      args: [params.agentId, params.claimHash, params.proofURI],
      account,
      chain: null,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    const logs = receipt.logs.filter(l => l.address.toLowerCase() === this.addresses.validation.toLowerCase());
    const validationId = BigInt(logs[0].topics[1] as `0x${string}`);
    return { validationId, txHash: hash };
  }
}
```

- [ ] **Step 5: Build the SDK**

```bash
cd /Users/jake/pellet/packages/hl-sdk
npm run build
```

Expected: `dist/` directory created with `.js` and `.d.ts` files. No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-sdk/
git commit -m "feat(hl-sdk): implement PelletHlClient with identity/reputation/validation methods"
```

---

### Task 17: Smoke-test SDK against testnet

**Files:** Create scratch script (not committed)

- [ ] **Step 1: Write a smoke-test script**

```bash
mkdir -p /tmp/hl-smoke && cd /tmp/hl-smoke
cat > test.ts <<'EOF'
import { PelletHlClient } from "@pelletfi/hl";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({
  account,
  transport: http("https://rpc.hyperliquid-testnet.xyz/evm"),
});

const pellet = new PelletHlClient({ chain: "testnet", wallet });

const { agentId, txHash } = await pellet.mintAgentId({ metadataURI: "ipfs://smoke-test" });
console.log("Minted agent:", { agentId: agentId.toString(), txHash });

const agent = await pellet.readAgent({ agentId });
console.log("Read back:", agent);
EOF
```

- [ ] **Step 2: Run smoke test via `npx tsx` with workspace linking**

```bash
cd /Users/jake/pellet/packages/hl-sdk && npm link
cd /tmp/hl-smoke && npm link @pelletfi/hl
npm install viem tsx
PRIVATE_KEY=0x<your-testnet-key> npx tsx test.ts
```

Expected: Mints a new agent on testnet, logs the ID, reads back the record matching `"ipfs://smoke-test"`.

- [ ] **Step 3: Record outcome (no commit)**

Note: success → SDK is wired correctly end-to-end against testnet.

---

### Task 18: Publish `@pelletfi/hl` to npm (dry run first)

**Files:** none

- [ ] **Step 1: Verify npm auth**

```bash
npm whoami
```

Expected: `pelletfi` or your npm username with publish access to the `@pelletfi` scope.

- [ ] **Step 2: Dry-run publish**

```bash
cd /Users/jake/pellet/packages/hl-sdk
npm publish --dry-run --access public
```

Expected: Lists files to be published (dist/, README.md, package.json). No errors.

- [ ] **Step 3: Publish for real**

```bash
cd /Users/jake/pellet/packages/hl-sdk
npm publish --access public
```

Expected: `+ @pelletfi/hl@0.1.0` in output.

- [ ] **Step 4: Verify package on npmjs.com**

```bash
npm view @pelletfi/hl
```

Expected: Package info printed with version 0.1.0.

- [ ] **Step 5: Tag the release**

```bash
cd /Users/jake/pellet
git tag hl-sdk-v0.1.0
git push origin hl-sdk-v0.1.0
```

---

### Task 19: Scaffold `@pelletfi/hl-mcp` MCP server

**Files:**
- Create: `packages/hl-mcp/package.json`
- Create: `packages/hl-mcp/tsconfig.json`
- Create: `packages/hl-mcp/src/index.ts`
- Create: `packages/hl-mcp/bin/pellet-hl-mcp.js`
- Create: `packages/hl-mcp/README.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/jake/pellet/packages/hl-mcp/src /Users/jake/pellet/packages/hl-mcp/bin
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "@pelletfi/hl-mcp",
  "version": "0.1.0",
  "description": "MCP server exposing Pellet's Hyperliquid agent infrastructure as tools for AI agents.",
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "pellet-hl-mcp": "./bin/pellet-hl-mcp.js"
  },
  "files": ["dist", "bin", "README.md"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@pelletfi/hl": "^0.1.0",
    "viem": "^2.0.0"
  },
  "keywords": ["mcp", "hyperliquid", "agent", "pellet"],
  "author": "Pellet",
  "license": "MIT"
}
```

- [ ] **Step 3: Write `tsconfig.json`** (same as SDK)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `bin/pellet-hl-mcp.js`**

```javascript
#!/usr/bin/env node
import "../dist/index.js";
```

Make it executable:

```bash
chmod +x /Users/jake/pellet/packages/hl-mcp/bin/pellet-hl-mcp.js
```

- [ ] **Step 5: Write placeholder `src/index.ts`** (real tools next task)

```typescript
// Entry point for the Pellet HL MCP server.
// Tools implemented in ./tools.ts
console.log("pellet-hl-mcp starting...");
```

- [ ] **Step 6: Install deps**

```bash
cd /Users/jake/pellet
npm install --workspace=@pelletfi/hl-mcp @modelcontextprotocol/sdk @pelletfi/hl viem
```

- [ ] **Step 7: Commit scaffold**

```bash
cd /Users/jake/pellet
git add packages/hl-mcp/
git commit -m "chore(hl-mcp): scaffold @pelletfi/hl-mcp package"
```

---

### Task 20: Implement MCP tools

**Files:**
- Create: `packages/hl-mcp/src/tools.ts`
- Modify: `packages/hl-mcp/src/index.ts`

- [ ] **Step 1: Write `src/tools.ts`**

```typescript
import { PelletHlClient } from "@pelletfi/hl";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const HL_RPC_TESTNET = "https://rpc.hyperliquid-testnet.xyz/evm";

function getClient() {
  const key = process.env.PELLET_HL_PRIVATE_KEY;
  if (!key) throw new Error("PELLET_HL_PRIVATE_KEY env var is required");
  const account = privateKeyToAccount(key as `0x${string}`);
  const wallet = createWalletClient({
    account,
    transport: http(HL_RPC_TESTNET),
  });
  return new PelletHlClient({ chain: "testnet", wallet });
}

export function registerTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "pellet_hl_mint_agent",
        description: "Register a new agent in Pellet's Hyperliquid identity registry. Returns the newly minted agent ID.",
        inputSchema: {
          type: "object",
          properties: {
            metadataURI: {
              type: "string",
              description: "URI pointing to the agent's metadata JSON (ERC-8004 schema)",
            },
          },
          required: ["metadataURI"],
        },
      },
      {
        name: "pellet_hl_read_agent",
        description: "Read an agent record by ID.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID (uint256 as string)" },
          },
          required: ["agentId"],
        },
      },
      {
        name: "pellet_hl_post_attestation",
        description: "Post a reputation attestation about an agent.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            attestationType: { type: "string", description: "bytes32 hex, e.g. keccak256('outcome:success')" },
            score: { type: "string", description: "int256 score as string" },
            metadataURI: { type: "string" },
          },
          required: ["agentId", "attestationType", "score", "metadataURI"],
        },
      },
      {
        name: "pellet_hl_read_reputation",
        description: "Get the attestation count for an agent.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
          },
          required: ["agentId"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const client = getClient();

    switch (name) {
      case "pellet_hl_mint_agent": {
        const { agentId, txHash } = await client.mintAgentId({
          metadataURI: args!.metadataURI as string,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ agentId: agentId.toString(), txHash }) }],
        };
      }

      case "pellet_hl_read_agent": {
        const agent = await client.readAgent({ agentId: BigInt(args!.agentId as string) });
        return {
          content: [{ type: "text", text: JSON.stringify({
            id: agent.id.toString(),
            controller: agent.controller,
            metadataURI: agent.metadataURI,
            registeredAt: agent.registeredAt.toISOString(),
          }) }],
        };
      }

      case "pellet_hl_post_attestation": {
        const { attestationId, txHash } = await client.postAttestation({
          agentId: BigInt(args!.agentId as string),
          attestationType: args!.attestationType as `0x${string}`,
          score: BigInt(args!.score as string),
          metadataURI: args!.metadataURI as string,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ attestationId: attestationId.toString(), txHash }) }],
        };
      }

      case "pellet_hl_read_reputation": {
        const count = await client.attestationCountForAgent({ agentId: BigInt(args!.agentId as string) });
        return {
          content: [{ type: "text", text: JSON.stringify({ attestationCount: count.toString() }) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}
```

- [ ] **Step 2: Write `src/index.ts`**

```typescript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new Server(
  { name: "pellet-hl-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 3: Build**

```bash
cd /Users/jake/pellet/packages/hl-mcp
npm run build
```

Expected: No errors. `dist/index.js` and `dist/tools.js` produced.

- [ ] **Step 4: Smoke-test MCP server**

```bash
cd /Users/jake/pellet/packages/hl-mcp
PELLET_HL_PRIVATE_KEY=0x<testnet-key> node dist/index.js
```

Expected: Server starts, waits for MCP client input on stdin. Kill with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/pellet
git add packages/hl-mcp/src/
git commit -m "feat(hl-mcp): implement 4 core MCP tools"
```

---

### Task 21: Publish `@pelletfi/hl-mcp` to npm

- [ ] **Step 1: Dry-run publish**

```bash
cd /Users/jake/pellet/packages/hl-mcp
npm publish --dry-run --access public
```

- [ ] **Step 2: Publish**

```bash
npm publish --access public
```

Expected: `+ @pelletfi/hl-mcp@0.1.0`.

- [ ] **Step 3: Tag**

```bash
cd /Users/jake/pellet
git tag hl-mcp-v0.1.0
git push origin hl-mcp-v0.1.0
```

---

## Week 4 — Frontend + Brand

### Task 22: Scaffold `apps/web/app/hl/` route tree + HL-specific layout

**Files:**
- Create: `apps/web/app/hl/layout.tsx`
- Create: `apps/web/app/hl/page.tsx`
- Create: `apps/web/app/hl/styles.css`

- [ ] **Step 1: Write `apps/web/app/hl/styles.css`** — brand v2 styles, scoped to `.hl-root` class

```css
/* Pellet brand v2 — scoped to HL surfaces. Locked 2026-04-22. */
.hl-root {
  --hl-navy: #00006d;      /* primary mark + CTAs + accents */
  --hl-paper: #e8f1f3;     /* main background */
  --hl-white: #ffffff;     /* card/panel surfaces */
  --hl-ink-1: #000000;     /* primary text on paper */
  --hl-ink-2: #3a3a3a;     /* secondary text */
  --hl-ink-3: #5a5a5a;     /* tertiary */
  --hl-ink-4: #6e6e6e;     /* labels / faint */
  --hl-green: #34c759;     /* success signals */
  --hl-sky: #70bbff;       /* secondary accent */
  --hl-steel: #8fa2b5;
  --hl-cloud: #e6e6e6;

  font-family: 'Inter', system-ui, sans-serif;
  color: var(--hl-ink-1);
  background: var(--hl-paper);
  min-height: 100vh;
}

.hl-root h1, .hl-root h2, .hl-root h3,
.hl-root .hl-display {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.hl-root .hl-mono {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

.hl-root a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hl-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 32px;
  color: var(--hl-paper);
}

.hl-card {
  background: var(--hl-paper);
  color: var(--hl-ink-1);
  border-radius: 4px;
  padding: 24px;
  margin-bottom: 16px;
}
```

- [ ] **Step 2: Write `apps/web/app/hl/layout.tsx`**

```typescript
import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Pellet — Agent Infrastructure for Hyperliquid",
  description: "The agent infrastructure layer for Hyperliquid. Identity, execution, accountability.",
};

export default function HlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hl-root">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Write `apps/web/app/hl/page.tsx`** (landing page — placeholder, filled in Task 24)

```typescript
export default function HlLanding() {
  return (
    <main className="hl-shell">
      <h1 className="hl-display" style={{ fontSize: 72, marginBottom: 8 }}>
        Pellet
      </h1>
      <p className="hl-mono" style={{ fontSize: 16, marginBottom: 48, opacity: 0.8 }}>
        The agent infrastructure layer for Hyperliquid.
      </p>
      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 24, marginBottom: 12 }}>
          Registry
        </h2>
        <p>Agent list loading... (Task 24)</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Start dev server and verify**

```bash
cd /Users/jake/pellet/apps/web
npm run dev
```

In browser: `http://localhost:3000/hl`

Expected: Blue page with white "Pellet" headline in IBM Plex Mono, card with "Registry" heading.

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/app/hl/
git commit -m "feat(hl): scaffold apps/web/app/hl/ route tree + brand v2 styles"
```

---

### Task 23: Build registry landing page (agent list from DB)

**Files:**
- Create: `apps/web/components/hl/RegistryTable.tsx`
- Modify: `apps/web/app/hl/page.tsx`

- [ ] **Step 1: Write `apps/web/components/hl/RegistryTable.tsx`** (server component)

```typescript
import { db } from "@/lib/db";
import { hlAgentIds } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export async function RegistryTable() {
  const agents = await db
    .select()
    .from(hlAgentIds)
    .orderBy(desc(hlAgentIds.registeredAt))
    .limit(50);

  if (agents.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", opacity: 0.6 }}>
        <p>No agents registered yet.</p>
        <p className="hl-mono" style={{ fontSize: 12, marginTop: 8 }}>
          Call <code>pellet.mintAgentId()</code> to register one.
        </p>
      </div>
    );
  }

  return (
    <table className="hl-mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #e6e6e6" }}>
          <th style={{ padding: "12px 8px" }}>#</th>
          <th style={{ padding: "12px 8px" }}>Controller</th>
          <th style={{ padding: "12px 8px" }}>Metadata</th>
          <th style={{ padding: "12px 8px" }}>Registered</th>
        </tr>
      </thead>
      <tbody>
        {agents.map(a => (
          <tr key={a.agentId} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ padding: "12px 8px" }}>
              <Link href={`/hl/agent/${a.agentId}`}>#{a.agentId}</Link>
            </td>
            <td style={{ padding: "12px 8px" }}>
              {a.controller.slice(0, 6)}…{a.controller.slice(-4)}
            </td>
            <td style={{ padding: "12px 8px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.metadataUri || "—"}
            </td>
            <td style={{ padding: "12px 8px", opacity: 0.7 }}>
              {a.registeredAt.toISOString().slice(0, 10)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Update `apps/web/app/hl/page.tsx`**

```typescript
import { RegistryTable } from "@/components/hl/RegistryTable";

export const revalidate = 300; // 5 min ISR

export default async function HlLanding() {
  return (
    <main className="hl-shell">
      <header style={{ marginBottom: 48 }}>
        <h1 className="hl-display" style={{ fontSize: 72, marginBottom: 8 }}>
          Pellet
        </h1>
        <p className="hl-mono" style={{ fontSize: 16, opacity: 0.8 }}>
          The agent infrastructure layer for Hyperliquid.
        </p>
      </header>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 24, marginBottom: 20 }}>
          Registry
        </h2>
        <RegistryTable />
      </div>

      <footer className="hl-mono" style={{ fontSize: 11, marginTop: 48, opacity: 0.6 }}>
        Deployed on HyperEVM testnet · ERC-8004 reference implementation · Open source MIT
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd /Users/jake/pellet/apps/web
npm run dev
```

Navigate to `http://localhost:3000/hl`. Expected: registry table shows any agents indexed so far (at least the smoke-test one from Task 14).

- [ ] **Step 4: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/components/hl/RegistryTable.tsx apps/web/app/hl/page.tsx
git commit -m "feat(hl): implement registry landing page with agent list"
```

---

### Task 24: Build per-agent profile page

**Files:**
- Create: `apps/web/app/hl/agent/[id]/page.tsx`
- Create: `apps/web/components/hl/AgentProfile.tsx`

- [ ] **Step 1: Write `apps/web/components/hl/AgentProfile.tsx`**

```typescript
import { db } from "@/lib/db";
import { hlAgentIds, hlAttestations, hlValidations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";

export async function AgentProfile({ id }: { id: string }) {
  const agentRows = await db.select().from(hlAgentIds).where(eq(hlAgentIds.agentId, id)).limit(1);
  if (agentRows.length === 0) return notFound();
  const agent = agentRows[0];

  const [attestations, validations] = await Promise.all([
    db.select().from(hlAttestations).where(eq(hlAttestations.agentId, id)).orderBy(desc(hlAttestations.timestamp)).limit(20),
    db.select().from(hlValidations).where(eq(hlValidations.agentId, id)).orderBy(desc(hlValidations.timestamp)).limit(20),
  ]);

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <p className="hl-mono" style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
          AGENT
        </p>
        <h1 className="hl-display" style={{ fontSize: 56 }}>#{agent.agentId}</h1>
      </header>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 18, marginBottom: 16 }}>Identity</h2>
        <dl className="hl-mono" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <dt style={{ opacity: 0.6 }}>Controller</dt>
          <dd>{agent.controller}</dd>
          <dt style={{ opacity: 0.6, marginTop: 8 }}>Metadata URI</dt>
          <dd>{agent.metadataUri || "—"}</dd>
          <dt style={{ opacity: 0.6, marginTop: 8 }}>Registered at</dt>
          <dd>{agent.registeredAt.toISOString()}</dd>
          <dt style={{ opacity: 0.6, marginTop: 8 }}>Block</dt>
          <dd>{agent.blockNumber.toString()}</dd>
        </dl>
      </div>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 18, marginBottom: 16 }}>
          Attestations ({attestations.length})
        </h2>
        {attestations.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No attestations yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {attestations.map(a => (
              <li key={a.attestationId} className="hl-mono" style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span>#{a.attestationId}</span>
                {" · "}
                <span>{a.attestationType.slice(0, 10)}…</span>
                {" · "}
                <span>score {a.score}</span>
                {" · "}
                <span style={{ opacity: 0.6 }}>{a.timestamp.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 18, marginBottom: 16 }}>
          Validations ({validations.length})
        </h2>
        {validations.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No validations yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {validations.map(v => (
              <li key={v.validationId} className="hl-mono" style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span>#{v.validationId}</span>
                {" · "}
                <span>claim {v.claimHash.slice(0, 10)}…</span>
                {" · "}
                <span style={{ opacity: 0.6 }}>{v.timestamp.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Write `apps/web/app/hl/agent/[id]/page.tsx`**

```typescript
import { AgentProfile } from "@/components/hl/AgentProfile";
import Link from "next/link";

export const revalidate = 60;

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="hl-shell">
      <Link href="/hl" className="hl-mono" style={{ fontSize: 12, opacity: 0.7 }}>
        ← REGISTRY
      </Link>
      <div style={{ marginTop: 24 }}>
        <AgentProfile id={id} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/hl/agent/1` (assuming you have agent 1 from smoke test).

Expected: Profile page shows the agent's controller, metadata URI, registration date, block number, and empty attestation/validation sections.

- [ ] **Step 4: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/components/hl/AgentProfile.tsx apps/web/app/hl/agent/
git commit -m "feat(hl): implement per-agent profile page"
```

---

### Task 25: Add `/hl/docs` placeholder

**Files:**
- Create: `apps/web/app/hl/docs/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
export const metadata = {
  title: "Docs — Pellet HL",
};

export default function DocsPage() {
  return (
    <main className="hl-shell">
      <header style={{ marginBottom: 32 }}>
        <p className="hl-mono" style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>DOCS</p>
        <h1 className="hl-display" style={{ fontSize: 56 }}>Building Agents on Hyperliquid</h1>
      </header>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 20, marginBottom: 16 }}>Quickstart</h2>
        <p>Install the SDK:</p>
        <pre className="hl-mono" style={{ background: "#f6f6f6", padding: 12, borderRadius: 4, overflow: "auto", fontSize: 13 }}>
{`npm install @pelletfi/hl viem`}
        </pre>
        <p style={{ marginTop: 16 }}>Mint an agent ID:</p>
        <pre className="hl-mono" style={{ background: "#f6f6f6", padding: 12, borderRadius: 4, overflow: "auto", fontSize: 13 }}>
{`import { PelletHlClient } from "@pelletfi/hl";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const wallet = createWalletClient({
  account,
  transport: http("https://rpc.hyperliquid-testnet.xyz/evm"),
});

const pellet = new PelletHlClient({ chain: "testnet", wallet });
const { agentId } = await pellet.mintAgentId({
  metadataURI: "ipfs://my-agent-metadata",
});`}
        </pre>
      </div>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 20, marginBottom: 16 }}>MCP</h2>
        <p>Install the MCP server:</p>
        <pre className="hl-mono" style={{ background: "#f6f6f6", padding: 12, borderRadius: 4, overflow: "auto", fontSize: 13 }}>
{`npx @pelletfi/hl-mcp`}
        </pre>
        <p style={{ marginTop: 16 }}>Tools exposed:</p>
        <ul className="hl-mono" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <li>pellet_hl_mint_agent</li>
          <li>pellet_hl_read_agent</li>
          <li>pellet_hl_post_attestation</li>
          <li>pellet_hl_read_reputation</li>
        </ul>
      </div>

      <div className="hl-card">
        <h2 className="hl-display" style={{ fontSize: 20, marginBottom: 16 }}>Contracts</h2>
        <p>HyperEVM testnet deployments:</p>
        <dl className="hl-mono" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <dt style={{ opacity: 0.6 }}>IdentityRegistry</dt>
          <dd>See deployments/hyperevm-testnet.json</dd>
          <dt style={{ opacity: 0.6, marginTop: 8 }}>ReputationRegistry</dt>
          <dd>See deployments/hyperevm-testnet.json</dd>
          <dt style={{ opacity: 0.6, marginTop: 8 }}>ValidationRegistry</dt>
          <dd>See deployments/hyperevm-testnet.json</dd>
        </dl>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/hl/docs`. Expected: Docs page renders with quickstart code blocks.

- [ ] **Step 3: Commit**

```bash
cd /Users/jake/pellet
git add apps/web/app/hl/docs/
git commit -m "feat(hl): add docs placeholder with quickstart"
```

---

### Task 26: Pre-launch integration checklist

**Files:** none

- [ ] **Step 1: Verify all crons run clean**

```bash
curl http://localhost:3000/api/cron/hl-identity-index
curl http://localhost:3000/api/cron/hl-reputation-index
curl http://localhost:3000/api/cron/hl-validation-index
```

Expected: All return `{"ok": true, ...}`.

- [ ] **Step 2: Verify `/hl` and `/hl/agent/[id]` render**

Load both in browser. Confirm data renders from DB.

- [ ] **Step 3: Verify SDK installs cleanly**

```bash
cd /tmp
mkdir hl-install-test && cd hl-install-test
npm init -y
npm install @pelletfi/hl viem
node -e "import('@pelletfi/hl').then(m => console.log(m))"
```

Expected: Module imports without errors.

- [ ] **Step 4: Verify MCP server starts**

```bash
PELLET_HL_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001 npx @pelletfi/hl-mcp
```

Expected: Server starts (you can Ctrl-C after it prints startup message).

- [ ] **Step 5: Verify type-check passes across the whole monorepo**

```bash
cd /Users/jake/pellet
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Verify package publishability (packages build clean)**

```bash
cd /Users/jake/pellet/packages/hl-sdk && npm run build
cd /Users/jake/pellet/packages/hl-mcp && npm run build
```

Expected: both build without errors, `dist/` directories populated.

- [ ] **Step 7: Deploy to Vercel preview**

```bash
cd /Users/jake/pellet
git push origin main
```

Wait for Vercel deployment to complete. Check the preview URL for `/hl`.

- [ ] **Step 8: Smoke-test preview URL**

Load `https://<preview-url>/hl` in browser. Verify:
- Page loads
- Agent list renders (showing agents indexed so far)
- Clicking an agent loads profile page
- `/hl/docs` renders

- [ ] **Step 9: Final commit — tag Phase 1 milestone**

```bash
cd /Users/jake/pellet
git tag hl-phase-1-complete
git push origin hl-phase-1-complete
```

---

## Post-Phase-1 parallel work (not blocking)

These are founder-activity tasks, done alongside the build. Not part of the execution plan but listed for completeness:

1. **Outreach to Senpi, NickAI, HyperAgent, Katoshi, Based** — cold emails / DMs proposing integration. Start in week 1.
2. **Write "Building Agents on Hyperliquid" canonical guide** — long-form content. Publish with Phase 1 launch.
3. **Audit coordination** — engage Certora / OpenZeppelin / Spearbit / solo auditor for contract review. Target completion: week 6-8.
4. **Brand asset integration** — when designer sends source files, integrate into `apps/web/components/hl/BrandMark.tsx`, favicon, OG images.
5. **Public launch announcement** — X thread, blog post, HypurrCo ecosystem listing submission.

---

## Self-Review Checklist

After Phase 1 ships:

- [ ] All 3 contracts deployed to HyperEVM testnet, addresses recorded
- [ ] All 3 indexers running hourly without errors
- [ ] `@pelletfi/hl` published to npm, installable
- [ ] `@pelletfi/hl-mcp` published to npm, installable
- [ ] `pellet.network` serves agent registry, loads from DB
- [ ] `pellet.network/agent/[id]` serves per-agent profile
- [ ] `pellet.network/docs` has working quickstart
- [ ] Type-check passes across monorepo
- [ ] At least 1 platform partnership conversation in progress

---

## Next Plan

Phase 2 (weeks 5-12): CoreWriter builder-code router + execution SDK methods + integration partnerships. Separate plan, scoped after Phase 1 launch signal.
