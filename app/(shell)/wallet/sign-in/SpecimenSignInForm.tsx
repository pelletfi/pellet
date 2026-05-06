"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import gsap from "gsap";

type Mode = "signin" | "create";
type State =
  | { kind: "idle" }
  | { kind: "busy"; what: Mode }
  | { kind: "error"; message: string };

export function SpecimenSignInForm({
  basePath = "/wallet",
  returnTo,
}: {
  basePath?: string;
  returnTo?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pairCmd, setPairCmd] = useState<string>(
    "npx -y @pelletnetwork/cli@latest auth start",
  );
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      setPairCmd(
        `PELLET_BASE_URL=${window.location.origin} npx -y @pelletnetwork/cli@latest auth start`,
      );
    }
  }, []);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const targets = [
      el.querySelector(".spec-page-title"),
      el.querySelector(".spec-signin-lede"),
      ...el.querySelectorAll(".spec-signin-bullets li"),
      el.querySelector(".spec-signin-card"),
    ].filter(Boolean);

    const skip = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (skip) return;

    gsap.set(targets, { autoAlpha: 0 });

    const tl = gsap.timeline({ defaults: { duration: 0.6, ease: "power2.out" } });
    tl.to(el.querySelector(".spec-page-title")!, { autoAlpha: 1, y: 0 }, 0)
      .fromTo(el.querySelector(".spec-signin-lede")!, { y: 14 }, { autoAlpha: 1, y: 0 }, 0.1)
      .fromTo(el.querySelectorAll(".spec-signin-bullets li"), { y: 14 }, { autoAlpha: 1, y: 0, stagger: 0.08 }, 0.2)
      .fromTo(el.querySelector(".spec-signin-card")!, { y: 20 }, { autoAlpha: 1, y: 0 }, 0.15);

    return () => { tl.kill(); };
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
      window.location.href = returnTo ?? `${basePath}/dashboard`;
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
      window.location.href = returnTo ?? `${basePath}/dashboard`;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const busy = state.kind === "busy";
  const isSignIn = mode === "signin";

  return (
    <div ref={shellRef} className="spec-signin-shell">
      <section className="spec-signin-explain">
        <h1 className="spec-page-title">
          <span>Wallet</span>
          <span className="spec-page-title-em">— sign in</span>
        </h1>
        <p className="spec-signin-lede">
          Self-custody wallet on Tempo. Your address is bound to a passkey on
          your device — Touch ID, Face ID, or a hardware key. Every payment is
          a signed transaction on Tempo.
        </p>
        <ul className="spec-signin-bullets">
          <li>
            <span className="spec-signin-bullet-num">01</span>
            <span>Connect an agent and set a spending limit for every call.</span>
          </li>
          <li>
            <span className="spec-signin-bullet-num">02</span>
            <span>Every payment is signed by your passkey — no shared secrets.</span>
          </li>
          <li>
            <span className="spec-signin-bullet-num">03</span>
            <span>Revoke access to any agent instantly. Everything is on-chain.</span>
          </li>
          <li>
            <span className="spec-signin-bullet-num">04</span>
            <span>Chat with connected agents directly from your wallet.</span>
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
