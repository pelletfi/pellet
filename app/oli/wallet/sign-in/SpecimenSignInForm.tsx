"use client";

import { useEffect, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type Mode = "signin" | "create";
type State =
  | { kind: "idle" }
  | { kind: "busy"; what: Mode }
  | { kind: "error"; message: string };

export function SpecimenSignInForm({ basePath = "/oli/wallet" }: { basePath?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pairCmd, setPairCmd] = useState<string>(
    "npx -y @pelletnetwork/cli@latest auth start",
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      setPairCmd(
        `PELLET_BASE_URL=${window.location.origin} npx -y @pelletnetwork/cli@latest auth start`,
      );
    }
  }, []);

  const onSignIn = async () => {
    setState({ kind: "busy", what: "signin" });
    try {
      const optsRes = await fetch("/api/wallet/webauthn/auth/options", { method: "POST" });
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
      window.location.href = `${basePath}/dashboard`;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const onCreate = async () => {
    setState({ kind: "busy", what: "create" });
    try {
      const optsRes = await fetch("/api/wallet/webauthn/register/options", { method: "POST" });
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
          message:
            (verify.error ?? "enrollment failed") +
            (verify.detail ? ` (${verify.detail})` : ""),
        });
        return;
      }
      window.location.href = `${basePath}/dashboard`;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const busy = state.kind === "busy";
  const isSignIn = mode === "signin";

  return (
    <div className="spec-signin-shell">
      <section className="spec-signin-explain">
        <h1 className="spec-page-title">
          <span>Wallet</span>
          <span className="spec-page-title-em">— sign in</span>
        </h1>
        <p className="spec-signin-lede">
          Self-custody wallet on Tempo. Your address is bound to a passkey on
          your device — Touch ID, Face ID, or a hardware key. Every payment is
          a signed transaction recorded to the open ledger.
        </p>
        <ul className="spec-signin-bullets">
          <li>
            <span className="spec-signin-bullet-num">01</span>
            <span>Pair an agent with a per-call spend cap and an expiry.</span>
          </li>
          <li>
            <span className="spec-signin-bullet-num">02</span>
            <span>Each call signs against your passkey and posts to Tempo.</span>
          </li>
          <li>
            <span className="spec-signin-bullet-num">03</span>
            <span>Revoke any session instantly. Every spend is on-chain.</span>
          </li>
        </ul>
      </section>

      <section className="spec-signin-card">
        <div className="spec-signin-card-head">
          <span className="spec-signin-card-label">
            {isSignIn ? "RETURNING" : "NEW"}
          </span>
          <div className="spec-signin-tabs" role="tablist" aria-label="Auth mode">
            <button
              role="tab"
              type="button"
              aria-selected={isSignIn}
              className={`spec-signin-tab${isSignIn ? " spec-signin-tab-active" : ""}`}
              onClick={() => {
                setMode("signin");
                setState({ kind: "idle" });
              }}
              disabled={busy}
            >
              SIGN IN
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={!isSignIn}
              className={`spec-signin-tab${!isSignIn ? " spec-signin-tab-active" : ""}`}
              onClick={() => {
                setMode("create");
                setState({ kind: "idle" });
              }}
              disabled={busy}
            >
              CREATE
            </button>
          </div>
        </div>

        <h2 className="spec-signin-h2">
          {isSignIn ? "Sign in with passkey" : "Create a new wallet"}
        </h2>
        <p className="spec-signin-sub">
          {isSignIn
            ? "Authenticate with the passkey you enrolled at pairing time."
            : "Enroll a fresh passkey. The wallet address is derived from its public key — only this passkey can spend from it."}
        </p>

        <button
          type="button"
          onClick={isSignIn ? onSignIn : onCreate}
          disabled={busy}
          className="spec-signin-cta"
        >
          {state.kind === "busy"
            ? "WAITING FOR PASSKEY…"
            : isSignIn
            ? "SIGN IN"
            : "CREATE WALLET"}
        </button>

        {state.kind === "error" && (
          <div className="spec-signin-error">{state.message}</div>
        )}

        <div className="spec-signin-foot">
          <span className="spec-page-subhead-label">CLI</span>
          <code className="spec-signin-cmd">{pairCmd}</code>
        </div>
      </section>
    </div>
  );
}
