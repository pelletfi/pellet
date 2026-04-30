"use client";

import { useEffect, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { createWalletClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, Actions, withRelay, tempoActions } from "viem/tempo";

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

// transferWithMemo selector — the x402 settlement call on TIP-20.
const TRANSFER_WITH_MEMO = "0x95777d59" as const;

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

  useEffect(() => {
    setSupportsPasskey(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
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

    // Build the user's passkey-rooted Tempo account + sponsored client.
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

      // The access key Account — wraps the freshly-generated agent
      // private key. `access: userAccount` tells viem this key is
      // derived/scoped to the user account.
      const accessKey = Account.fromSecp256k1(init.agent_private_key, {
        access: userAccount,
      });

      const baseChain =
        init.chain.id === tempoMainnet.id ? tempoMainnet : tempoModerato;
      // Tempo's chainConfig.prepareTransactionRequest reads chain.feeToken
      // when feePayer is set; surface the chain's USDC.e as the fee token
      // so sponsor accounting is well-formed.
      const chain = { ...baseChain, feeToken: init.chain.usdc_e };

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

      // T3 authorizeKey via the high-level Tempo action. Constructs a
      // type-0x76 envelope with keyAuthorization, signs the keyAuth
      // payload with the access key + the outer envelope with the
      // user's passkey, sends with feePayer:true so withRelay engages
      // the sponsor for gas.
      //
      // Explicit gas budget — viem's default estimate (~40k) doesn't
      // account for on-chain WebAuthn signature verification (~2M)
      // plus AccountKeychain storage writes (~500k) plus first-tx
      // account activation. Set generous and let the precompile use
      // what it needs; sponsor pays the actual amount metered.
      setState({ kind: "submitting", stage: "broadcasting" });
      const result = await client.accessKey.authorizeSync({
        accessKey,
        expiry: init.expiry_unix,
        feePayer: true,
        gas: BigInt(5_000_000),
        limits: [
          {
            token: init.chain.usdc_e,
            limit: BigInt(init.spend_cap_wei),
            period: 86400,
          },
        ],
        scopes: [
          { address: init.chain.usdc_e, selector: TRANSFER_WITH_MEMO },
        ],
      });
      txHash = result.receipt.transactionHash as `0x${string}`;
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

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        background: "var(--color-bg-base)",
        border: "1px solid var(--color-border-subtle)",
        padding: 32,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <style>{`
        .dev-h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: 32px; font-weight: 400; margin: 0 0 8px; letter-spacing: -0.02em; }
        .dev-kicker { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-text-quaternary); }
        .dev-mono { font-family: var(--font-mono); }
        .dev-input { width: 100%; padding: 12px 14px; font-family: var(--font-mono); font-size: 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--color-border-subtle); color: var(--color-text-primary); letter-spacing: 0.04em; outline: none; }
        .dev-input:focus { border-color: var(--color-accent); }
        .dev-cap-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; }
        .dev-cap { padding: 14px 8px; border: 1px solid var(--color-border-subtle); cursor: pointer; text-align: center; transition: border-color var(--duration-fast) ease; background: transparent; color: var(--color-text-secondary); font-family: var(--font-mono); font-size: 12px; }
        .dev-cap:hover { border-color: rgba(255,255,255,0.18); }
        .dev-cap-active { border-color: var(--color-accent); color: var(--color-text-primary); background: rgba(46,80,144,0.08); }
        .dev-btn { width: 100%; padding: 14px; background: var(--color-accent); color: #fff; border: 0; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: opacity var(--duration-fast) ease; }
        .dev-btn:hover { opacity: 0.9; }
        .dev-btn[disabled] { opacity: 0.4; cursor: wait; }
        .dev-btn-secondary { background: transparent; color: var(--color-text-tertiary); border: 1px solid var(--color-border-subtle); margin-top: 10px; }
        .dev-btn-secondary:hover { color: var(--color-text-primary); border-color: rgba(255,255,255,0.18); opacity: 1; }
        .dev-rule { height: 1px; background: var(--color-border-subtle); margin: 24px 0; }
        .dev-mono-addr { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-quaternary); word-break: break-all; }
        .dev-stage { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-tertiary); line-height: 1.6; }
        .dev-stage-active { color: var(--color-accent); }
        .dev-stage-done { color: var(--color-text-quaternary); }
      `}</style>

      <span className="dev-kicker">Pellet Wallet · Connect agent</span>

      {state.kind === "input" && (
        <>
          <h1 className="dev-h1">Enter code</h1>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
            Type or paste the three-word code from your CLI to begin pairing.
          </p>
          <input
            className="dev-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. blue-tape-river"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="dev-btn"
            style={{ marginTop: 12 }}
            onClick={() => {
              if (code.trim().length > 0) setState({ kind: "auth", code: code.trim() });
            }}
          >
            continue
          </button>
        </>
      )}

      {state.kind === "auth" && (
        <>
          <h1 className="dev-h1">Sign in or enroll</h1>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
            Pellet Wallet is rooted in your passkey. Sign in if you've used
            this device before; otherwise enroll a new passkey.
          </p>
          <p style={{ color: "var(--color-text-quaternary)", fontSize: 11, fontFamily: "var(--font-mono)", margin: "0 0 16px" }}>
            Code: <span style={{ color: "var(--color-accent)" }}>{state.code}</span>
          </p>

          {supportsPasskey === false && (
            <p style={{ color: "var(--color-error)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
              this browser doesn't support passkeys. try Chrome, Safari, or Edge.
            </p>
          )}

          <button className="dev-btn" onClick={onPasskeySignIn} disabled={!supportsPasskey}>
            sign in with passkey
          </button>
          <button className="dev-btn dev-btn-secondary" onClick={onPasskeyEnroll} disabled={!supportsPasskey}>
            enroll new passkey
          </button>
        </>
      )}

      {state.kind === "confirming" && (
        <>
          <h1 className="dev-h1">Approve agent</h1>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
            Code: <span className="dev-mono" style={{ color: "var(--color-accent)" }}>{state.code}</span>
          </p>
          <p className="dev-mono-addr">
            wallet · {state.managedAddress.slice(0, 14)}…{state.managedAddress.slice(-6)}
          </p>

          <div className="dev-rule" />

          <div>
            <span className="dev-kicker">Spend caps</span>
            <div className="dev-cap-row">
              {PRESET_CAPS.map((c, i) => (
                <button
                  key={c.label}
                  type="button"
                  className={`dev-cap${i === capIdx ? " dev-cap-active" : ""}`}
                  onClick={() => setCapIdx(i)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p
              style={{
                fontSize: 11,
                color: "var(--color-text-quaternary)",
                fontFamily: "var(--font-mono)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              max ${cap.perCallUsdc} per call · {cap.spendCapUsdc} total · expires in{" "}
              {cap.ttlSeconds < 86400 ? `${cap.ttlSeconds / 3600}h` : `${cap.ttlSeconds / 86400}d`}
            </p>
          </div>

          <div className="dev-rule" />

          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-quaternary)",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.5,
              margin: "0 0 16px",
            }}
          >
            ⚠ <strong>Phase 3.B.</strong> Approving will prompt your passkey
            to sign an{" "}
            <span className="dev-mono">AccountKeychain.authorizeKey</span> tx
            on Tempo Moderato testnet. Gas is sponsored. The agent key gets
            on-chain caps — Tempo enforces them.
          </p>

          <button className="dev-btn" onClick={onApprove}>
            approve · grant {cap.label}
          </button>
        </>
      )}

      {state.kind === "submitting" && (
        <>
          <h1 className="dev-h1">Working…</h1>
          <p className="dev-stage">
            <span className={state.stage === "init" ? "dev-stage-active" : "dev-stage-done"}>
              · preparing agent key
            </span>
            <br />
            <span
              className={
                state.stage === "signing"
                  ? "dev-stage-active"
                  : state.stage === "init"
                  ? ""
                  : "dev-stage-done"
              }
            >
              · waiting for passkey
            </span>
            <br />
            <span
              className={
                state.stage === "broadcasting"
                  ? "dev-stage-active"
                  : state.stage === "finalizing" || state.stage === "init" || state.stage === "signing"
                  ? state.stage === "finalizing"
                    ? "dev-stage-done"
                    : ""
                  : "dev-stage-done"
              }
            >
              · broadcasting tx
            </span>
            <br />
            <span className={state.stage === "finalizing" ? "dev-stage-active" : ""}>
              · finalizing
            </span>
          </p>
        </>
      )}

      {state.kind === "approved" && (
        <>
          <h1 className="dev-h1">Approved.</h1>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
            Agent key authorized on Tempo. Your CLI should pick up the bearer token within a couple seconds.
          </p>
          <a
            href={state.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dev-mono-addr"
            style={{ color: "var(--color-accent)", borderBottom: "1px solid var(--color-accent)", textDecoration: "none" }}
          >
            tx · {state.txHash.slice(0, 14)}…{state.txHash.slice(-6)} ↗
          </a>
        </>
      )}

      {state.kind === "error" && (
        <>
          <h1 className="dev-h1">Something went wrong.</h1>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
            {state.message}
          </p>
          <button
            className="dev-btn dev-btn-secondary"
            style={{ marginTop: 16 }}
            onClick={() => setState({ kind: "input" })}
          >
            start over
          </button>
        </>
      )}
    </div>
  );
}
