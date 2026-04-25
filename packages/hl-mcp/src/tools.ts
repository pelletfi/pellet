import { z } from "zod";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PelletHlClient, CHAIN_CONFIG, CONTRACTS } from "@pelletnetwork/hl";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const chain = (process.env.HL_CHAIN as "mainnet" | "testnet") ?? "mainnet";
const rpcUrl = process.env.HL_RPC_URL ?? CHAIN_CONFIG[chain].rpc;

const publicClient = createPublicClient({ transport: http(rpcUrl) });

const addressOverrides = {
  identity: process.env.HL_IDENTITY_ADDRESS,
  reputation: process.env.HL_REPUTATION_ADDRESS,
  validation: process.env.HL_VALIDATION_ADDRESS,
};

const overrides = Object.fromEntries(
  Object.entries(addressOverrides).filter(([, v]) => v !== undefined),
);

const readClient = new PelletHlClient({
  publicClient,
  chain,
  ...(Object.keys(overrides).length > 0 ? { addressOverrides: overrides } : {}),
});

let writeClient: PelletHlClient | undefined;
const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (privateKey && privateKey !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  writeClient = new PelletHlClient({
    publicClient,
    walletClient,
    chain,
    ...(Object.keys(overrides).length > 0 ? { addressOverrides: overrides } : {}),
  });
}

function requireWrite(): PelletHlClient {
  if (!writeClient) {
    throw new Error("PRIVATE_KEY env var required for write tools");
  }
  return writeClient;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val));
}

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };

function addTool(
  server: McpServer,
  name: string,
  description: string,
  schema: Record<string, z.ZodTypeAny>,
  handler: (args: Record<string, unknown>) => Promise<ToolResult>,
): void {
  (server.registerTool as any)(name, {
    description,
    inputSchema: schema,
  }, handler);
}

export function registerTools(server: McpServer): void {
  addTool(server, "pellet_read_agent", "Read an agent record from the Identity registry", {
    agentId: z.number().int().positive().describe("Agent ID to query"),
  }, async ({ agentId }) => {
    const agent = await readClient.readAgent(BigInt(agentId as number));
    return { content: [{ type: "text", text: stringify(agent) }] };
  });

  addTool(server, "pellet_read_reputation", "Read attestations for an agent from the Reputation registry", {
    agentId: z.number().int().positive().describe("Agent ID to query"),
  }, async ({ agentId }) => {
    const reps = await readClient.readReputation(BigInt(agentId as number));
    return { content: [{ type: "text", text: stringify(reps) }] };
  });

  addTool(server, "pellet_read_validation", "Read validations for an agent from the Validation registry", {
    agentId: z.number().int().positive().describe("Agent ID to query"),
  }, async ({ agentId }) => {
    const vals = await readClient.readValidation(BigInt(agentId as number));
    return { content: [{ type: "text", text: stringify(vals) }] };
  });

  addTool(server, "pellet_mint_agent_id", "Mint a new agent ID (requires PRIVATE_KEY)", {
    metadataURI: z.string().min(1).describe("Metadata URI for the new agent"),
  }, async ({ metadataURI }) => {
    try {
      const client = requireWrite();
      const result = await client.mintAgentId({ metadataURI: metadataURI as string });
      return { content: [{ type: "text", text: stringify(result) }] };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  addTool(server, "pellet_post_attestation", "Post an attestation (requires PRIVATE_KEY)", {
    agentId: z.number().int().positive().describe("Target agent ID"),
    attestationType: z.string().length(66).describe("32-byte hex attestation type (0x-prefixed)"),
    score: z.number().int().describe("Attestation score"),
    metadataURI: z.string().min(1).describe("Metadata URI for the attestation"),
  }, async (args) => {
    try {
      const client = requireWrite();
      const result = await client.postAttestation({
        agentId: BigInt(args.agentId as number),
        attestationType: args.attestationType as string as `0x${string}`,
        score: BigInt(args.score as number),
        metadataURI: args.metadataURI as string,
      });
      return { content: [{ type: "text", text: stringify(result) }] };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  addTool(server, "pellet_post_validation", "Post a validation (requires PRIVATE_KEY)", {
    agentId: z.number().int().positive().describe("Target agent ID"),
    claimHash: z.string().length(66).describe("32-byte hex claim hash (0x-prefixed)"),
    proofURI: z.string().min(1).describe("URI to validation proof"),
  }, async (args) => {
    try {
      const client = requireWrite();
      const result = await client.postValidation({
        agentId: BigInt(args.agentId as number),
        claimHash: args.claimHash as string as `0x${string}`,
        proofURI: args.proofURI as string,
      });
      return { content: [{ type: "text", text: stringify(result) }] };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });
}
