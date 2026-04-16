import { Abis } from "viem/tempo";
import { tempoClient } from "@/lib/rpc";
import type {
  SafetyResult,
  PoolData,
  ComplianceResult,
  HolderData,
} from "@/lib/types";

// ─── Opcode / selector constants ───────────────────────────────────────────

const EIP1967_PROXY_SLOT =
  "360894a13ba1a3210667c828492db98dca3e2076";
const OPCODE_SELFDESTRUCT = "ff";
const OPCODE_DELEGATECALL = "f4";

// Blacklist function selectors
const BLACKLIST_SELECTORS = ["06f13056", "44337ea1", "e47d6060"];
// Mint function selectors
const MINT_SELECTORS = ["40c10f19", "a0712d68", "4e6ec247"];
// Pause function selectors
const PAUSE_SELECTORS = ["8456cb59", "02329a29"];
// transferOwnership selector
const TRANSFER_OWNERSHIP_SELECTOR = "f2fde38b";

// TIP-20 precompile sentinel: 1-byte code 0xef
const TIP20_PRECOMPILE_CODE = "0xef";

// ─── Bytecode pattern result ────────────────────────────────────────────────

interface BytecodePatterns {
  is_proxy: boolean;
  has_selfdestruct: boolean;
  has_delegatecall: boolean;
  has_blacklist: boolean;
  has_hidden_mint: boolean;
  has_pause: boolean;
  has_transfer_ownership: boolean;
  skipped: boolean; // true if precompile (1-byte 0xef)
}

/**
 * Read bytecode for an ERC-20 contract and detect dangerous patterns.
 * TIP-20 precompiles have 1-byte code `0xef` — we skip analysis for them.
 */
export async function checkBytecodePatterns(
  address: string
): Promise<BytecodePatterns> {
  const empty: BytecodePatterns = {
    is_proxy: false,
    has_selfdestruct: false,
    has_delegatecall: false,
    has_blacklist: false,
    has_hidden_mint: false,
    has_pause: false,
    has_transfer_ownership: false,
    skipped: false,
  };

  let code: string;
  try {
    code = await tempoClient.getCode({ address: address as `0x${string}` }) ?? "0x";
  } catch {
    return empty;
  }

  // No code at all (EOA or empty)
  if (!code || code === "0x") return empty;

  // TIP-20 precompile: single byte 0xef — skip analysis
  if (code.toLowerCase() === TIP20_PRECOMPILE_CODE) {
    return { ...empty, skipped: true };
  }

  // Strip 0x prefix and lowercase for substring searches
  const hex = code.toLowerCase().replace(/^0x/, "");

  return {
    is_proxy: hex.includes(EIP1967_PROXY_SLOT),
    has_selfdestruct: hex.includes(OPCODE_SELFDESTRUCT),
    has_delegatecall: hex.includes(OPCODE_DELEGATECALL),
    has_blacklist: BLACKLIST_SELECTORS.some((sel) => hex.includes(sel)),
    has_hidden_mint: MINT_SELECTORS.some((sel) => hex.includes(sel)),
    has_pause: PAUSE_SELECTORS.some((sel) => hex.includes(sel)),
    has_transfer_ownership: hex.includes(TRANSFER_OWNERSHIP_SELECTOR),
    skipped: false,
  };
}

// ─── Transfer simulation ────────────────────────────────────────────────────

interface SimulateResult {
  success: boolean;
  revert_reason: string | null;
}

/**
 * Simulate an ERC-20 transfer via eth_call to detect honeypot-style restrictions.
 * For reliability, pick a `from` that actually holds the token if available —
 * a zero-address `from` trips legitimate compliance checks in almost every
 * real stablecoin and produces false-positive honeypot signals.
 */
export async function simulateTransfer(
  token: string,
  from: string,
  to: string,
  amount: bigint
): Promise<SimulateResult> {
  try {
    await tempoClient.simulateContract({
      address: token as `0x${string}`,
      abi: Abis.tip20,
      functionName: "transfer",
      args: [to as `0x${string}`, amount],
      account: from as `0x${string}`,
    });
    return { success: true, revert_reason: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : String(err);

    // Insufficient balance reverts are expected — not a honeypot signal
    const isBalanceRevert =
      msg.toLowerCase().includes("insufficient") ||
      msg.toLowerCase().includes("balance") ||
      msg.toLowerCase().includes("exceeds");

    if (isBalanceRevert) {
      return { success: true, revert_reason: null };
    }

    return { success: false, revert_reason: msg.slice(0, 200) };
  }
}

// ─── Liquidity tier helpers ─────────────────────────────────────────────────

type LiquidityFlag =
  | "NO_LIQUIDITY"
  | "UNTRADEABLE"
  | "LOW_LIQUIDITY_CRITICAL"
  | "LOW_LIQUIDITY"
  | null;

function getLiquidityFlag(
  pools: PoolData[],
  totalLiquidityUsd: number
): LiquidityFlag {
  if (pools.length === 0) return "NO_LIQUIDITY";
  if (totalLiquidityUsd < 10) return "UNTRADEABLE";
  if (totalLiquidityUsd < 1_000) return "LOW_LIQUIDITY_CRITICAL"; // <$1K
  if (totalLiquidityUsd < 10_000) return "LOW_LIQUIDITY";          // <$10K
  return null;
}

// ─── Main scanner ───────────────────────────────────────────────────────────

/**
 * Run the full safety scan for a token.
 *
 * For TIP-20 tokens we derive honeypot/can_sell from compliance state
 * (pause + policy) rather than running a bytecode or transfer simulation —
 * TIP-20 is a precompile, so bytecode inspection is meaningless, and
 * simulating a transfer from the zero address trips legitimate compliance
 * guards in every real stablecoin, producing spurious HONEYPOT flags.
 *
 * For ERC-20 tokens we keep the bytecode + transfer-simulation path, but
 * use a real holder from `holders.top_holders` as the simulation `from`
 * whenever one is available — dramatically reduces the false-positive rate
 * relative to the old zero→zero simulation.
 *
 * @param address    - Token contract address
 * @param isTip20    - Whether the token is a native TIP-20 (affects scoring)
 * @param pools      - Pool data already fetched by the market scanner
 * @param compliance - Compliance record (used to read paused / policy for TIP-20)
 * @param holders    - Holder data (used to pick a realistic `from` for ERC-20 sim)
 */
export async function scanSafety(
  address: string,
  isTip20: boolean,
  pools: PoolData[],
  compliance: ComplianceResult,
  holders: HolderData
): Promise<SafetyResult> {
  const totalLiquidity = pools.reduce((s, p) => s + p.reserve_usd, 0);
  const liquidityFlag = getLiquidityFlag(pools, totalLiquidity);

  const flags: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // ── Liquidity-tier flags ───────────────────────────────────────────────
  if (liquidityFlag === "NO_LIQUIDITY") flags.push("NO_LIQUIDITY");
  if (liquidityFlag === "UNTRADEABLE") flags.push("UNTRADEABLE");
  if (liquidityFlag === "LOW_LIQUIDITY_CRITICAL") flags.push("LOW_LIQUIDITY");
  if (liquidityFlag === "LOW_LIQUIDITY") flags.push("LOW_LIQUIDITY");

  // Liquidity-based score
  if (liquidityFlag === "NO_LIQUIDITY") score += 25;
  else if (liquidityFlag === "UNTRADEABLE") score += 25;
  else if (liquidityFlag === "LOW_LIQUIDITY_CRITICAL") score += 15;
  else if (liquidityFlag === "LOW_LIQUIDITY") score += 10;

  let honeypot = false;

  if (isTip20) {
    // ── TIP-20 path: derive signals from compliance state ────────────────
    // No bytecode — TIP-20 is a precompile with 1-byte code 0xef.
    // No transfer simulation — compliance rules are the authoritative source.

    if (compliance.paused) {
      flags.push("PAUSED");
      score += 30;
    }

    if (compliance.policy_type === "whitelist") {
      warnings.push("ALLOWLIST_GATED");
      score += 5;
    } else if (
      compliance.policy_type === "blacklist" ||
      compliance.policy_type === "compound"
    ) {
      warnings.push("BLOCKLIST_ENFORCED");
      score += 3;
    }

    if (compliance.headroom_pct !== null && compliance.headroom_pct < 5) {
      warnings.push("SUPPLY_CAP_NEAR");
      score += 2;
    }

    // TIP-20 is a first-class asset on Tempo; slight confidence bonus.
    score -= 3;
  } else {
    // ── ERC-20 path: bytecode scan + transfer simulation ─────────────────
    const bytecode = await checkBytecodePatterns(address);

    if (!bytecode.skipped) {
      if (bytecode.is_proxy) flags.push("IS_PROXY");
      if (bytecode.has_selfdestruct) flags.push("HAS_SELFDESTRUCT");
      if (bytecode.has_blacklist) flags.push("HAS_BLACKLIST");
      if (bytecode.has_hidden_mint) flags.push("HAS_HIDDEN_MINT");
      if (bytecode.has_pause) warnings.push("CAN_PAUSE");
      if (bytecode.has_transfer_ownership) warnings.push("OWNERSHIP_TRANSFERABLE");
      if (bytecode.has_delegatecall) warnings.push("HAS_DELEGATECALL");

      if (bytecode.is_proxy) score += 18;
      if (bytecode.has_selfdestruct) score += 25;
      if (bytecode.has_blacklist) score += 8;
      if (bytecode.has_hidden_mint) score += 12;
    }

    // Use a real holder as the simulation `from` when available. Avoids the
    // zero-address false-positive class (any compliance-aware token reverts
    // on `0x000…` because it's a forbidden mint/burn path, not a trap).
    const realFrom =
      holders.top_holders.find(
        (h) =>
          h.address !== "0x0000000000000000000000000000000000000000" &&
          h.address !== "0x000000000000000000000000000000000000dead"
      )?.address ?? "0x0000000000000000000000000000000000000001";
    const realTo = "0x0000000000000000000000000000000000000002";

    const sim = await simulateTransfer(address, realFrom, realTo, 1n);

    honeypot = !sim.success;
    if (honeypot) {
      flags.push("HONEYPOT");
      score += 35;
    }
  }

  // ── Bonuses ────────────────────────────────────────────────────────────
  if (totalLiquidity >= 50_000) score -= 3;

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score));

  // ── Verdict ────────────────────────────────────────────────────────────
  type Verdict = SafetyResult["verdict"];
  let verdict: Verdict;
  if (score <= 15) verdict = "LOW_RISK";
  else if (score <= 35) verdict = "CAUTION";
  else if (score <= 60) verdict = "MEDIUM_RISK";
  else if (score <= 80) verdict = "HIGH_RISK";
  else verdict = "CRITICAL";

  const canSell =
    !honeypot &&
    !compliance.paused &&
    liquidityFlag !== "NO_LIQUIDITY" &&
    liquidityFlag !== "UNTRADEABLE";

  return {
    score,
    verdict,
    flags,
    warnings,
    can_buy: liquidityFlag !== "NO_LIQUIDITY" && liquidityFlag !== "UNTRADEABLE",
    can_sell: canSell,
    buy_tax_pct: 0,  // eth_call simulation doesn't give us tax percentages; left for future
    sell_tax_pct: 0,
    honeypot,
  };
}
