import { db } from "@/lib/db/client";
import { walletSessions, walletSpendLog } from "@/lib/db/schema";
import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { tempoChainConfig, platformFeeConfig, computeFee } from "@/lib/wallet/tempo-config";
import { resolveFeeBps } from "@/lib/wallet/subscriptions";
import { eq, sql } from "drizzle-orm";
import {
  fillTransaction,
  sendRawTransaction,
} from "viem/actions";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeFunctionData,
  isHex,
  keccak256,
  stringToHex,
  pad,
} from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, tempoActions, withRelay } from "viem/tempo";
import { privateKeyToAddress } from "viem/accounts";

type WalletSessionRow = typeof walletSessions.$inferSelect;

export type PaymentUser = {
  id: string;
  managedAddress: string;
  publicKeyUncompressed: string;
};

export type PaymentInput = {
  session: WalletSessionRow;
  user: PaymentUser;
  to: `0x${string}`;
  amountWei: bigint;
  memo: string | null;
  token?: `0x${string}`;
};

export type PaymentSuccess = {
  ok: true;
  txHash: `0x${string}`;
  explorerUrl: string;
  from: `0x${string}`;
  to: `0x${string}`;
  amountWei: string;
  memo: `0x${string}`;
  token: `0x${string}`;
  feeWei: string;
  feeTxHash: `0x${string}` | null;
  spendUsedWeiAfter: string;
  spendCapWei: string;
  remainingWei: string;
  periodEnd: string | null;
};

export type PaymentError = {
  ok: false;
  error: string;
  detail?: string;
  action?: string;
  status: number;
};

export type PaymentResult = PaymentSuccess | PaymentError;

const TIP20_ABI = parseAbi([
  "function transferWithMemo(address to, uint256 amount, bytes32 memo)",
]);

async function sendSponsoredTx(
  client: any,
  account: any,
  tx: { to: `0x${string}`; data: `0x${string}` },
): Promise<`0x${string}`> {
  // 1. Fill via relay — sets fee payer address/nonce but does NOT co-sign yet.
  const filled = await fillTransaction(client, {
    account,
    ...tx,
    feePayer: true,
    gas: BigInt(800_000),
  } as any);
  // 2. Sign WITH feePayer:true — produces 0x78 "awaiting co-sign" format
  //    (feePayerSignature === null). The default Tempo serializer handles
  //    this; do NOT override with client.chain.serializers.transaction.
  const signed = await account.signTransaction({
    ...filled.transaction,
    feePayer: true,
  } as any);
  // 3. Send — transport sees 0x78 → relay co-signs → 0x76 → broadcast.
  return sendRawTransaction(client, { serializedTransaction: signed });
}

export async function executePayment(input: PaymentInput): Promise<PaymentResult> {
  const { session, user, to, amountWei, token: tokenOverride } = input;

  if (!session.sessionKeyCiphertext) {
    return { ok: false, error: "session has no agent key (corrupt state)", status: 500 };
  }
  if (!session.authorizeTxHash) {
    return { ok: false, error: "session not yet on-chain authorized", status: 403 };
  }
  if (session.revokedAt) {
    return { ok: false, error: "session revoked", status: 403 };
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "session expired", status: 403 };
  }
  if (amountWei <= BigInt(0)) {
    return { ok: false, error: "amount must be positive", status: 400 };
  }

  // Per-call cap is a server-side convenience check — no RPC needed.
  const perCallCap = BigInt(session.perCallCapWei);
  if (amountWei > perCallCap) {
    return {
      ok: false,
      error: "per-call cap exceeded",
      detail: `requested=${amountWei}, cap=${perCallCap}`,
      status: 403,
    };
  }

  let memo: `0x${string}`;
  if (input.memo && isHex(input.memo) && input.memo.length === 66) {
    memo = input.memo as `0x${string}`;
  } else if (input.memo) {
    memo = keccak256(stringToHex(input.memo));
  } else {
    memo = pad("0x00", { size: 32 });
  }

  let agentPk: `0x${string}`;
  try {
    agentPk = decryptSessionKey(Buffer.from(session.sessionKeyCiphertext));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: "session key undecryptable — WALLET_MASTER_KEY may have changed",
      detail,
      action: "revoke this session and re-pair (`pellet auth start`)",
      status: 500,
    };
  }
  const agentAddress = privateKeyToAddress(agentPk);

  const chain = tempoChainConfig();
  const viemBaseChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const viemChain = { ...viemBaseChain, feeToken: chain.usdcE };
  const token = tokenOverride ?? chain.usdcE;

  const userAccount = Account.fromWebAuthnP256(
    {
      id: "noop",
      publicKey: user.publicKeyUncompressed as `0x${string}`,
    },
    { rpId: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network" },
  );
  const accessKey = Account.fromSecp256k1(agentPk, { access: userAccount });

  // Separate read client — the walletClient's Tempo formatters add account
  // context to eth_call that the AccountKeychain precompile rejects.
  const readClient = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  }).extend(tempoActions());

  const transport = chain.sponsorUrl
    ? withRelay(http(chain.rpcUrl), http(chain.sponsorUrl))
    : http(chain.rpcUrl);

  const client = createWalletClient({
    account: accessKey,
    chain: viemChain,
    transport,
  }).extend(tempoActions());

  // On-chain checks: key status + period-aware remaining limit in parallel.
  let remaining: bigint;
  let periodEnd: bigint | undefined;
  try {
    const accountAddr = user.managedAddress as `0x${string}`;
    const [meta, limitInfo] = await Promise.all([
      readClient.accessKey.getMetadata({ account: accountAddr, accessKey: agentAddress }),
      readClient.accessKey.getRemainingLimit({
        account: accountAddr,
        accessKey: agentAddress,
        token,
      }),
    ]);

    if (meta.isRevoked) {
      await db
        .update(walletSessions)
        .set({ revokedAt: new Date() })
        .where(eq(walletSessions.id, session.id));
      return { ok: false, error: "access key revoked on-chain", status: 403 };
    }
    if (meta.expiry > BigInt(0) && meta.expiry * BigInt(1000) < BigInt(Date.now())) {
      return { ok: false, error: "access key expired on-chain", status: 403 };
    }

    remaining = limitInfo.remaining;
    periodEnd = limitInfo.periodEnd;

    if (remaining < amountWei) {
      return {
        ok: false,
        error: "period cap exceeded",
        detail: `requested=${amountWei}, remaining=${remaining}`,
        status: 403,
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: "on-chain access key not found",
      detail: e instanceof Error ? e.message : String(e),
      status: 403,
    };
  }

  const feeConfig = platformFeeConfig();
  let feeWei = BigInt(0);
  let recipientWei = amountWei;
  if (feeConfig.enabled) {
    const bps = await resolveFeeBps(session.userId);
    if (bps > 0) {
      const split = computeFee(amountWei, bps);
      feeWei = split.fee;
      recipientWei = split.remainder;
    }
  }

  const challengeId = input.memo ? input.memo.toLowerCase() : null;
  const [pendingLog] = await db
    .insert(walletSpendLog)
    .values({
      sessionId: session.id,
      userId: session.userId,
      challengeId,
      recipient: to,
      amountWei: amountWei.toString(),
      feeWei: feeWei.toString(),
      status: "pending",
    })
    .returning({ id: walletSpendLog.id });

  let feeTxHash: `0x${string}` | null = null;
  if (feeConfig.enabled && feeWei > BigInt(0)) {
    try {
      feeTxHash = await sendSponsoredTx(client, accessKey, {
        to: token,
        data: encodeFunctionData({
          abi: TIP20_ABI,
          functionName: "transferWithMemo",
          args: [feeConfig.treasury, feeWei, pad("0x00", { size: 32 })],
        }),
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[wallet/pay] fee transfer failed:", detail);
      await db
        .update(walletSpendLog)
        .set({ status: "failed", reason: `fee transfer: ${detail}`.slice(0, 500), updatedAt: new Date() })
        .where(eq(walletSpendLog.id, pendingLog.id));
      return { ok: false, error: "fee transfer failed", detail, status: 500 };
    }
  }

  let txHash: `0x${string}`;
  try {
    txHash = await sendSponsoredTx(client, accessKey, {
      to: token,
      data: encodeFunctionData({
        abi: TIP20_ABI,
        functionName: "transferWithMemo",
        args: [to, recipientWei, memo],
      }),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[wallet/pay] sign+send failed:", detail);
    await db
      .update(walletSpendLog)
      .set({ status: "failed", reason: detail.slice(0, 500), feeTxHash, updatedAt: new Date() })
      .where(eq(walletSpendLog.id, pendingLog.id));
    return { ok: false, error: "on-chain payment failed", detail, status: 500 };
  }

  const newSpendUsedWei = await db.transaction(async (tx) => {
    await tx
      .update(walletSpendLog)
      .set({ status: "submitted", txHash, feeTxHash, updatedAt: new Date() })
      .where(eq(walletSpendLog.id, pendingLog.id));
    const updated = await tx
      .update(walletSessions)
      .set({
        spendUsedWei: sql`(${walletSessions.spendUsedWei}::numeric + ${amountWei.toString()}::numeric)::text`,
      })
      .where(eq(walletSessions.id, session.id))
      .returning({ spendUsedWei: walletSessions.spendUsedWei });
    return updated[0]?.spendUsedWei ?? "0";
  });

  const postPaymentRemaining = remaining - amountWei;

  return {
    ok: true,
    txHash,
    explorerUrl: `${chain.explorerUrl}/tx/${txHash}`,
    from: agentAddress,
    to,
    amountWei: amountWei.toString(),
    memo,
    token,
    feeWei: feeWei.toString(),
    feeTxHash,
    spendUsedWeiAfter: newSpendUsedWei,
    spendCapWei: session.spendCapWei,
    remainingWei: postPaymentRemaining.toString(),
    periodEnd: periodEnd != null ? periodEnd.toString() : null,
  };
}
