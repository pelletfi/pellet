"use client";

import { useEffect, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { createWalletClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, Actions, withRelay, tempoActions } from "viem/tempo";

type Runtime = "claude" | "cursor" | "cli";

const RUNTIMES: { id: Runtime; label: string; cmd: (url: string) => string }[] = [
  {
    id: "claude",
    label: "CLAUDE CODE",
    cmd: (url) => `claude mcp add pellet --transport http ${url}`,
  },
  {
    id: "cursor",
    label: "CURSOR",
    cmd: (url) => `# Add to .cursor/mcp.json\n{"mcpServers":{"pellet":{"url":"${url}"}}}`,
  },
  {
    id: "cli",
    label: "OTHER",
    cmd: (url) => url,
  },
];

function RuntimeTabs({ mcpUrl }: { mcpUrl: string }) {
  const [active, setActive] = useState<Runtime>("claude");
  const [copied, setCopied] = useState(false);
  const runtime = RUNTIMES.find((r) => r.id === active)!;
  const cmd = runtime.cmd(mcpUrl);

  const copy = () => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="spec-signin-tabs" role="tablist" aria-label="Runtime">
        {RUNTIMES.map((r) => (
          <button
            key={r.id}
            role="tab"
            type="button"
            aria-selected={active === r.id}
            className={`spec-signin-tab${active === r.id ? " spec-signin-tab-active" : ""}`}
            onClick={() => { setActive(r.id); setCopied(false); }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div
        style={{ position: "relative", cursor: "pointer" }}
        onClick={copy}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") copy(); }}
      >
        <code className="spec-signin-cmd" style={{ display: "block" }}>{cmd}</code>
        <span
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            fontSize: 10,
            letterSpacing: "0.08em",
            opacity: 0.5,
          }}
        >
          {copied ? "COPIED" : "CLICK TO COPY"}
        </span>
      </div>
    </div>
  );
}

type ApprovalState =
  | { kind: "input" }
  | { kind: "auth"; code: string }
  | { kind: "confirming"; code: string; userId: string; managedAddress: string }
  | { kind: "submitting"; stage: "init" | "signing" | "broadcasting" | "finalizing" }
  | { kind: "approved"; txHash: string; explorerUrl: string }
  | { kind: "error"; message: string };

const PRESET_CAPS = [
  { label: "$5 / 24h", spendCapUsdc: 5, perCallUsdc: 1, ttlSeconds: 24 * 3600 },
  { label: "$25 / 7d", spendCapUsdc: 25, perCallUsdc: 5, ttlSeconds: 7 * 24 * 3600 },
  { label: "$100 / 30d", spendCapUsdc: 100, perCallUsdc: 10, ttlSeconds: 30 * 24 * 3600 },
];

const TRANSFER_WITH_MEMO = "0x95777d59" as const;
const APPROVE = "0x095ea7b3" as const;
const SWAP_EXACT_AMOUNT_IN = "0xf8856c0f" as const;
const STABLECOIN_DEX = "0xdec0000000000000000000000000000000000000" as const;

type InitResponse = {
  user_id: string;
  credential_id: string;
  public_key_uncompressed: `0x${string}`;
  managed_address: `0x${string}`;
  rp_id: string;
  agent_key_address: `0x${string}`;
  agent_private_key: `0x${string}`;
  chain: {
    id: number;
    name: string;
    rpc_url: string;
    sponsor_url: string | null;
    explorer_url: string;
    usdc_e: `0x${string}`;
    demo_stable?: `0x${string}`;
  };
  account_keychain_address: `0x${string}`;
  expiry_unix: number;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
};

export function DeviceApproval({ initialCode }: { initialCode: string }) {
  const [state, setState] = useState<ApprovalState>(
    initialCode ? { kind: "auth", code: initialCode } : { kind: "input" },
  );
  const [code, setCode] = useState(initialCode);
  const [capIdx, setCapIdx] = useState(0);
  const [supportsPasskey, setSupportsPasskey] = useState<boolean | null>(null);
  const [mcpUrl, setMcpUrl] = useState("https://pellet.network/mcp");

  useEffect(() => {
    setSupportsPasskey(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
    if (typeof window !== "undefined") {
      setMcpUrl(`${window.location.origin}/mcp`);
    }
  }, []);

  const cap = PRESET_CAPS[capIdx];

  const onPasskeySignIn = async () => {
    if (state.kind !== "auth") return;
    try {
      const optsRes = await fetch("/api/wallet/webauthn/auth/options", { method: "POST" });
      const opts = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: opts });
      const verifyRes = await fetch("/api/wallet/webauthn/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        setState({ kind: "error", message: data.error ?? "sign-in failed" });
        return;
      }
      setState({
        kind: "confirming",
        code: state.code,
        userId: data.user_id,
        managedAddress: data.managed_address,
      });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const onPasskeyEnroll = async () => {
    if (state.kind !== "auth") return;
    try {
      const optsRes = await fetch("/api/wallet/webauthn/register/options", { method: "POST" });
      const opts = await optsRes.json();
      const attestation = await startRegistration({ optionsJSON: opts });
      const verifyRes = await fetch("/api/wallet/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        setState({ kind: "error", message: data.error ?? "enrollment failed" });
        return;
      }
      setState({
        kind: "confirming",
        code: state.code,
        userId: data.user_id,
        managedAddress: data.managed_address,
      });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const onApprove = async () => {
    if (state.kind !== "confirming") return;

    setState({ kind: "submitting", stage: "init" });
    let init: InitResponse;
    try {
      const res = await fetch("/api/wallet/device/approve-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: state.code,
          spend_cap_wei: String(cap.spendCapUsdc * 1_000_000),
          per_call_cap_wei: String(cap.perCallUsdc * 1_000_000),
          session_ttl_seconds: cap.ttlSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "approve-init failed" });
        return;
      }
      init = data as InitResponse;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      return;
    }

    setState({ kind: "submitting", stage: "signing" });
    let txHash: `0x${string}`;
    try {
      const userAccount = Account.fromWebAuthnP256(
        {
          id: init.credential_id,
          publicKey: init.public_key_uncompressed,
        },
        { rpId: init.rp_id },
      );

      const accessKey = Account.fromSecp256k1(init.agent_private_key, {
        access: userAccount,
      });

      const baseChain =
        init.chain.id === tempoMainnet.id ? tempoMainnet : tempoModerato;
      // Use demo_stable (pathUSD on mainnet) for gas — usdc_e FeeAMM pool
      // ran dry on Presto 2026-05-09, blocking signup. pathUSD is Tempo's
      // canonical fee-bearing stable. Falls back to usdc_e if demo_stable
      // isn't configured for this chain.
      const feeToken = init.chain.demo_stable ?? init.chain.usdc_e;
      const chain = { ...baseChain, feeToken };

      const transport = init.chain.sponsor_url
        ? withRelay(http(init.chain.rpc_url), http(init.chain.sponsor_url), {
            policy: "sign-only",
          })
        : http(init.chain.rpc_url);

      const client = createWalletClient({
        account: userAccount,
        chain,
        transport,
      }).extend(tempoActions());

      setState({ kind: "submitting", stage: "broadcasting" });
      const result = await client.accessKey.authorizeSync({
        accessKey,
        expiry: init.expiry_unix,
        feePayer: true,
        gas: BigInt(10_000_000),
        limits: [
          {
            token: init.chain.usdc_e,
            limit: BigInt(init.spend_cap_wei),
            period: 86400,
          },
          ...(init.chain.demo_stable && init.chain.demo_stable !== init.chain.usdc_e
            ? [{
                token: init.chain.demo_stable,
                limit: BigInt(init.spend_cap_wei),
                period: 86400,
              }]
            : []),
        ],
        scopes: [
          { address: init.chain.usdc_e, selector: TRANSFER_WITH_MEMO },
          { address: init.chain.usdc_e, selector: APPROVE },
          ...(init.chain.demo_stable && init.chain.demo_stable !== init.chain.usdc_e
            ? [
                { address: init.chain.demo_stable, selector: TRANSFER_WITH_MEMO },
                { address: init.chain.demo_stable, selector: APPROVE },
              ]
            : []),
          { address: STABLECOIN_DEX, selector: SWAP_EXACT_AMOUNT_IN },
        ],
      });
      txHash = result.receipt.transactionHash as `0x${string}`;

      // Pre-approve stablecoin DEX from the user's passkey so the access
      // key never needs the approve scope (which older keys lack).
      const maxUint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const tokens = [init.chain.usdc_e];
      if (init.chain.demo_stable && init.chain.demo_stable !== init.chain.usdc_e) {
        tokens.push(init.chain.demo_stable);
      }
      for (const tkn of tokens) {
        try {
          await client.token.approveSync({
            account: userAccount,
            token: tkn as `0x${string}`,
            spender: STABLECOIN_DEX,
            amount: maxUint,
            feePayer: true,
            gas: BigInt(500_000),
          } as any);
        } catch {
          // Non-fatal — swap will prompt approve later if needed.
        }
      }
    } catch (e) {
      setState({
        kind: "error",
        message:
          "on-chain authorize failed: " +
          (e instanceof Error ? e.message : String(e)),
      });
      return;
    }

    setState({ kind: "submitting", stage: "finalizing" });
    try {
      const finRes = await fetch("/api/wallet/device/approve-finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: state.code, tx_hash: txHash }),
      });
      const finData = await finRes.json();
      if (!finRes.ok) {
        setState({
          kind: "error",
          message:
            "tx confirmed but server rejected finalize: " +
            (finData.error ?? "unknown") +
            (finData.detail ? ` (${finData.detail})` : "") +
            ` · tx ${txHash}`,
        });
        return;
      }
    } catch (e) {
      setState({
        kind: "error",
        message:
          "tx confirmed but finalize POST failed: " +
          (e instanceof Error ? e.message : String(e)),
      });
      return;
    }

    setState({
      kind: "approved",
      txHash,
      explorerUrl: `${init.chain.explorer_url}/tx/${txHash}`,
    });
  };

  // Left column: explain text adapts per state
  const explain = (() => {
    if (state.kind === "approved") {
      return {
        title: "Connected",
        lede: "Your agent is authorized on Tempo. The CLI received a bearer token and is ready to make calls against your wallet.",
        bullets: [
          "Agent key is live with on-chain spend caps.",
          "Every call signs and posts to Tempo.",
          "Revoke any time from your wallet dashboard.",
        ],
      };
    }
    if (state.kind === "confirming" || state.kind === "submitting") {
      return {
        title: "Approve agent",
        lede: "Set a spend cap and approve the agent key on Tempo. Your passkey signs the authorization transaction — gas is sponsored.",
        bullets: [
          "Choose a spend cap preset or accept the default.",
          "Your passkey signs an on-chain authorizeKey tx.",
          "The agent key gets Tempo-enforced caps.",
        ],
      };
    }
    return {
      title: "Connect agent",
      lede: "Pair a CLI or agent runtime with your Pellet wallet. The agent gets a scoped session key with on-chain spend caps — every payment posts to Tempo.",
      bullets: [
        "Pair an agent with a per-call spend cap and an expiry.",
        "Each call signs against your passkey and posts to Tempo.",
        "Revoke any session instantly. Every spend is on-chain.",
      ],
    };
  })();

  const currentCode = state.kind === "auth" ? state.code
    : state.kind === "confirming" ? state.code
    : code;

  return (
    <div className="spec-signin-shell">
      <section className="spec-signin-explain">
        <h1 className="spec-page-title">
          <span>Wallet</span>
          <span className="spec-page-title-em">— {explain.title.toLowerCase()}</span>
        </h1>
        <p className="spec-signin-lede">{explain.lede}</p>
        <ul className="spec-signin-bullets">
          {explain.bullets.map((b, i) => (
            <li key={i}>
              <span className="spec-signin-bullet-num">{String(i + 1).padStart(2, "0")}</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="spec-signin-card">
        {/* ── Input: enter code ── */}
        {state.kind === "input" && (
          <>
            <div className="spec-signin-card-head">
              <span className="spec-signin-card-label">PAIRING</span>
            </div>
            <h2 className="spec-signin-h2">Enter code</h2>
            <p className="spec-signin-sub">
              Type or paste the three-word code from your CLI.
            </p>
            <input
              className="spec-signin-cta"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. blue-tape-river"
              spellCheck={false}
              autoComplete="off"
              style={{ textAlign: "left", fontVariantNumeric: "tabular-nums" }}
            />
            <button
              type="button"
              className="spec-signin-cta"
              onClick={() => {
                if (code.trim().length > 0) setState({ kind: "auth", code: code.trim() });
              }}
            >
              CONTINUE
            </button>
          </>
        )}

        {/* ── Auth: sign in or enroll ── */}
        {state.kind === "auth" && (
          <>
            <div className="spec-signin-card-head">
              <span className="spec-signin-card-label">PAIRING</span>
              <span className="spec-signin-card-label" style={{ fontVariantNumeric: "tabular-nums" }}>
                {state.code}
              </span>
            </div>
            <h2 className="spec-signin-h2">Sign in with passkey</h2>
            <p className="spec-signin-sub">
              Authenticate with the passkey you enrolled at pairing time, or
              create a new wallet.
            </p>

            {supportsPasskey === false && (
              <div className="spec-signin-error">
                This browser doesn't support passkeys. Try Chrome, Safari, or Edge.
              </div>
            )}

            <button
              type="button"
              className="spec-signin-cta"
              onClick={onPasskeySignIn}
              disabled={!supportsPasskey}
            >
              SIGN IN
            </button>
            <button
              type="button"
              className="spec-signin-cta"
              onClick={onPasskeyEnroll}
              disabled={!supportsPasskey}
              style={{ opacity: 0.7 }}
            >
              ENROLL NEW PASSKEY
            </button>
          </>
        )}

        {/* ── Confirming: choose caps + approve ── */}
        {state.kind === "confirming" && (
          <>
            <div className="spec-signin-card-head">
              <span className="spec-signin-card-label">APPROVE</span>
              <span className="spec-signin-card-label" style={{ fontVariantNumeric: "tabular-nums" }}>
                {state.code}
              </span>
            </div>
            <h2 className="spec-signin-h2">Set spend cap</h2>
            <p className="spec-signin-sub">
              wallet · {state.managedAddress.slice(0, 14)}…{state.managedAddress.slice(-6)}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {PRESET_CAPS.map((c, i) => (
                <button
                  key={c.label}
                  type="button"
                  className={`spec-signin-cta`}
                  style={{
                    background: i === capIdx ? "var(--fg)" : "transparent",
                    color: i === capIdx ? "var(--bg)" : "var(--fg)",
                    borderColor: i === capIdx ? "var(--fg)" : undefined,
                    fontSize: 11,
                    padding: "10px 8px",
                  }}
                  onClick={() => setCapIdx(i)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <p className="spec-signin-sub" style={{ fontSize: 11, opacity: 0.6, margin: 0 }}>
              max ${cap.perCallUsdc} per call · {cap.spendCapUsdc} total · expires in{" "}
              {cap.ttlSeconds < 86400 ? `${cap.ttlSeconds / 3600}h` : `${cap.ttlSeconds / 86400}d`}
            </p>

            <button type="button" className="spec-signin-cta" onClick={onApprove}>
              APPROVE · GRANT {cap.label}
            </button>
          </>
        )}

        {/* ── Submitting: progress ── */}
        {state.kind === "submitting" && (
          <>
            <div className="spec-signin-card-head">
              <span className="spec-signin-card-label">AUTHORIZING</span>
            </div>
            <h2 className="spec-signin-h2">Working…</h2>
            <div style={{ fontSize: 12, lineHeight: 2, opacity: 0.8 }}>
              <div style={{ opacity: state.stage === "init" ? 1 : 0.4 }}>· preparing agent key</div>
              <div style={{ opacity: state.stage === "signing" ? 1 : state.stage === "init" ? 0.4 : 0.4 }}>· waiting for passkey</div>
              <div style={{ opacity: state.stage === "broadcasting" ? 1 : 0.4 }}>· broadcasting tx</div>
              <div style={{ opacity: state.stage === "finalizing" ? 1 : 0.4 }}>· finalizing</div>
            </div>
          </>
        )}

        {/* ── Approved ── */}
        {state.kind === "approved" && (
          <>
            <div className="spec-signin-card-head">
              <span className="spec-signin-card-label">CONNECTED</span>
            </div>
            <h2 className="spec-signin-h2">Approved</h2>
            <p className="spec-signin-sub">
              Agent key authorized on Tempo. Your CLI should pick up the bearer
              token within a couple seconds.
            </p>
            <a
              href="/wallet/dashboard"
              className="spec-signin-cta"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              GO TO DASHBOARD
            </a>

            <div className="spec-signin-foot">
              <span className="spec-page-subhead-label">CONNECT YOUR AGENT</span>
              <p className="spec-signin-sub" style={{ margin: 0 }}>
                Add the MCP server to your agent runtime. OAuth consent
                triggers automatically on first use.
              </p>
              <RuntimeTabs mcpUrl={mcpUrl} />
              <a
                href={state.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, opacity: 0.6, textDecoration: "none", color: "inherit", marginTop: 8 }}
              >
                view tx ↗
              </a>
            </div>
          </>
        )}

        {/* ── Error ── */}
        {state.kind === "error" && (
          <>
            <div className="spec-signin-card-head">
              <span className="spec-signin-card-label">ERROR</span>
            </div>
            <h2 className="spec-signin-h2">Something went wrong</h2>
            <div className="spec-signin-error">{state.message}</div>
            <button
              type="button"
              className="spec-signin-cta"
              onClick={() => setState({ kind: "input" })}
            >
              START OVER
            </button>
          </>
        )}
      </section>
    </div>
  );
}
