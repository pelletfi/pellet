/**
 * lib/pipeline/tip403.ts
 *
 * Pre-trade compliance simulation for Tempo TIP-20 stablecoins.
 *
 * Answers "if an agent calls `transfer(to, amount)` on `token` as `from`,
 * would it revert?" — without actually sending a tx.
 *
 * Uses TIP-403's read-only authorization interface:
 *
 *   isAuthorized(uint64 policyId, address user) → bool
 *   policyData(uint64 policyId)                 → (PolicyType, admin)
 *   policyExists(uint64 policyId)               → bool
 *
 * Policy-id semantics per spec (docs.tempo.xyz/protocol/tip403/spec):
 *   0       → always false (nothing authorized; transfer forbidden)
 *   1       → always true (trivial open policy; everyone authorized)
 *   ≥ 2     → WHITELIST (allow-listed users) or BLACKLIST (blocked users)
 *
 * If either party fails authorization, the on-chain transfer would revert
 * with `Unauthorized()`. This module synthesizes that verdict statically.
 */

import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { Abis } from "viem/tempo";
import { isAddress } from "viem";

const { tip20Factory } = Abis;

// TIP-403 read-only ABI fragment. Spec:
//   docs.tempo.xyz/protocol/tip403/spec
const TIP403_READ_ABI = [
  {
    name: "isAuthorized",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "policyId", type: "uint64" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "policyData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint64" }],
    outputs: [
      { name: "policyType", type: "uint8" },
      { name: "admin", type: "address" },
    ],
  },
  {
    name: "policyExists",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint64" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// Policy type enum per spec: 0 = WHITELIST, 1 = BLACKLIST. No compound type.
const POLICY_TYPE_LABELS = ["whitelist", "blacklist"] as const;
type PolicyTypeLabel = (typeof POLICY_TYPE_LABELS)[number] | null;

// ─── Input / Output types ──────────────────────────────────────────────────

export interface SimulateTransferInput {
  from: string;
  to: string;
  token: string;
  /** Optional. If provided, we also check sender balance. Raw uint256 string. */
  amount?: string;
}

export interface SimulateTransferResult {
  /**
   * Would the transfer succeed if called now, based on policy + balance?
   * - `true`  = all checks passed (TIP-403 authorized + balance sufficient)
   * - `false` = blocked by a specific reason (see `blockedBy`)
   * - `null`  = unknown (RPC gaps, partial coverage). Do NOT interpret null as false.
   */
  willSucceed: boolean | null;
  /** TIP-403 policy id attached to this token, or null if not a TIP-20 */
  policyId: number | null;
  /** Resolved policy type: "whitelist" | "blacklist" | "none" (id ≤ 1) | null */
  policyType: PolicyTypeLabel | "none";
  /** Admin address for the policy, if any */
  policyAdmin: string | null;
  sender: {
    address: string;
    authorized: boolean;
  };
  recipient: {
    address: string;
    authorized: boolean;
  };
  /** Balance check. Null if amount wasn't provided. */
  balance: {
    sufficient: boolean;
    has: string;
    needs: string;
  } | null;
  /** Primary reason for blockage, if any */
  blockedBy: "policy" | "balance" | "not_a_tip20" | "invalid_input" | null;
  /** Which party failed, for policy blocks */
  blockedParty: "sender" | "recipient" | null;
  /** Human-readable reason string */
  reason: string;
  /** Block number simulation was executed against */
  simulatedAtBlock: string;
  /** Measurement coverage — OLI discipline */
  coverage: "complete" | "partial";
  coverage_note: string | null;
}

// ─── Simulation ────────────────────────────────────────────────────────────

/**
 * Simulate a TIP-20 transfer against TIP-403 authorization + sender balance.
 * Pure read-only — issues no transactions. Intended to be called by agents
 * before they spend gas on an actual transfer.
 */
export async function simulateTransfer(
  input: SimulateTransferInput
): Promise<SimulateTransferResult> {
  // ── Input validation ───────────────────────────────────────────────────
  if (
    !isAddress(input.from) ||
    !isAddress(input.to) ||
    !isAddress(input.token)
  ) {
    return invalidInput("One or more of from/to/token is not a valid 0x-prefixed address");
  }

  const from = input.from.toLowerCase() as `0x${string}`;
  const to = input.to.toLowerCase() as `0x${string}`;
  const token = input.token.toLowerCase() as `0x${string}`;
  const amount =
    input.amount !== undefined && input.amount !== ""
      ? safeParseBigInt(input.amount)
      : null;

  if (input.amount !== undefined && input.amount !== "" && amount === null) {
    return invalidInput(
      `amount "${input.amount}" is not a valid uint256 decimal string`
    );
  }

  const blockNumber = await tempoClient.getBlockNumber().catch(() => null);
  const simulatedAtBlock = blockNumber !== null ? blockNumber.toString() : "unknown";

  // ── pathUSD carve-out ─────────────────────────────────────────────────
  // pathUSD is Tempo's enshrined quote currency. It has no TIP-403 policy
  // gating — transfers are permissionless by design. The TIP-20 precompile
  // deliberately does not expose a `transferPolicyId` for pathUSD, so the
  // generic flow below would conservatively report "unknown." We know the
  // real answer, so short-circuit.
  if (token === TEMPO_ADDRESSES.pathUsd.toLowerCase()) {
    const senderBalance = amount !== null ? await readBalance(token, from) : null;
    const balanceOk =
      senderBalance === null || amount === null || senderBalance >= amount;
    return {
      willSucceed: balanceOk,
      policyId: null,
      policyType: "none",
      policyAdmin: null,
      sender: { address: from, authorized: true },
      recipient: { address: to, authorized: true },
      balance:
        amount !== null && senderBalance !== null
          ? {
              sufficient: balanceOk,
              has: senderBalance.toString(),
              needs: amount.toString(),
            }
          : null,
      blockedBy: balanceOk ? null : "balance",
      blockedParty: balanceOk ? null : "sender",
      reason: balanceOk
        ? "pathUSD is Tempo's enshrined quote currency and has no TIP-403 policy gating. Transfer authorized."
        : "pathUSD has no TIP-403 policy gating; sender balance is insufficient for the requested amount.",
      simulatedAtBlock,
      coverage: "complete",
      coverage_note: null,
    };
  }

  // ── Classify the token ─────────────────────────────────────────────────
  const isTip20 = await tempoClient
    .readContract({
      address: TEMPO_ADDRESSES.tip20Factory,
      abi: tip20Factory,
      functionName: "isTIP20",
      args: [token],
    })
    .catch(() => false);

  if (!isTip20) {
    // TIP-403 only governs TIP-20 tokens. ERC-20 transfers don't hit TIP-403 at all.
    // We report this honestly rather than faking a pass/fail.
    return {
      willSucceed: true,
      policyId: null,
      policyType: null,
      policyAdmin: null,
      sender: { address: from, authorized: true },
      recipient: { address: to, authorized: true },
      balance: null,
      blockedBy: "not_a_tip20",
      blockedParty: null,
      reason:
        "Token is not a TIP-20 — TIP-403 compliance does not apply. Standard ERC-20 transfer rules apply; this endpoint does not simulate those.",
      simulatedAtBlock,
      coverage: "partial",
      coverage_note:
        "This simulator only covers TIP-20 + TIP-403 semantics. For non-TIP-20 tokens, consult the token's own contract rules.",
    };
  }

  // ── Resolve the token's transferPolicyId ───────────────────────────────
  let policyId: number | null = null;
  try {
    const meta = await tempoClient.token.getMetadata({ token });
    if (meta.transferPolicyId !== null && meta.transferPolicyId !== undefined) {
      policyId = Number(meta.transferPolicyId);
    }
  } catch {
    // Fall through — we'll report coverage:partial if we can't read metadata.
  }

  if (policyId === null) {
    // TIP-20 token, but we couldn't read its transferPolicyId. Do NOT infer
    // denial (that was the 2026-04-16 evening pathUSD bug) — report unknown
    // with an explicit coverage:partial so agents treat this as "retry or
    // fall back to sending and handling revert," not "this transfer is blocked."
    return {
      willSucceed: null,
      policyId: null,
      policyType: null,
      policyAdmin: null,
      sender: { address: from, authorized: false },
      recipient: { address: to, authorized: false },
      balance: null,
      blockedBy: null,
      blockedParty: null,
      reason:
        "TIP-20 precompile did not return a transferPolicyId. Cannot resolve TIP-403 authorization. Agent should retry in a moment, or submit the tx and handle a potential revert.",
      simulatedAtBlock,
      coverage: "partial",
      coverage_note:
        "TIP-20 getMetadata() returned no transferPolicyId for this token. This is rare for policy-gated stablecoins — possibly a transient RPC issue or a token with nonstandard metadata.",
    };
  }

  // ── Handle the two degenerate policy ids per the TIP-403 spec ─────────
  if (policyId === 0) {
    // policyId=0 always denies everyone.
    return {
      willSucceed: false,
      policyId,
      policyType: "none",
      policyAdmin: null,
      sender: { address: from, authorized: false },
      recipient: { address: to, authorized: false },
      balance: null,
      blockedBy: "policy",
      blockedParty: "sender",
      reason:
        "Token is under policy id 0 (closed policy). All transfers are forbidden per TIP-403 spec.",
      simulatedAtBlock,
      coverage: "complete",
      coverage_note: null,
    };
  }

  if (policyId === 1) {
    // policyId=1 always authorizes everyone. Only balance can block.
    const senderBalance = amount !== null ? await readBalance(token, from) : null;
    const balanceOk =
      senderBalance === null || amount === null || senderBalance >= amount;
    return {
      willSucceed: balanceOk,
      policyId,
      policyType: "none",
      policyAdmin: null,
      sender: { address: from, authorized: true },
      recipient: { address: to, authorized: true },
      balance:
        amount !== null && senderBalance !== null
          ? {
              sufficient: balanceOk,
              has: senderBalance.toString(),
              needs: amount.toString(),
            }
          : null,
      blockedBy: balanceOk ? null : "balance",
      blockedParty: balanceOk ? null : "sender",
      reason: balanceOk
        ? "Token is under policy id 1 (open policy). Both parties authorized; sufficient balance."
        : "Token is under policy id 1 (open policy). Both parties authorized, but sender balance is insufficient.",
      simulatedAtBlock,
      coverage: "complete",
      coverage_note: null,
    };
  }

  // ── Policy id ≥ 2: call isAuthorized for both parties in parallel ──────
  const [senderAuth, recipientAuth, polData] = await Promise.all([
    tempoClient
      .readContract({
        address: TEMPO_ADDRESSES.tip403Registry,
        abi: TIP403_READ_ABI,
        functionName: "isAuthorized",
        args: [BigInt(policyId), from],
      })
      .catch(() => null),
    tempoClient
      .readContract({
        address: TEMPO_ADDRESSES.tip403Registry,
        abi: TIP403_READ_ABI,
        functionName: "isAuthorized",
        args: [BigInt(policyId), to],
      })
      .catch(() => null),
    tempoClient
      .readContract({
        address: TEMPO_ADDRESSES.tip403Registry,
        abi: TIP403_READ_ABI,
        functionName: "policyData",
        args: [BigInt(policyId)],
      })
      .catch(() => null),
  ]);

  if (senderAuth === null || recipientAuth === null) {
    // Unknown — NOT false. OLI discipline: don't invent denial from an RPC gap.
    return {
      willSucceed: null,
      policyId,
      policyType: null,
      policyAdmin: null,
      sender: { address: from, authorized: senderAuth ?? false },
      recipient: { address: to, authorized: recipientAuth ?? false },
      balance: null,
      blockedBy: null,
      blockedParty: null,
      reason:
        "TIP-403 registry read failed. Cannot confirm authorization. Agent should retry or fall back to sending the tx and handling revert.",
      simulatedAtBlock,
      coverage: "partial",
      coverage_note:
        "isAuthorized() RPC reads did not resolve. This is typically transient — try again shortly.",
    };
  }

  const policyTypeRaw = polData ? Number(polData[0]) : null;
  const policyType =
    policyTypeRaw !== null && policyTypeRaw < POLICY_TYPE_LABELS.length
      ? POLICY_TYPE_LABELS[policyTypeRaw]
      : null;
  const policyAdmin = polData ? (polData[1] as string) : null;

  // ── Compose the verdict ────────────────────────────────────────────────
  let blockedBy: SimulateTransferResult["blockedBy"] = null;
  let blockedParty: SimulateTransferResult["blockedParty"] = null;

  if (!senderAuth && !recipientAuth) {
    blockedBy = "policy";
    blockedParty = "sender";
  } else if (!senderAuth) {
    blockedBy = "policy";
    blockedParty = "sender";
  } else if (!recipientAuth) {
    blockedBy = "policy";
    blockedParty = "recipient";
  }

  // Only query balance if no policy block and amount was given
  let balanceBlock: SimulateTransferResult["balance"] = null;
  if (blockedBy === null && amount !== null) {
    const senderBalance = await readBalance(token, from);
    if (senderBalance !== null && senderBalance < amount) {
      blockedBy = "balance";
      blockedParty = "sender";
    }
    if (senderBalance !== null) {
      balanceBlock = {
        sufficient: senderBalance >= amount,
        has: senderBalance.toString(),
        needs: amount.toString(),
      };
    }
  }

  const willSucceed = blockedBy === null;

  return {
    willSucceed,
    policyId,
    policyType: policyType ?? "none",
    policyAdmin,
    sender: { address: from, authorized: senderAuth },
    recipient: { address: to, authorized: recipientAuth },
    balance: balanceBlock,
    blockedBy,
    blockedParty,
    reason: composeReason({
      willSucceed,
      policyType,
      blockedBy,
      blockedParty,
      senderAuth,
      recipientAuth,
    }),
    simulatedAtBlock,
    coverage: "complete",
    coverage_note: null,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function invalidInput(message: string): SimulateTransferResult {
  // willSucceed:false here IS correct — we're certain the input is malformed
  // so no matter what the chain says, the agent shouldn't try this transfer.
  return {
    willSucceed: false,
    policyId: null,
    policyType: null,
    policyAdmin: null,
    sender: { address: "0x0", authorized: false },
    recipient: { address: "0x0", authorized: false },
    balance: null,
    blockedBy: "invalid_input",
    blockedParty: null,
    reason: message,
    simulatedAtBlock: "unknown",
    coverage: "partial",
    coverage_note: message,
  };
}

function safeParseBigInt(s: string): bigint | null {
  try {
    if (!/^\d+$/.test(s)) return null;
    return BigInt(s);
  } catch {
    return null;
  }
}

async function readBalance(
  token: `0x${string}`,
  account: `0x${string}`
): Promise<bigint | null> {
  const erc20Abi = [
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ type: "uint256" }],
    },
  ] as const;
  try {
    return await tempoClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    });
  } catch {
    return null;
  }
}

function composeReason(args: {
  willSucceed: boolean;
  policyType: PolicyTypeLabel;
  blockedBy: SimulateTransferResult["blockedBy"];
  blockedParty: SimulateTransferResult["blockedParty"];
  senderAuth: boolean;
  recipientAuth: boolean;
}): string {
  if (args.willSucceed) {
    return `Authorized under TIP-403 ${args.policyType ?? "policy"}. Transfer would succeed.`;
  }
  if (args.blockedBy === "policy") {
    const party = args.blockedParty;
    const typeClause = args.policyType ? ` ${args.policyType}` : "";
    if (party === "sender") {
      return `Sender is not authorized under the token's TIP-403${typeClause} policy. Transfer would revert with Unauthorized().`;
    }
    if (party === "recipient") {
      return `Recipient is not authorized under the token's TIP-403${typeClause} policy. Transfer would revert with Unauthorized().`;
    }
    return `Neither party is authorized under the token's TIP-403${typeClause} policy. Transfer would revert with Unauthorized().`;
  }
  if (args.blockedBy === "balance") {
    return "Sender balance is insufficient for the requested amount. Transfer would revert with InsufficientBalance().";
  }
  return "Transfer would not succeed.";
}
