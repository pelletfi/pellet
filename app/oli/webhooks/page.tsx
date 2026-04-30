import type { Metadata } from "next";
import Link from "next/link";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import {
  listWebhooks,
  truncateMiddle,
  filterSummary,
  relativeTime,
} from "@/lib/oli/webhooks";
import { WebhookStatusPill } from "@/components/oli/WebhookStatusPill";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Webhooks — Pellet OLI",
  description:
    "Subscribe to filtered Pellet OLI events. Per-agent, per-recipient, per-token. Signed deliveries with retry.",
};

export default async function OliWebhooksPage() {
  const userId = await readUserSession();
  if (!userId) return <PairCliEmpty />;

  const subs = await listWebhooks();

  return (
    <div className="oli-page">
      <header className="oli-page-header">
        <div>
          <h1 className="oli-page-h1">
            Webhooks
            <span className="oli-page-h1-em">(OLI)</span>
          </h1>
          <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
            Receive signed POSTs when events match your filter. One subscription per
            callback URL is recommended.
          </p>
        </div>
        <Link
          href="/oli/webhooks/new"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            border: "1px solid var(--color-border-default)",
            padding: "8px 14px",
            color: "var(--color-text-primary)",
            textDecoration: "none",
            background: "transparent",
            transition: "background var(--duration-fast) ease",
          }}
        >
          New webhook
        </Link>
      </header>

      {subs.length === 0 ? (
        <EmptyState />
      ) : (
        <WebhooksTable subs={subs} />
      )}
    </div>
  );
}

function WebhooksTable({ subs }: { subs: Awaited<ReturnType<typeof listWebhooks>> }) {
  const cols = "1.6fr 1.4fr 140px 140px";
  return (
    <div className="oli-leaderboard">
      <div className="oli-leaderboard-title">
        <span>{subs.length} subscription{subs.length === 1 ? "" : "s"}</span>
        <span style={{ color: "var(--color-text-quaternary)", fontSize: 11 }}>
          {subs.length} rows
        </span>
      </div>
      <div className="oli-leaderboard-table">
        <div
          className="oli-leaderboard-row oli-leaderboard-header"
          style={{ gridTemplateColumns: cols }}
        >
          <span>callback</span>
          <span>filter</span>
          <span>status</span>
          <span style={{ textAlign: "right" }}>last delivery</span>
        </div>
        {subs.map((s) => (
          <Link
            key={s.id}
            href={`/oli/webhooks/${s.id}`}
            className="oli-leaderboard-link"
          >
            <div className="oli-leaderboard-row" style={{ gridTemplateColumns: cols }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {truncateMiddle(s.callback_url, 28, 18)}
                {s.label && (
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      color: "var(--color-text-quaternary)",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={filterSummary(s.filters)}
              >
                {filterSummary(s.filters)}
              </span>
              <span>
                <WebhookStatusPill status={s.status} />
              </span>
              <span
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {relativeTime(s.last_delivered_at)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: "1px solid var(--color-border-subtle)",
        background: "var(--color-bg-subtle)",
        padding: "48px 24px",
        textAlign: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-quaternary)",
      }}
    >
      No webhooks yet.
    </div>
  );
}

function PairCliEmpty() {
  return (
    <div className="oli-page">
      <header className="oli-page-header">
        <div>
          <h1 className="oli-page-h1">
            Webhooks
            <span className="oli-page-h1-em">(OLI)</span>
          </h1>
        </div>
      </header>
      <div
        style={{
          border: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-subtle)",
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-quaternary)",
          }}
        >
          Pair the CLI first
        </span>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, margin: 0, maxWidth: 420 }}>
          Webhooks are scoped to your wallet session. Sign in with your passkey
          on the Pellet Wallet to manage subscriptions.
        </p>
        <Link
          href="/oli/wallet"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            border: "1px solid var(--color-border-default)",
            padding: "8px 14px",
            color: "var(--color-text-primary)",
            textDecoration: "none",
          }}
        >
          Open wallet
        </Link>
      </div>
    </div>
  );
}
