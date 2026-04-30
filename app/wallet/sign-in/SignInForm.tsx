"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

type State =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "error"; message: string };

export function SignInForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const onSignIn = async () => {
    setState({ kind: "signing" });
    try {
      const optsRes = await fetch("/api/wallet/webauthn/auth/options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("could not start sign-in");
      const opts = await optsRes.json();

      const assertion = await startAuthentication({ optionsJSON: opts });

      const verifyRes = await fetch("/api/wallet/webauthn/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const verify = await verifyRes.json();
      if (!verifyRes.ok || !verify.ok) {
        setState({ kind: "error", message: verify.error ?? "sign-in failed" });
        return;
      }
      // Cookie is set; redirect to dashboard.
      window.location.href = "/wallet/dashboard";
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--color-bg-base)",
        border: "1px solid var(--color-border-subtle)",
        padding: 32,
      }}
    >
      <style>{`
        .si-kicker {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .si-h1 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 32px;
          font-weight: 400;
          margin: 6px 0 12px;
          letter-spacing: -0.02em;
        }
        .si-sub {
          color: var(--color-text-tertiary);
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 24px;
        }
        .si-btn {
          width: 100%;
          padding: 14px;
          background: var(--color-accent);
          border: 0;
          color: #fff;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .si-btn[disabled] { opacity: 0.5; cursor: wait; }
        .si-foot {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-quaternary);
          margin-top: 16px;
        }
        .si-foot a { color: var(--color-accent); text-decoration: none; }
        .si-error {
          margin-top: 12px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-tertiary);
          padding: 10px;
          border: 1px solid var(--color-border-subtle);
        }
      `}</style>

      <span className="si-kicker">Pellet Wallet · Sign in</span>
      <h1 className="si-h1">Sign in with passkey</h1>
      <p className="si-sub">
        Authenticate with the passkey you enrolled at pairing time. Same Touch
        ID / Face ID / hardware key that signs your on-chain authorize calls.
      </p>

      <button
        className="si-btn"
        onClick={onSignIn}
        disabled={state.kind === "signing"}
      >
        {state.kind === "signing" ? "waiting for passkey…" : "sign in"}
      </button>

      {state.kind === "error" && (
        <div className="si-error">{state.message}</div>
      )}

      <p className="si-foot">
        First time? Pair via the CLI: <code>npx -y @pelletnetwork/cli auth start</code>.{" "}
        Already paired? <a href="/wallet/dashboard">Go to dashboard →</a>
      </p>
    </div>
  );
}
