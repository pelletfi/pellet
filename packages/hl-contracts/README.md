# Pellet HL Contracts

ERC-8004 registries deployed on HyperEVM for agent identity, reputation, and validation.

## Mainnet (live)

Deployed to HyperEVM mainnet (chain 999) at block `33,290,371` on 2026-04-23.
All three registries are source-verified on [HyperScan](https://www.hyperscan.com).

| Registry | Address | Verified |
|---|---|---|
| IdentityRegistry | `0x2bfcb081c8c5F98261efcdEC3971D0b1bc7ad943` | [HyperScan](https://www.hyperscan.com/address/0x2bfcb081c8c5F98261efcdEC3971D0b1bc7ad943#code) |
| ReputationRegistry | `0x8cA1f4E2335271f12E5E14Cd8378B558fd14114b` | [HyperScan](https://www.hyperscan.com/address/0x8cA1f4E2335271f12E5E14Cd8378B558fd14114b#code) |
| ValidationRegistry | `0x7c44Dc7Fb45D723455DB1b69EE08Bd718998e5B4` | [HyperScan](https://www.hyperscan.com/address/0x7c44Dc7Fb45D723455DB1b69EE08Bd718998e5B4#code) |

**First agent**: Pellet itself was registered as `agentId 1` on 2026-04-24 (tx [`0x4f427e…147`](https://www.hyperscan.com/tx/0x4f427e4e04417f0a15072d63e89518fdc85d859d70f51ace3a4be2f332d71147)). Agent metadata: [`pellet.network/.well-known/agent.json`](https://pellet.network/.well-known/agent.json).

The deployer (`0x2cbd…1834`) is retired — contracts are permissionless and the deployer retains zero special authority.

Full deploy + verification manifest: [`deployments/hyperevm-mainnet.json`](deployments/hyperevm-mainnet.json).

## Setup

1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation):

   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. Install dependencies:

   ```bash
   forge install
   ```

3. Copy the env template and fill in a deployer private key:

   ```bash
   cp .env.example .env
   # Edit .env and set PRIVATE_KEY to a testnet-only deployer wallet
   ```

   ⚠️ Use a fresh wallet with testnet funds only. Never reuse a mainnet wallet.

## Testnet

HyperEVM testnet RPC: `https://rpc.hyperliquid-testnet.xyz/evm` (chain ID 998).
Faucet: see [Hyperliquid docs](https://hyperliquid.gitbook.io/hyperliquid-docs).

## Build

```bash
forge build
```

## Test

```bash
forge test -vv
```

Run with gas reports:

```bash
forge test --gas-report
```

## Deploy to HyperEVM testnet

1. Fund a fresh testnet-only deployer wallet with HyperEVM testnet ETH (use the [official faucet](https://app.hyperliquid-testnet.xyz/drip)).

2. Set your private key:

   ```bash
   cp .env.example .env
   # Edit .env and set PRIVATE_KEY to your testnet deployer
   export $(grep -v '^#' .env | xargs)
   ```

   ⚠️ Never use a mainnet wallet or a wallet with real funds.

3. Dry-run (optional — simulates the deploy without broadcasting):

   ```bash
   forge script script/Deploy.s.sol --rpc-url hyperevm_testnet
   ```

4. Deploy for real:

   ```bash
   forge script script/Deploy.s.sol \
     --rpc-url hyperevm_testnet \
     --broadcast
   ```

5. Copy the three addresses from the script output and save them to `deployments/hyperevm-testnet.json`:

   ```json
   {
     "chainId": 998,
     "deployedAt": "2026-MM-DDTHH:MM:SSZ",
     "deployer": "0x...",
     "contracts": {
       "IdentityRegistry": "0x...",
       "ReputationRegistry": "0x...",
       "ValidationRegistry": "0x..."
     }
   }
   ```

6. Commit the deployments JSON to git.

## Deploy to HyperEVM mainnet

Same flow with `--rpc-url hyperevm_mainnet`. **Do not deploy to mainnet without an audit** — this is Phase 1 pre-audit reference implementation.

## Contracts

- `IdentityRegistry` — ERC-8004 agent identity registry
- `ReputationRegistry` — ERC-8004 reputation attestations
- `ValidationRegistry` — ERC-8004 validation attestations
