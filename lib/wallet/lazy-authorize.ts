// Lazy on-chain authorize. When a session is paired but not yet on-chain
// registered, this helper relay-cosigns + broadcasts the user-signed
// authorize tx that was captured at pair-time. Called from bearer-auth
// at first spend, so the user gets a working bearer immediately at signup
// and the chain hop happens only when actually needed.
//
// Pre-2026-05-09 the browser broadcast inline during pairing; that wedged
// signup whenever Tempo's FeeAMM/relay was misbehaving. See drizzle/0017.

import { createPublicClient, decodeEventLog, http, parseAbiItem } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { walletSessions, walletUsers } from "@/lib/db/schema";
import {
  ACCOUNT_KEYCHAIN_ADDRESS,
  tempoChainConfig,
} from "@/lib/wallet/tempo-config";

const MAX_ATTEMPTS = 5;
const BROADCAST_TIMEOUT_MS = 10_000;

export type LazyAuthorizeResult =
  | { ok: true; txHash: `0x${string}`; alreadyConfirmed: boolean }
  | { ok: false; status: number; error: string; detail?: string };

/**
 * Ensure the session has been registered on-chain. If already confirmed,
 * returns immediately. Otherwise relay-cosigns + broadcasts the captured
 * authorize tx, verifies the KeyAuthorized event, and persists the result.
 *
 * Idempotent — safe to call concurrently per session (one wins, the other
 * sees `state='confirmed'` on its read and short-circuits).
 */
export async function ensureOnChainAuthorized(
  sessionId: string,
): Promise<LazyAuthorizeResult> {
  const rows = await db
    .select()
    .from(walletSessions)
    .where(eq(walletSessions.id, sessionId))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return { ok: false, status: 404, error: "session not found" };
  }

  if (session.authorizeTxHash && session.onChainAuthorizedAt) {
    return {
      ok: true,
      txHash: session.authorizeTxHash as `0x${string}`,
      alreadyConfirmed: true,
    };
  }

  if (session.authorizeState === "confirmed" && session.authorizeTxHash) {
    return {
      ok: true,
      txHash: session.authorizeTxHash as `0x${string}`,
      alreadyConfirmed: true,
    };
  }

  if (!session.authorizeTxSigned) {
    return {
      ok: false,
      status: 403,
      error: "session has no captured authorize tx",
      detail: "re-pair via /wallet/device",
    };
  }

  if (
    session.authorizeValidBefore &&
    session.authorizeValidBefore.getTime() < Date.now()
  ) {
    await db
      .update(walletSessions)
      .set({ authorizeState: "expired" })
      .where(eq(walletSessions.id, sessionId));
    return {
      ok: false,
      status: 403,
      error: "authorize signature expired",
      detail: "re-pair to refresh your passkey signature",
    };
  }

  if ((session.authorizeAttempts ?? 0) >= MAX_ATTEMPTS) {
    return {
      ok: false,
      status: 503,
      error: "authorize broadcast keeps failing",
      detail: session.authorizeLastError ?? "max attempts reached",
    };
  }

  // Mark broadcasting + bump attempt counter atomically.
  await db
    .update(walletSessions)
    .set({
      authorizeState: "broadcasting",
      authorizeAttempts: (session.authorizeAttempts ?? 0) + 1,
    })
    .where(eq(walletSessions.id, sessionId));

  const userRows = await db
    .select({ managedAddress: walletUsers.managedAddress })
    .from(walletUsers)
    .where(eq(walletUsers.id, session.userId))
    .limit(1);
  const expectedSender = userRows[0]?.managedAddress?.toLowerCase();
  if (!expectedSender) {
    return {
      ok: false,
      status: 500,
      error: "user has no managed address",
    };
  }

  const chain = tempoChainConfig();
  const userSignedTx = session.authorizeTxSigned as `0x${string}`;

  // Relay co-signs (eth_signRawTransaction). Skipped if no sponsor configured —
  // tx will fail at broadcast since feePayer:true requires a co-signature, but
  // that surfaces as a clear RPC error rather than a silent missing co-sign.
  let relayCosignedTx: `0x${string}` = userSignedTx;
  if (chain.sponsorUrl) {
    try {
      const cosigned = await rpcCall(chain.sponsorUrl, "eth_signRawTransaction", [
        userSignedTx,
      ]);
      if (typeof cosigned !== "string" || !cosigned.startsWith("0x")) {
        throw new Error(`relay returned non-hex: ${JSON.stringify(cosigned).slice(0, 200)}`);
      }
      relayCosignedTx = cosigned as `0x${string}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await persistFailure(sessionId, `relay cosign: ${msg}`);
      return {
        ok: false,
        status: 503,
        error: "relay co-sign failed",
        detail: msg,
      };
    }
  }

  // Broadcast.
  let txHash: `0x${string}`;
  try {
    const result = await rpcCall(chain.rpcUrl, "eth_sendRawTransactionSync", [
      relayCosignedTx,
    ]);
    if (result && typeof result === "object" && "transactionHash" in result) {
      txHash = (result as { transactionHash: `0x${string}` }).transactionHash;
    } else if (typeof result === "string" && result.startsWith("0x")) {
      txHash = result as `0x${string}`;
    } else {
      throw new Error(
        `unexpected sendRawTransactionSync result: ${JSON.stringify(result).slice(0, 200)}`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await persistFailure(sessionId, `broadcast: ${msg}`);
    return {
      ok: false,
      status: 503,
      error: "authorize broadcast failed",
      detail: msg,
    };
  }

  // Verify the receipt and KeyAuthorized event match the user.
  const viemChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  });
  let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>> | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      break;
    } catch {
      await sleep(800);
    }
  }
  if (!receipt) {
    await persistFailure(sessionId, `tx ${txHash} not found after 5 polls`);
    return {
      ok: false,
      status: 504,
      error: "broadcast tx not visible on chain",
      detail: txHash,
    };
  }
  if (receipt.status !== "success") {
    await persistFailure(sessionId, `tx reverted: ${txHash}`);
    return {
      ok: false,
      status: 400,
      error: "authorize tx reverted on-chain",
      detail: txHash,
    };
  }

  const keyAuthorizedEvent = parseAbiItem(
    "event KeyAuthorized(address indexed account, address indexed publicKey, uint8 signatureType, uint64 expiry)",
  );
  let authorizedAccount: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ACCOUNT_KEYCHAIN_ADDRESS.toLowerCase()) continue;
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
  if (!authorizedAccount || authorizedAccount !== expectedSender) {
    await persistFailure(
      sessionId,
      `KeyAuthorized mismatch: authorized=${authorizedAccount}, expected=${expectedSender}`,
    );
    return {
      ok: false,
      status: 400,
      error: "authorize tx didn't authorize the expected user",
    };
  }

  await db
    .update(walletSessions)
    .set({
      authorizeTxHash: txHash,
      authorizeState: "confirmed",
      authorizeLastError: null,
      onChainAuthorizedAt: new Date(),
    })
    .where(eq(walletSessions.id, sessionId));

  return { ok: true, txHash, alreadyConfirmed: false };
}

async function rpcCall(
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), BROADCAST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as { result?: unknown; error?: { message?: string; data?: unknown } };
    if (json.error) {
      const detail = json.error.data
        ? ` (${JSON.stringify(json.error.data).slice(0, 300)})`
        : "";
      throw new Error(`${json.error.message ?? "rpc error"}${detail}`);
    }
    return json.result;
  } finally {
    clearTimeout(t);
  }
}

async function persistFailure(sessionId: string, detail: string): Promise<void> {
  const truncated = detail.slice(0, 1000);
  const rows = await db
    .select({ attempts: walletSessions.authorizeAttempts })
    .from(walletSessions)
    .where(eq(walletSessions.id, sessionId))
    .limit(1);
  const attempts = rows[0]?.attempts ?? 0;
  await db
    .update(walletSessions)
    .set({
      authorizeState: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      authorizeLastError: truncated,
    })
    .where(eq(walletSessions.id, sessionId));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
