import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { providerDetail } from "@/lib/oli/queries";
import {
  fmtUsdCompact,
  fmtUsdExact,
  Sparkline,
} from "@/components/specimen/dashboard-charts";
import { SpecimenSettlementRow } from "@/components/oli/SpecimenSettlementRow";

export const dynamic = "force-dynamic";

const USDCE_ADDR = "0x20c000000000000000000000b9537d11c60e8b50";
const USDT0_ADDR = "0x20c00000000000000000000014f22ca97301eb73";
const EXPLORER = "https://explore.testnet.tempo.xyz";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}
function tokenSymbol(addr: string | null): string {
  if (!addr) return "—";
  const a = addr.toLowerCase();
  if (a === USDCE_ADDR) return "USDC.e";
  if (a === USDT0_ADDR) return "USDT0";
  return "TOKEN";
}
function timeAgoShort(d: Date | null): string {
  if (!d) return "—";
  const ago = Date.now() - d.getTime();
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function fmtAmount(wei: string | null, addr: string | null): string {
  if (!wei) return "—";
  const sym = tokenSymbol(addr);
  const usd = Number(wei) / 1_000_000;
  if (!Number.isFinite(usd)) return sym;
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)} ${sym}`;
  return `$${usd.toFixed(4)} ${sym}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const key = decodeURIComponent(address).toLowerCase();
  const detail = await providerDetail(key);
  if (!detail) return { title: "Provider not found" };
  const display = detail.label
    ? detail.label
    : detail.kind === "address" && detail.address
    ? shortAddr(detail.address)
    : `fp:${detail.fingerprint?.slice(0, 6)}…${detail.fingerprint?.slice(-4)}`;
  return {
    title: `${display} — routed provider`,
    description: detail.label
      ? `Underlying provider ${display} routed via the Tempo MPP Gateway.`
      : "Underlying provider attributed via the Tempo MPP Gateway.",
  };
}

export default async function OliProviderDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const key = decodeURIComponent(address).toLowerCase();
  const detail = await providerDetail(key);
  if (!detail) notFound();

  const display = detail.label
    ? detail.label
    : detail.kind === "address" && detail.address
    ? shortAddr(detail.address)
    : `fp:${detail.fingerprint?.slice(0, 6)}…${detail.fingerprint?.slice(-4)}`;

  const trend7d = detail.trend.slice(-168);
  const sparkValues = trend7d.length > 1
    ? trend7d.map((t) => Number(t.amountWei) / 1_000_000)
    : [0, 0];
  const peakBucket = detail.trend.reduce(
    (acc, t) => Math.max(acc, Number(t.amountWei) / 1_000_000),
    0,
  );
  const lifetimeUsd = Number(detail.amountSumWei) / 1_000_000;
  const usd24h = Number(detail.amountSumWei24h) / 1_000_000;

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>03</span>
            <span>{display}</span>
            <span className="spec-page-title-em">— routed provider</span>
          </h1>
          <Link href="/oli/services" className="spec-switch">
            <span className="spec-switch-seg">← SERVICES</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          {detail.kind === "address" && detail.address ? (
            <>
              <span className="spec-page-subhead-label">ADDRESS</span>
              <a
                href={`${EXPLORER}/address/${detail.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontVariantNumeric: "tabular-nums",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                {detail.address}
              </a>
              {detail.category && (
                <>
                  <span className="spec-page-subhead-dot">·</span>
                  <span>{detail.category}</span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="spec-page-subhead-label">FINGERPRINT</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                0x{detail.fingerprint}
              </span>
              <span className="spec-page-subhead-dot">·</span>
              <span>pattern-b grouping (provider not yet identified)</span>
            </>
          )}
        </div>
      </section>

      <section className="spec-strip">
        <div className="spec-strip-cell">
          <span className="spec-strip-label">REVENUE · LIFETIME</span>
          <span className="spec-strip-value">{fmtUsdCompact(lifetimeUsd)}</span>
          <span className="spec-strip-sub">
            <span>{detail.txCount.toLocaleString()} txs total</span>
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">REVENUE · 24H</span>
          <span className="spec-strip-value">{fmtUsdCompact(usd24h)}</span>
          <span className="spec-strip-sub">
            <span>{detail.txCount24h.toLocaleString()} txs · 24h</span>
            <span className="spec-strip-sub-faint">peak {fmtUsdExact(peakBucket)}/h</span>
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">7D TREND</span>
          <span className="spec-strip-value spec-strip-value-md" style={{ paddingTop: 6 }}>
            <span style={{ display: "inline-block", width: 140 }}>
              <Sparkline values={sparkValues} />
            </span>
          </span>
          <span className="spec-strip-sub">
            <span>{trend7d.length} hourly buckets</span>
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">LAST SEEN</span>
          <span className="spec-strip-value">{timeAgoShort(detail.lastSeen)}</span>
          <span className="spec-strip-sub">
            <span className="spec-strip-sub-faint">
              first seen {timeAgoShort(detail.firstSeen)}
            </span>
          </span>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" data-table="settlements" style={{ flex: 1 }}>
          <div className="spec-table-header">
            <span className="spec-table-title">ROUTED ACTIVITY · LAST 50</span>
            <span className="spec-table-meta">
              <span className="spec-table-meta-faint">ROWS</span>
              <span>{detail.recent.length}</span>
            </span>
          </div>
          <div className="spec-activity-head" style={{ paddingLeft: 24 }}>
            <span style={{ width: 40, flexShrink: 0 }}>T-</span>
            <span style={{ width: 92, flexShrink: 0 }}>TX</span>
            <span style={{ flex: 1, minWidth: 0 }}>MEMO</span>
            <span style={{ width: 110, flexShrink: 0 }} className="spec-cell-r">
              AMOUNT
            </span>
            <span style={{ width: 86, flexShrink: 0 }} className="spec-cell-r">
              SERVICE
            </span>
            <span style={{ width: 50, flexShrink: 0 }} className="spec-cell-r">
              STATUS
            </span>
          </div>
          {detail.recent.map((ev) => (
            <SpecimenSettlementRow
              key={ev.id}
              ev={{
                id: ev.id,
                ts: ev.ts.toISOString(),
                agentId: ev.agentId,
                agentLabel: ev.agentLabel,
                counterpartyAddress: ev.counterpartyAddress,
                counterpartyLabel: ev.counterpartyLabel,
                routedToAddress: ev.routedToAddress,
                routedToLabel: ev.routedToLabel,
                routedFingerprint: ev.routedFingerprint,
                kind: ev.kind,
                amountWei: ev.amountWei,
                tokenAddress: ev.tokenAddress,
                txHash: ev.txHash,
                sourceBlock: ev.sourceBlock,
                methodologyVersion: ev.methodologyVersion,
              }}
            />
          ))}
        </div>
      </section>

      <p
        style={{
          margin: "0 32px 32px",
          fontSize: 11,
          opacity: 0.6,
          letterSpacing: "0.04em",
        }}
      >
        attribution recovered from settlement event topic[2] · escrow 0x33b9…4f25 ·{" "}
        <Link href="/oli/methodology" className="spec-prose-link">
          methodology
        </Link>
      </p>
    </>
  );
}
