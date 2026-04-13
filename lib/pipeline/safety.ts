import { Abis } from "viem/tempo";
import { tempoClient } from "@/lib/rpc";
import type { SafetyResult, PoolData } from "@/lib/types";

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
 * Uses a trivially small amount so the simulation doesn't require the from address
 * to actually hold tokens (the node will revert with insufficient balance, not a
 * custom revert — we distinguish those cases below).
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
 * @param address    - Token contract address
 * @param isTip20   - Whether the token is a native TIP-20 (affects scoring)
 * @param pools      - Pool data already fetched by the market scanner
 */
export async function scanSafety(
  address: string,
  isTip20: boolean,
  pools: PoolData[]
): Promise<SafetyResult> {
  const totalLiquidity = pools.reduce((s, p) => s + p.reserve_usd, 0);
  const liquidityFlag = getLiquidityFlag(pools, totalLiquidity);

  // ── Bytecode analysis (ERC-20 only; TIP-20 precompiles are skipped inside) ──
  const bytecode = isTip20
    ? ({
        is_proxy: false,
        has_selfdestruct: false,
        has_delegatecall: false,
        has_blacklist: false,
        has_hidden_mint: false,
        has_pause: false,
        has_transfer_ownership: false,
        skipped: true,
      } as BytecodePatterns)
    : await checkBytecodePatterns(address);

  // ── Transfer simulation ─────────────────────────────────────────────────
  // Use a dummy from/to pair; the node will catch balance issues (not honeypot)
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const sim = await simulateTransfer(
    address,
    ZERO_ADDR,
    ZERO_ADDR,
    BigInt(1)
  );

  // ── Flag & warning collection ───────────────────────────────────────────
  const flags: string[] = [];
  const warnings: string[] = [];

  if (liquidityFlag === "NO_LIQUIDITY") flags.push("NO_LIQUIDITY");
  if (liquidityFlag === "UNTRADEABLE") flags.push("UNTRADEABLE");
  if (liquidityFlag === "LOW_LIQUIDITY_CRITICAL") flags.push("LOW_LIQUIDITY");
  if (liquidityFlag === "LOW_LIQUIDITY") flags.push("LOW_LIQUIDITY");

  if (!bytecode.skipped) {
    if (bytecode.is_proxy) flags.push("IS_PROXY");
    if (bytecode.has_selfdestruct) flags.push("HAS_SELFDESTRUCT");
    if (bytecode.has_blacklist) flags.push("HAS_BLACKLIST");
    if (bytecode.has_hidden_mint) flags.push("HAS_HIDDEN_MINT");
    if (bytecode.has_pause) warnings.push("CAN_PAUSE");
    if (bytecode.has_transfer_ownership) warnings.push("OWNERSHIP_TRANSFERABLE");
    if (bytecode.has_delegatecall) warnings.push("HAS_DELEGATECALL");
  }

  const honeypot = !sim.success;
  if (honeypot) flags.push("HONEYPOT");
  else if (!sim.success) flags.push("TRANSFER_RESTRICTED");

  // ── Risk score calculation ──────────────────────────────────────────────
  let score = 0;

  // Liquidity penalties
  if (liquidityFlag === "NO_LIQUIDITY") score += 25;
  else if (liquidityFlag === "UNTRADEABLE") score += 25;
  else if (liquidityFlag === "LOW_LIQUIDITY_CRITICAL") score += 15;
  else if (liquidityFlag === "LOW_LIQUIDITY") score += 10;

  // Bytecode penalties
  if (bytecode.is_proxy) score += 18;
  if (bytecode.has_selfdestruct) score += 25;
  if (bytecode.has_blacklist) score += 8;
  if (bytecode.has_hidden_mint) score += 12;

  // Transfer simulation
  if (honeypot) {
    score += 35;
  } else if (!sim.success) {
    score += 12; // TRANSFER_RESTRICTED but not full honeypot
  }

  // Bonuses (score reducers)
  if (isTip20) score -= 3;
  if (totalLiquidity >= 50_000) score -= 3;

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score));

  // ── Verdict ─────────────────────────────────────────────────────────────
  type Verdict = SafetyResult["verdict"];
  let verdict: Verdict;
  if (score <= 15) verdict = "LOW_RISK";
  else if (score <= 35) verdict = "CAUTION";
  else if (score <= 60) verdict = "MEDIUM_RISK";
  else if (score <= 80) verdict = "HIGH_RISK";
  else verdict = "CRITICAL";

  return {
    score,
    verdict,
    flags,
    warnings,
    can_buy: liquidityFlag !== "NO_LIQUIDITY" && liquidityFlag !== "UNTRADEABLE",
    can_sell: !honeypot,
    buy_tax_pct: 0,  // eth_call simulation doesn't give us tax percentages; left for future
    sell_tax_pct: 0,
    honeypot,
  };
}
