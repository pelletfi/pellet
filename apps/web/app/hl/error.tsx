"use client";

import Link from "next/link";

import { Footer } from "../(components)/Footer";
import { SiteHeader } from "../(components)/SiteHeader";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RegistryError({ error, reset }: ErrorProps) {
  const isRateLimit = /rate limit|exceeds defined limit|-32005/i.test(error.message);
  return (
    <div className="page">
      <SiteHeader />

      <section className="hl-header">
        <div className="hl-section-label">§ Registry · Unavailable</div>
        <h1 className="hl-title">Couldn&apos;t reach the registry.</h1>
        <p className="hl-lead">
          {isRateLimit
            ? "HyperEVM's public RPC is rate-limiting requests right now. The registry data is on-chain and unchanged — this is a read-side hiccup, not a registry issue. Try again in a moment."
            : "Something went wrong fetching the on-chain registry. The data is still there; the read path failed. Try again in a moment."}
        </p>
      </section>

      <section className="hl-section">
        <div className="hl-table-head">
          <h3>Recovery</h3>
          <span className="hl-meta">Two safe options</span>
        </div>
        <div className="hl-empty" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <button type="button" className="hl-id-link" onClick={reset}>
            ↻ Retry
          </button>
          <Link className="hl-id-link" href="/">
            ← Back to home
          </Link>
        </div>
      </section>

      {error.digest && (
        <section className="hl-section">
          <div className="hl-table-head">
            <h3>Diagnostics</h3>
            <span className="hl-meta">For the engineers</span>
          </div>
          <dl className="hl-record">
            <div className="hl-field">
              <dt>Digest</dt>
              <dd>
                <span className="hl-mono">{error.digest}</span>
              </dd>
            </div>
          </dl>
        </section>
      )}

      <Footer />
    </div>
  );
}
