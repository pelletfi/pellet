// Shared types for the HL (Hyperliquid) module.
// This module has no imports from elsewhere in the repo — fully standalone.

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
  attestationType: `0x${string}`;
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

export interface RegistryAddresses {
  identity: `0x${string}`;
  reputation: `0x${string}`;
  validation: `0x${string}`;
}
