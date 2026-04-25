import type { PublicClient, WalletClient, Address, Hex } from "viem";
import type {
  HlChain,
  AgentRecord,
  AttestationRecord,
  ValidationRecord,
  MintAgentResult,
  PostAttestationResult,
  PostValidationResult,
} from "./types.js";
import { CONTRACTS, IDENTITY_ABI, REPUTATION_ABI, VALIDATION_ABI } from "./constants.js";

type ClientOptions = {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  chain?: HlChain;
  addressOverrides?: Partial<Record<"identity" | "reputation" | "validation", Address>>;
};

export class PelletHlClient {
  #publicClient: PublicClient;
  #walletClient?: WalletClient;
  #addresses: { identity: Address; reputation: Address; validation: Address };

  constructor(opts: ClientOptions) {
    this.#publicClient = opts.publicClient;
    this.#walletClient = opts.walletClient;
    const chainAddresses = CONTRACTS[opts.chain ?? "mainnet"];
    this.#addresses = {
      identity: opts.addressOverrides?.identity ?? chainAddresses.identity,
      reputation: opts.addressOverrides?.reputation ?? chainAddresses.reputation,
      validation: opts.addressOverrides?.validation ?? chainAddresses.validation,
    };
  }

  async readAgent(agentId: bigint): Promise<AgentRecord> {
    const raw = await this.#publicClient.readContract({
      address: this.#addresses.identity,
      abi: IDENTITY_ABI,
      functionName: "getAgent",
      args: [agentId],
    });
    return {
      controller: raw.controller,
      registeredAt: raw.registeredAt,
      metadataURI: raw.metadataURI,
    };
  }

  async readReputation(agentId: bigint): Promise<readonly AttestationRecord[]> {
    const count = await this.#publicClient.readContract({
      address: this.#addresses.reputation,
      abi: REPUTATION_ABI,
      functionName: "attestationCountForAgent",
      args: [agentId],
    });
    const records: AttestationRecord[] = [];
    for (let i = 0; i < Number(count); i++) {
      const id = await this.#publicClient.readContract({
        address: this.#addresses.reputation,
        abi: REPUTATION_ABI,
        functionName: "attestationsByAgent",
        args: [agentId, BigInt(i)],
      });
      const raw = await this.#publicClient.readContract({
        address: this.#addresses.reputation,
        abi: REPUTATION_ABI,
        functionName: "getAttestation",
        args: [id],
      });
      records.push({
        agentId: raw.agentId,
        attester: raw.attester,
        timestamp: raw.timestamp,
        attestationType: raw.attestationType,
        score: raw.score,
        metadataURI: raw.metadataURI,
      });
    }
    return records;
  }

  async readValidation(agentId: bigint): Promise<readonly ValidationRecord[]> {
    const count = await this.#publicClient.readContract({
      address: this.#addresses.validation,
      abi: VALIDATION_ABI,
      functionName: "validationCountForAgent",
      args: [agentId],
    });
    const records: ValidationRecord[] = [];
    for (let i = 0; i < Number(count); i++) {
      const id = await this.#publicClient.readContract({
        address: this.#addresses.validation,
        abi: VALIDATION_ABI,
        functionName: "validationsByAgent",
        args: [agentId, BigInt(i)],
      });
      const raw = await this.#publicClient.readContract({
        address: this.#addresses.validation,
        abi: VALIDATION_ABI,
        functionName: "getValidation",
        args: [id],
      });
      records.push({
        agentId: raw.agentId,
        validator: raw.validator,
        timestamp: raw.timestamp,
        claimHash: raw.claimHash,
        proofURI: raw.proofURI,
      });
    }
    return records;
  }

  async mintAgentId({
    metadataURI,
  }: {
    metadataURI: string;
  }): Promise<MintAgentResult> {
    const wallet = this.#requireWallet();
    const { result: agentId, request } = await this.#publicClient.simulateContract({
      address: this.#addresses.identity,
      abi: IDENTITY_ABI,
      functionName: "registerAgent",
      args: [metadataURI],
      account: wallet.account!,
    });
    const txHash = await wallet.writeContract(request);
    return { agentId, txHash };
  }

  async postAttestation({
    agentId,
    attestationType,
    score,
    metadataURI,
  }: {
    agentId: bigint;
    attestationType: Hex;
    score: bigint;
    metadataURI: string;
  }): Promise<PostAttestationResult> {
    const wallet = this.#requireWallet();
    const { result: attestationId, request } = await this.#publicClient.simulateContract({
      address: this.#addresses.reputation,
      abi: REPUTATION_ABI,
      functionName: "postAttestation",
      args: [agentId, attestationType, score, metadataURI],
      account: wallet.account!,
    });
    const txHash = await wallet.writeContract(request);
    return { attestationId, txHash };
  }

  async postValidation({
    agentId,
    claimHash,
    proofURI,
  }: {
    agentId: bigint;
    claimHash: Hex;
    proofURI: string;
  }): Promise<PostValidationResult> {
    const wallet = this.#requireWallet();
    const { result: validationId, request } = await this.#publicClient.simulateContract({
      address: this.#addresses.validation,
      abi: VALIDATION_ABI,
      functionName: "postValidation",
      args: [agentId, claimHash, proofURI],
      account: wallet.account!,
    });
    const txHash = await wallet.writeContract(request);
    return { validationId, txHash };
  }

  #requireWallet(): WalletClient {
    if (!this.#walletClient || !this.#walletClient.account) {
      throw new Error("WalletClient with account is required for write operations");
    }
    return this.#walletClient;
  }
}
