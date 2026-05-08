import type { Metadata } from "next";
import Link from "next/link";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import {
  listWebhooks,
  truncateMiddle,
  filterSummary,
  relativeTime,
} from "@/lib/wallet/webhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Webhooks — Pellet",
  description:
    "Subscribe to filtered Pellet events. Per-agent, per-recipient, per-token. Signed deliveries with retry.",
};

export default async function OliWebhooksPage() {
  const userId = await readUserSession();

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>06</span>
            <span>Webhooks</span>
          </h1>
          <Link href="/webhooks/new" className="spec-switch">
            <span className="spec-switch-seg">+ NEW WEBHOOK</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          <span>
            Receive signed POSTs when events match your filter. One subscription per callback URL is recommended.
          </span>
        </div>
      </section>

      {!userId ? <PairCliEmpty /> : <WebhooksTableWrapper />}
    </>
  );
}

async function WebhooksTableWrapper() {
  const subs = await listWebhooks();
  if (subs.length === 0) return <EmptyState />;

  return (
    <section className="spec-tables">
      <div className="spec-table" data-table="webhooks-list">
        <div className="spec-table-header">
          <span className="spec-table-title">SUBSCRIPTIONS</span>
          <span className="spec-table-meta">
            <span className="spec-table-meta-faint">ROWS</span>
            <span>{subs.length}</span>
          </span>
        </div>
        <div className="spec-row-head">
          <span style={{ width: 24, flexShrink: 0 }}>#</span>
          <span style={{ flex: 1, minWidth: 0 }}>CALLBACK</span>
          <span style={{ width: 160, flexShrink: 0, marginLeft: 24 }}>FILTER</span>
          <span style={{ width: 90, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
            STATUS
          </span>
          <span style={{ width: 80, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
            LAST
          </span>
        </div>
        {subs.map((s, i) => (
          <Link key={s.id} href={`/webhooks/${s.id}`} className="spec-row">
            <span style={{ width: 24, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                whiteSpace: "nowrap",
                display: "inline-flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {truncateMiddle(s.callback_url, 28, 18)}
              </span>
              {s.label && (
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.55,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.label}
                </span>
              )}
            </span>
            <span
              style={{
                width: 160,
                flexShrink: 0,
                marginLeft: 24,
                opacity: 0.7,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={filterSummary(s.filters)}
            >
              {filterSummary(s.filters)}
            </span>
            <span
              style={{ width: 90, flexShrink: 0, marginLeft: 24 }}
              className="spec-cell-r"
            >
              <StatusPill status={s.status} />
            </span>
            <span
              style={{ width: 80, flexShrink: 0, marginLeft: 24, opacity: 0.7 }}
              className="spec-cell-r"
            >
              {relativeTime(s.last_delivered_at)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className="spec-pill">{status.replace(/_/g, " ").toUpperCase()}</span>;
}

function EmptyState() {
  return (
    <section className="spec-tables">
      <div
        className="spec-table"
        style={{
          padding: "48px 24px",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <span style={{ opacity: 0.55, letterSpacing: "0.08em", fontSize: 11 }}>
          NO WEBHOOKS YET
        </span>
        <span style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
          Click <strong>+ NEW WEBHOOK</strong> in the header to subscribe to filtered events.
        </span>
      </div>
    </section>
  );
}

function PairCliEmpty() {
  return (
    <section className="spec-tables">
      <div
        className="spec-table"
        style={{
          padding: "48px 24px",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 14,
        }}
      >
        <span style={{ opacity: 0.55, letterSpacing: "0.08em", fontSize: 11 }}>
          PAIR THE CLI FIRST
        </span>
        <p style={{ fontSize: 13, opacity: 0.85, margin: 0, maxWidth: 420 }}>
          Webhooks are scoped to your wallet session. Sign in with your passkey on the Pellet Wallet to manage subscriptions.
        </p>
        <Link
          href="/wallet/sign-in"
          className="spec-switch"
          style={{ alignSelf: "center", marginTop: 4 }}
        >
          <span className="spec-switch-seg">OPEN WALLET</span>
        </Link>
      </div>
    </section>
  );
}
