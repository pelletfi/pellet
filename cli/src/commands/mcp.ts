// Pellet Wallet MCP server. Wraps the existing CLI commands as MCP tools
// so any agent runtime (Claude Code, Cursor, Cloudflare Agents, the
// Anthropic API directly) can install Pellet with one config line and
// call the wallet from inside the agent loop.
//
// Tools exposed:
//   pellet_status — read the local session: caps, expiry, label
//   pellet_pay    — sign + submit a transferWithMemo on Tempo using the
//                   user's on-chain-authorized agent key
//
// Pairing (auth_start) is intentionally NOT exposed via MCP — it requires
// a browser passkey ceremony, which the agent can't drive. Users run
// `pellet auth start` directly once during install. The MCP layer is
// purely for spending the already-authorized session.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { defaultBaseUrl, readSession } from "../config.js";

const PAY_TOOL = {
  name: "pellet_pay",
  description:
    "Sign and broadcast a USDC payment on Tempo using the authenticated " +
    "Pellet Wallet session. The agent key is bounded by the user's " +
    "on-chain spending caps (per-call + lifetime, both enforced by Tempo " +
    "at execution). Returns the transaction hash and a public block-explorer " +
    "URL — every Pellet payment is a public on-chain receipt. Use this when " +
    "the user asks the agent to pay for something on Tempo, or when an " +
    "x402 challenge needs to be settled with a TIP-20 transferWithMemo.",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Recipient address (0x + 40 hex chars).",
      },
      amount_usdc: {
        type: "number",
        description:
          "Amount to send, in USDC display units (e.g. 0.50 = 50 cents). " +
          "Mutually exclusive with amount_wei.",
      },
      amount_wei: {
        type: "string",
        description:
          "Raw uint256 amount in 6-decimal wei (e.g. '500000' = $0.50). " +
          "Use this when matching an exact 402 challenge amount.",
      },
      memo: {
        type: "string",
        description:
          "Optional memo. If 0x + 64 hex chars, used as the bytes32 memo " +
          "verbatim. If any other string, hashed via keccak256 to bytes32. " +
          "If omitted, memo is bytes32(0). For x402 settlement, pass the " +
          "challenge id here.",
      },
      token: {
        type: "string",
        description:
          "Optional TIP-20 token address to pay in. Defaults to the chain's " +
          "USDC.e. Must be in the wallet's on-chain authorized scope.",
      },
    },
    required: ["to"],
    additionalProperties: false,
  },
};

const STATUS_TOOL = {
  name: "pellet_status",
  description:
    "Read the local Pellet Wallet session: spend cap, per-call cap, " +
    "expiry, and whether a session exists at all. Use this to confirm the " +
    "wallet is paired before attempting a payment, or to surface remaining " +
    "spending power to the user.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

type PayInput = {
  to?: string;
  amount_usdc?: number;
  amount_wei?: string;
  memo?: string;
  token?: string;
};

type PayResult = {
  ok: boolean;
  tx_hash?: string;
  explorer_url?: string;
  from?: string;
  to?: string;
  amount_wei?: string;
  memo?: string;
  spend_used_wei_after?: string;
  spend_cap_wei?: string;
  error?: string;
  detail?: string;
};

export async function runMcpServer(): Promise<number> {
  const server = new Server(
    { name: "pellet-wallet", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [STATUS_TOOL, PAY_TOOL],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params;

    if (name === "pellet_status") {
      const session = await readSession();
      if (!session) {
        return {
          content: [
            {
              type: "text",
              text:
                "No active Pellet Wallet session. Run `pellet auth start` " +
                "in a terminal to pair, then retry.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                label: session.label,
                spend_cap_usdc: Number(session.spendCapWei) / 1_000_000,
                per_call_cap_usdc: Number(session.perCallCapWei) / 1_000_000,
                expires_at: session.expiresAt,
                paired_at: session.pairedAt,
                base_url: session.baseUrl,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === "pellet_pay") {
      const args = (rawArgs ?? {}) as PayInput;
      if (!args.to) {
        return {
          isError: true,
          content: [{ type: "text", text: "missing required argument: to" }],
        };
      }
      if (typeof args.amount_usdc !== "number" && !args.amount_wei) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "must provide amount_usdc (number) or amount_wei (string)",
            },
          ],
        };
      }

      const session = await readSession();
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "no Pellet Wallet session — user must run `pellet auth start` to pair",
            },
          ],
        };
      }

      const amountWei = args.amount_wei
        ? args.amount_wei
        : String(BigInt(Math.round((args.amount_usdc as number) * 1_000_000)));

      const baseUrl =
        process.env.PELLET_BASE_URL ?? session.baseUrl ?? defaultBaseUrl();

      const result = await postWithAuth(
        `${baseUrl}/api/wallet/pay`,
        session.bearer,
        {
          to: args.to,
          amount_wei: amountWei,
          memo: args.memo ?? null,
          token: args.token,
        },
      );

      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `payment failed: ${result.error ?? "unknown"}${
                result.detail ? `\n${result.detail}` : ""
              }`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                tx_hash: result.tx_hash,
                explorer_url: result.explorer_url,
                from: result.from,
                to: result.to,
                amount_usdc: Number(result.amount_wei) / 1_000_000,
                memo: result.memo,
                spend_used_usdc: Number(result.spend_used_wei_after) / 1_000_000,
                spend_cap_usdc: Number(result.spend_cap_wei) / 1_000_000,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `unknown tool: ${name}` }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The transport's connect resolves when the stdio loop ends (parent process
  // closes pipes). Until then, the process keeps running.
  return 0;
}

async function postWithAuth(
  url: string,
  bearer: string,
  body: unknown,
): Promise<PayResult> {
  let target = url;
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${bearer}`,
  };
  const serialized = JSON.stringify(body);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(target, {
      method: "POST",
      headers,
      body: serialized,
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return { ok: false, error: `redirect ${res.status} with no Location` };
      }
      target = new URL(loc, target).toString();
      continue;
    }
    const data = (await res.json()) as PayResult;
    return data;
  }
  return { ok: false, error: "too many redirects" };
}
