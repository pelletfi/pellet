"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";
import {
  PATH_USD,
  PLTN,
  RPC_URL,
  TEMPO_CHAIN_ID,
  V2_ROUTER,
} from "@/lib/pltn/constants";
import { quoteBuy, formatCompactPLTN } from "@/lib/pltn/pair";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...a: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...a: unknown[]) => void) => void;
    };
  }
}

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const ROUTER_ABI = parseAbi([
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
]);

const publicClient = createPublicClient({ chain: tempo, transport: http(RPC_URL) });

type Status =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "switching" }
  | { kind: "approving"; hash?: Hex }
  | { kind: "swapping"; hash?: Hex }
  | { kind: "success"; hash: Hex }
  | { kind: "error"; message: string };

export function BuyWidget() {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [amountIn, setAmountIn] = useState("10");
  const [quoteOut, setQuoteOut] = useState<bigint>(0n);
  const [slippageBps, setSlippageBps] = useState(100); // 1.0%
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Listen to wallet account/chain changes
  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth) return;
    const onAccounts = (accs: unknown) => {
      const list = accs as string[];
      setAccount((list[0] as Address) ?? null);
    };
    const onChain = (cidHex: unknown) => {
      const cid = typeof cidHex === "string" ? parseInt(cidHex, 16) : 0;
      setChainOk(cid === TEMPO_CHAIN_ID);
    };
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    // Initial probe
    (async () => {
      try {
        const accs = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accs[0]) setAccount(accs[0] as Address);
        const cidHex = (await eth.request({ method: "eth_chainId" })) as string;
        setChainOk(parseInt(cidHex, 16) === TEMPO_CHAIN_ID);
      } catch {}
    })();
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  // Live quote whenever amount changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const trimmed = amountIn.trim();
      if (!trimmed || isNaN(Number(trimmed)) || Number(trimmed) <= 0) {
        setQuoteOut(0n);
        return;
      }
      try {
        const raw = parseUnits(trimmed, 6);
        const out = await quoteBuy(raw);
        if (!cancelled) setQuoteOut(out);
      } catch {
        if (!cancelled) setQuoteOut(0n);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [amountIn]);

  const priceImpactPct = usePriceImpact(amountIn, quoteOut);

  const connect = useCallback(async () => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth) {
      setStatus({
        kind: "error",
        message:
          "No injected wallet detected. Use a wallet that supports Tempo (chain 4217).",
      });
      return;
    }
    setStatus({ kind: "connecting" });
    try {
      const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount((accs[0] as Address) ?? null);
      // Switch / add Tempo
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${TEMPO_CHAIN_ID.toString(16)}` }],
        });
        setChainOk(true);
      } catch (switchErr: unknown) {
        const errCode = (switchErr as { code?: number })?.code;
        if (errCode === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${TEMPO_CHAIN_ID.toString(16)}`,
                chainName: "Tempo",
                nativeCurrency: { name: "USD", symbol: "USD", decimals: 6 },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ["https://explore.mainnet.tempo.xyz"],
              },
            ],
          });
          setChainOk(true);
        } else {
          throw switchErr;
        }
      }
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Wallet connection failed",
      });
    }
  }, []);

  const buy = useCallback(async () => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth || !account) return;
    const amt = amountIn.trim();
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) return;
    const amountInRaw = parseUnits(amt, 6);
    const minOut = (quoteOut * BigInt(10_000 - slippageBps)) / 10_000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    try {
      // Force feeToken = pathUSD on the chain so Tempo's FeeAMM knows which
      // token to charge gas in. Without this, transfers / approvals / swaps
      // can fail with "insufficient liquidity in FeeAMM pool" when the
      // wallet defaults to charging fees in a token without FeeAMM liquidity.
      const chain = { ...tempo, feeToken: PATH_USD };
      const wallet = createWalletClient({
        account,
        chain,
        transport: custom(eth),
      }).extend(tempoActions());

      // 1. Check + bump pathUSD allowance
      const allowance = (await publicClient.readContract({
        address: PATH_USD,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, V2_ROUTER],
      })) as bigint;

      if (allowance < amountInRaw) {
        setStatus({ kind: "approving" });
        const approveHash = await wallet.writeContract({
          address: PATH_USD,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [V2_ROUTER, amountInRaw],
          feeToken: PATH_USD,
        } as Parameters<typeof wallet.writeContract>[0]);
        setStatus({ kind: "approving", hash: approveHash });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Swap pathUSD → PLTN
      setStatus({ kind: "swapping" });
      const swapHash = await wallet.writeContract({
        address: V2_ROUTER,
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [amountInRaw, minOut, [PATH_USD, PLTN], account, deadline],
        feeToken: PATH_USD,
      } as Parameters<typeof wallet.writeContract>[0]);
      setStatus({ kind: "swapping", hash: swapHash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
      if (receipt.status !== "success") throw new Error("Swap reverted on-chain");
      setStatus({ kind: "success", hash: swapHash });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message: short(msg) });
    }
  }, [account, amountIn, quoteOut, slippageBps]);

  const ready = !!account && chainOk;
  const buttonLabel = useMemo(() => {
    if (status.kind === "connecting") return "Connecting…";
    if (status.kind === "switching") return "Switching to Tempo…";
    if (status.kind === "approving") return "Approve pathUSD…";
    if (status.kind === "swapping") return "Confirming swap…";
    if (status.kind === "success") return "Bought ✓ buy more";
    if (!account) return "Connect wallet";
    if (!chainOk) return "Switch to Tempo";
    if (!amountIn || quoteOut === 0n) return "Enter an amount";
    return `Buy ${formatCompactPLTN(quoteOut)} PLTN`;
  }, [status, account, chainOk, amountIn, quoteOut]);

  const onClick = () => {
    if (!account || !chainOk) return connect();
    return buy();
  };
  const busy =
    status.kind === "connecting" ||
    status.kind === "switching" ||
    status.kind === "approving" ||
    status.kind === "swapping";

  return (
    <>
      <div className="pltn-buy-row">
        <div className="pltn-buy-side">
          <div className="pltn-buy-k">Pay</div>
          <input
            className="pltn-buy-v"
            inputMode="decimal"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            spellCheck={false}
            aria-label="pathUSD amount"
          />
          <div className="pltn-buy-token">pathUSD</div>
        </div>
        <div className="pltn-buy-swap" aria-hidden>⇄</div>
        <div className="pltn-buy-side">
          <div className="pltn-buy-k">Receive</div>
          <input
            className="pltn-buy-v"
            value={quoteOut === 0n ? "—" : formatCompactPLTN(quoteOut)}
            readOnly
            tabIndex={-1}
            aria-label="PLTN amount"
          />
          <div className="pltn-buy-token">PLTN</div>
        </div>
      </div>

      <dl className="pltn-dl">
        <dt className="pltn-dl-k">Impact</dt>
        <span className="pltn-dl-leader" aria-hidden />
        <dd className="pltn-dl-v">
          {priceImpactPct === null ? "—" : `${priceImpactPct.toFixed(2)}%`}
        </dd>
        <dt className="pltn-dl-k">Slippage</dt>
        <span className="pltn-dl-leader" aria-hidden />
        <dd className="pltn-dl-v">
          <button
            type="button"
            className="pltn-dl-pill"
            data-active={slippageBps === 50 ? 1 : 0}
            onClick={() => setSlippageBps(50)}
          >
            0.5%
          </button>
          <button
            type="button"
            className="pltn-dl-pill"
            data-active={slippageBps === 100 ? 1 : 0}
            onClick={() => setSlippageBps(100)}
          >
            1.0%
          </button>
          <button
            type="button"
            className="pltn-dl-pill"
            data-active={slippageBps === 300 ? 1 : 0}
            onClick={() => setSlippageBps(300)}
          >
            3.0%
          </button>
        </dd>
      </dl>

      <button
        className="pltn-action"
        onClick={onClick}
        disabled={busy || (ready && (quoteOut === 0n || !amountIn))}
      >
        {buttonLabel}
      </button>
      <span className="pltn-action-accent" aria-hidden />

      {status.kind === "error" && <div className="pltn-status">{status.message}</div>}
      {(status.kind === "approving" || status.kind === "swapping") && status.hash && (
        <div className="pltn-status">tx {status.hash.slice(0, 10)}… pending</div>
      )}
      {status.kind === "success" && (
        <div className="pltn-status">
          tx{" "}
          <a
            href={`https://explore.mainnet.tempo.xyz/tx/${status.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {status.hash.slice(0, 10)}…
          </a>{" "}
          confirmed
        </div>
      )}
    </>
  );
}

function usePriceImpact(amountInStr: string, quoteOut: bigint): number | null {
  const [impact, setImpact] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = amountInStr.trim();
      if (!t || isNaN(Number(t)) || Number(t) <= 0 || quoteOut === 0n) {
        setImpact(null);
        return;
      }
      try {
        const { readPair } = await import("@/lib/pltn/pair");
        const r = await readPair();
        if (cancelled) return;
        // Mid price USD/PLTN, scaled 1e12 → number
        const mid = Number(r.priceScaled12) / 1e12;
        // Effective price = amountIn (USD) / amountOut (PLTN)
        const amountInUSD = Number(parseUnits(t, 6)) / 1e6;
        const amountOutPLTN = Number(quoteOut) / 1e6;
        const effective = amountInUSD / amountOutPLTN;
        const impactPct = ((effective - mid) / mid) * 100;
        setImpact(Number.isFinite(impactPct) ? impactPct : null);
      } catch {
        if (!cancelled) setImpact(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amountInStr, quoteOut]);
  return impact;
}

function short(msg: string): string {
  // Strip viem's wall of text, keep something readable
  const firstLine = msg.split("\n")[0];
  return firstLine.length > 140 ? firstLine.slice(0, 140) + "…" : firstLine;
}
