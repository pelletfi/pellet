"use client";

import { useEffect, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type Mode = "signin" | "create";
type State =
  | { kind: "idle" }
  | { kind: "busy"; what: Mode }
  | { kind: "error"; message: string };

export function SignInForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pairCmd, setPairCmd] = useState<string>(
    "npx -y @pelletnetwork/cli@latest auth start",
  );

  useEffect(() => {
    // On localhost, the CLI default (https://pellet.network) won't pair this
    // origin's passkey credential — surface the env override so it's copyable.
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      setPairCmd(
        `PELLET_BASE_URL=${window.location.origin} npx -y @pelletnetwork/cli@latest auth start`,
      );
    }
  }, []);

  const onSignIn = async () => {
    setState({ kind: "busy", what: "signin" });
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
      window.location.href = "/wallet/dashboard";
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onCreate = async () => {
    setState({ kind: "busy", what: "create" });
    try {
      const optsRes = await fetch("/api/wallet/webauthn/register/options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("could not start enrollment");
      const opts = await optsRes.json();

      const attestation = await startRegistration({ optionsJSON: opts });

      const verifyRes = await fetch("/api/wallet/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const verify = await verifyRes.json();
      if (!verifyRes.ok || !verify.ok) {
        setState({
          kind: "error",
          message: (verify.error ?? "enrollment failed") + (verify.detail ? ` (${verify.detail})` : ""),
        });
        return;
      }
      window.location.href = "/wallet/dashboard";
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const busy = state.kind === "busy";
  const isSignIn = mode === "signin";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 440,
        background: "var(--color-bg-base)",
        border: "1px solid var(--color-border-subtle)",
        padding: 32,
      }}
    >
      <style>{styles}</style>

      <span className="si-kicker">Pellet Wallet</span>

      <div className="si-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={isSignIn}
          className={`si-tab ${isSignIn ? "si-tab-active" : ""}`}
          onClick={() => {
            setMode("signin");
            setState({ kind: "idle" });
          }}
          disabled={busy}
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={!isSignIn}
          className={`si-tab ${!isSignIn ? "si-tab-active" : ""}`}
          onClick={() => {
            setMode("create");
            setState({ kind: "idle" });
          }}
          disabled={busy}
        >
          Create wallet
        </button>
      </div>

      {isSignIn ? (
        <>
          <h1 className="si-h1">Sign in with passkey</h1>
          <p className="si-sub">
            Authenticate with the passkey you enrolled at pairing time. Same
            Touch ID / Face ID / hardware key that signs your on-chain
            authorize calls.
          </p>
          <button className="si-btn" onClick={onSignIn} disabled={busy}>
            {state.kind === "busy" && state.what === "signin"
              ? "waiting for passkey…"
              : "sign in"}
          </button>
        </>
      ) : (
        <>
          <h1 className="si-h1">Create a new wallet</h1>
          <p className="si-sub">
            Enroll a fresh passkey — Touch ID, Face ID, or a hardware key. Your
            wallet address is derived from the passkey&rsquo;s public key, so
            only this passkey can spend from it. Nothing on-chain happens here;
            you&rsquo;ll authorize agents later from the dashboard or CLI.
          </p>
          <button className="si-btn" onClick={onCreate} disabled={busy}>
            {state.kind === "busy" && state.what === "create"
              ? "waiting for passkey…"
              : "create wallet"}
          </button>
        </>
      )}

      {state.kind === "error" && (
        <div className="si-error">{state.message}</div>
      )}

      <p className="si-foot">
        Need an agent that can pay autonomously? Pair via CLI:{" "}
        <code className="si-cmd">{pairCmd}</code>
      </p>
    </div>
  );
}

const styles = `
  .si-kicker {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-quaternary);
    display: block;
    margin-bottom: 12px;
  }
  .si-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--color-border-subtle);
    border: 1px solid var(--color-border-subtle);
    margin-bottom: 24px;
  }
  .si-tab {
    background: var(--color-bg-base);
    border: 0;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-quaternary);
    cursor: pointer;
    transition: color var(--duration-fast) ease;
  }
  .si-tab:hover:not(:disabled) { color: var(--color-text-secondary); }
  .si-tab:disabled { cursor: not-allowed; opacity: 0.5; }
  .si-tab-active {
    color: var(--color-text-primary);
    background: var(--color-bg-emphasis);
  }
  .si-h1 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 32px;
    font-weight: 400;
    margin: 0 0 12px;
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
    margin: 24px 0 0;
    line-height: 1.5;
  }
  .si-cmd {
    display: inline-block;
    word-break: break-all;
    color: var(--color-text-tertiary);
  }
  .si-error {
    margin-top: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
    padding: 10px;
    border: 1px solid var(--color-border-subtle);
    word-break: break-word;
  }
`;
