import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  walletSessions,
  walletUsers,
  oauthAccessTokens,
  walletAgentConnections,
} from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import {
  ACCOUNT_KEYCHAIN_ADDRESS,
  tempoChainConfig,
} from "@/lib/wallet/tempo-config";
import { createPublicClient, decodeEventLog, http, parseAbiItem } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { eq, and, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinalizeBody = {
  session_id: string;
  tx_hash: string;
  client_id?: string;
};

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.session_id || !body.tx_hash) {
    return NextResponse.json(
      { error: "missing session_id or tx_hash" },
      { status: 400 },
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(body.tx_hash)) {
    return NextResponse.json(
      { error: "tx_hash must be 0x + 64 hex" },
      { status: 400 },
    );
  }

  const sessionRows = await db
    .select()
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.id, body.session_id),
        eq(walletSessions.userId, userId),
      ),
    )
    .limit(1);
  const session = sessionRows[0];
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.authorizeTxHash) {
    return NextResponse.json(
      { error: "session already authorized" },
      { status: 409 },
    );
  }

  const userRows = await db
    .select({ managedAddress: walletUsers.managedAddress })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const expectedSender = userRows[0]?.managedAddress?.toLowerCase();
  if (!expectedSender) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const chain = tempoChainConfig();
  const viemChain =
    chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  });

  let receipt: Awaited<
    ReturnType<typeof publicClient.getTransactionReceipt>
  > | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      receipt = await publicClient.getTransactionReceipt({
        hash: body.tx_hash as `0x${string}`,
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!receipt) {
    return NextResponse.json(
      { error: "tx not found after 5 polls" },
      { status: 404 },
    );
  }
  if (receipt.status !== "success") {
    return NextResponse.json(
      { error: `tx reverted (status=${receipt.status})` },
      { status: 400 },
    );
  }

  const keyAuthorizedEvent = parseAbiItem(
    "event KeyAuthorized(address indexed account, address indexed publicKey, uint8 signatureType, uint64 expiry)",
  );
  let authorizedAccount: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ACCOUNT_KEYCHAIN_ADDRESS.toLowerCase())
      continue;
    try {
      const decoded = decodeEventLog({
        abi: [keyAuthorizedEvent],
        topics: log.topics,
        data: log.data,
      });
      if (decoded.eventName === "KeyAuthorized") {
        authorizedAccount = decoded.args.account.toLowerCase();
        break;
      }
    } catch {
      // not a KeyAuthorized log
    }
  }
  if (!authorizedAccount) {
    return NextResponse.json(
      { error: "no KeyAuthorized event in tx" },
      { status: 400 },
    );
  }
  if (authorizedAccount !== expectedSender) {
    return NextResponse.json(
      {
        error: "authorized account doesn't match user",
        detail: `authorized=${authorizedAccount}, expected=${expectedSender}`,
      },
      { status: 400 },
    );
  }

  await db
    .update(walletSessions)
    .set({
      authorizeTxHash: body.tx_hash,
      onChainAuthorizedAt: new Date(),
    })
    .where(eq(walletSessions.id, body.session_id));

  if (body.client_id) {
    await db
      .update(oauthAccessTokens)
      .set({ sessionId: body.session_id })
      .where(
        and(
          eq(oauthAccessTokens.clientId, body.client_id),
          eq(oauthAccessTokens.userId, userId),
          isNull(oauthAccessTokens.revokedAt),
        ),
      );

    await db
      .update(walletAgentConnections)
      .set({ lastSessionId: body.session_id, updatedAt: new Date() })
      .where(
        and(
          eq(walletAgentConnections.clientId, body.client_id),
          eq(walletAgentConnections.userId, userId),
        ),
      );
  }

  return NextResponse.json({
    ok: true,
    block_number: receipt.blockNumber.toString(),
  });
}
