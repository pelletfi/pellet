import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletSessions, walletUsers } from "@/lib/db/schema";
import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import { eq } from "drizzle-orm";
import {
  createWalletClient,
  http,
  encodeFunctionData,
  parseAbi,
  isAddress,
  isHex,
  keccak256,
  stringToHex,
  pad,
} from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, withRelay, tempoActions } from "viem/tempo";
import { privateKeyToAddress } from "viem/accounts";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Phase 4 — agent payment endpoint. CLI sends a parsed payment intent
// with the session's bearer; we validate caps + sign + broadcast a
// transferWithMemo TempoTransaction signed by the agent's session key
// (which has on-chain spending authority via Phase 3's AccountKeychain
// authorize). Sponsored gas via withRelay.

type PayBody = {
  to: `0x${string}`;
  amount_wei: string;
  /** 32-byte hex memo, or null/missing → we hash a string for you */
  memo?: string | null;
  /** optional: token address to pay in. defaults to chain's USDC.e */
  token?: `0x${string}`;
};

const TIP20_ABI = parseAbi([
  "function transferWithMemo(address to, uint256 amount, bytes32 memo)",
]);

function bearerFromHeader(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer (.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  // 1. Bearer auth.
  const bearer = bearerFromHeader(req);
  if (!bearer) {
    return NextResponse.json(
      { error: "missing bearer token", detail: "Authorization: Bearer <token>" },
      { status: 401 },
    );
  }
  const bearerHash = sha256Hex(bearer);
  const rows = await db
    .select()
    .from(walletSessions)
    .where(eq(walletSessions.bearerTokenHash, bearerHash))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return NextResponse.json({ error: "invalid bearer" }, { status: 401 });
  }
  if (session.revokedAt) {
    return NextResponse.json({ error: "session revoked" }, { status: 403 });
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "session expired" }, { status: 403 });
  }
  if (!session.authorizeTxHash) {
    return NextResponse.json(
      { error: "session not yet on-chain authorized" },
      { status: 403 },
    );
  }
  if (!session.sessionKeyCiphertext) {
    return NextResponse.json(
      { error: "session has no agent key (corrupt state)" },
      { status: 500 },
    );
  }

  // 2. Body validation.
  let body: PayBody;
  try {
    body = (await req.json()) as PayBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.to || !isAddress(body.to)) {
    return NextResponse.json({ error: "to must be a hex address" }, { status: 400 });
  }
  if (!body.amount_wei) {
    return NextResponse.json({ error: "amount_wei required" }, { status: 400 });
  }
  let amountWei: bigint;
  try {
    amountWei = BigInt(body.amount_wei);
    if (amountWei <= BigInt(0)) throw new Error("must be positive");
  } catch {
    return NextResponse.json(
      { error: "amount_wei must be a positive integer string" },
      { status: 400 },
    );
  }

  // 3. Cap validation. The chain enforces these too via AccountKeychain,
  // but we fail fast server-side so we don't even waste the on-chain
  // call when the cap is already known to be over.
  const perCallCap = BigInt(session.perCallCapWei);
  const lifetimeCap = BigInt(session.spendCapWei);
  const lifetimeUsed = BigInt(session.spendUsedWei);
  if (amountWei > perCallCap) {
    return NextResponse.json(
      {
        error: "per-call cap exceeded",
        detail: `requested=${amountWei}, cap=${perCallCap}`,
      },
      { status: 403 },
    );
  }
  if (lifetimeUsed + amountWei > lifetimeCap) {
    return NextResponse.json(
      {
        error: "lifetime cap exceeded",
        detail: `requested=${amountWei}, used=${lifetimeUsed}, cap=${lifetimeCap}`,
      },
      { status: 403 },
    );
  }

  // 4. Build memo. If user supplied a 32-byte hex memo, use it; else
  // hash whatever string they sent; else default to all zeros.
  let memo: `0x${string}`;
  if (body.memo && isHex(body.memo) && body.memo.length === 66) {
    memo = body.memo as `0x${string}`;
  } else if (body.memo) {
    memo = keccak256(stringToHex(body.memo));
  } else {
    memo = pad("0x00", { size: 32 });
  }

  // 5. Decrypt agent session key + look up user's managed address.
  const userRows = await db
    .select({
      managedAddress: walletUsers.managedAddress,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
    })
    .from(walletUsers)
    .where(eq(walletUsers.id, session.userId))
    .limit(1);
  const user = userRows[0];
  if (!user || !user.publicKeyUncompressed) {
    return NextResponse.json(
      { error: "wallet user missing on-chain identity" },
      { status: 500 },
    );
  }

  const agentPk = decryptSessionKey(Buffer.from(session.sessionKeyCiphertext));
  const agentAddress = privateKeyToAddress(agentPk);

  // 6. Build the access-key Account + a viem client wired to the user's
  // account, sponsor relay, chain.feeToken set so the chainConfig's
  // prepareTransactionRequest knows what to fill.
  const chain = tempoChainConfig();
  const viemBaseChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const viemChain = { ...viemBaseChain, feeToken: chain.usdcE };
  const token = body.token ?? chain.usdcE;

  // Reconstruct the user's WebAuthn account purely as an identity wrapper —
  // we don't sign with it. The agent's access key is what signs.
  const userAccount = Account.fromWebAuthnP256(
    {
      id: "noop", // not used for signing; just identity
      publicKey: user.publicKeyUncompressed as `0x${string}`,
    },
    { rpId: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network" },
  );
  const accessKey = Account.fromSecp256k1(agentPk, { access: userAccount });

  if (!chain.sponsorUrl) {
    return NextResponse.json(
      { error: "no sponsor configured for this chain" },
      { status: 500 },
    );
  }

  const client = createWalletClient({
    account: accessKey,
    chain: viemChain,
    transport: withRelay(http(chain.rpcUrl), http(chain.sponsorUrl), {
      policy: "sign-only",
    }),
  }).extend(tempoActions());

  // 6b. On-chain key check. Defends against an AccountKeychain.revokeKey we
  // missed server-side, or against on-chain expiry that came earlier than the
  // session's expires_at (e.g. on-chain authorize used a shorter expiry).
  // Eats one extra RPC roundtrip per pay; cheap insurance.
  try {
    const meta = await client.accessKey.getMetadata({
      account: user.managedAddress as `0x${string}`,
      accessKey: agentAddress,
    });
    if (meta.isRevoked) {
      // Mirror server-side state so future calls fail fast without the RPC.
      await db
        .update(walletSessions)
        .set({ revokedAt: new Date() })
        .where(eq(walletSessions.id, session.id));
      return NextResponse.json(
        { error: "access key revoked on-chain" },
        { status: 403 },
      );
    }
    // expiry is a unix-seconds bigint per AccountKeychain. 0 = no expiry.
    if (meta.expiry > BigInt(0) && meta.expiry * BigInt(1000) < BigInt(Date.now())) {
      return NextResponse.json(
        { error: "access key expired on-chain" },
        { status: 403 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "on-chain access key not found",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 403 },
    );
  }

  // 7. Sign + send. transferWithMemo on the chosen TIP-20.
  let txHash: `0x${string}`;
  try {
    txHash = await client.writeContract({
      address: token,
      abi: TIP20_ABI,
      functionName: "transferWithMemo",
      args: [body.to, amountWei, memo],
      // Sponsor pays gas. The agent's access key is the sender.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      feePayer: true,
      gas: BigInt(800_000),
    } as never);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[wallet/pay] sign+send failed:", detail);
    return NextResponse.json({ error: "on-chain payment failed", detail }, { status: 500 });
  }

  // 8. Persist usage. (The chain enforces caps too; this is for fast
  // server-side lookups + audit.)
  await db
    .update(walletSessions)
    .set({ spendUsedWei: (lifetimeUsed + amountWei).toString() })
    .where(eq(walletSessions.id, session.id));

  return NextResponse.json({
    ok: true,
    tx_hash: txHash,
    explorer_url: `${chain.explorerUrl}/tx/${txHash}`,
    from: agentAddress,
    to: body.to,
    amount_wei: amountWei.toString(),
    memo,
    token,
    spend_used_wei_after: (lifetimeUsed + amountWei).toString(),
    spend_cap_wei: session.spendCapWei,
  });
}
