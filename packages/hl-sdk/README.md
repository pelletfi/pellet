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
