import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { agentDetail } from "@/lib/oli/queries";
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
function timeAgoShort(d: Date): string {
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await agentDetail(id);
  if (!detail.head) return { title: "Agent not found" };
  const title = `${detail.head.label} — agent`;
  return {
    title,
    description: detail.head.bio ?? "Watched agent tracked by Pellet OLI.",
  };
}

export default async function OliAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await agentDetail(id);
  if (!detail.head) notFound();

  const trend24h = detail.trend.slice(-24);
  const trend7d = detail.trend.slice(-168);
  const total30d = detail.trend.reduce(
    (acc, t) => acc + Number(t.amountWei) / 1_000_000,
    0,
  );
  const tx30d = detail.trend.reduce((acc, t) => acc + t.txCount, 0);
  const peakBucket = detail.trend.reduce(
    (acc, t) => Math.max(acc, Number(t.amountWei) / 1_000_000),
    0,
  );
  const tx24h = trend24h.reduce((acc, t) => acc + t.txCount, 0);
  const total24h = trend24h.reduce(
    (acc, t) => acc + Number(t.amountWei) / 1_000_000,
    0,
  );
  const sparkValues = trend7d.length > 1
    ? trend7d.map((t) => Number(t.amountWei) / 1_000_000)
    : [0, 0];
  const walletAddr = detail.head.wallets?.[0] ?? "";

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>04</span>
            <span>{detail.head.label}</span>
            <span className="spec-page-title-em">— agent</span>
          </h1>
          <Link href="/oli/agents" className="spec-switch">
            <span className="spec-switch-seg">← ALL AGENTS</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          {detail.head.bio && (
            <>
              <span>{detail.head.bio}</span>
              <span className="spec-page-subhead-dot">·</span>
            </>
          )}
          <span className="spec-page-subhead-label">WALLET</span>
          {walletAddr ? (
            <a
              href={`${EXPLORER}/address/${walletAddr}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontVariantNumeric: "tabular-nums",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {shortAddr(walletAddr)}
            </a>
          ) : (
            <span style={{ opacity: 0.5 }}>—</span>
          )}
        </div>
      </section>

      <section className="spec-strip">
        <div className="spec-strip-cell">
          <span className="spec-strip-label">SPEND · 24H</span>
          <span className="spec-strip-value">{fmtUsdCompact(total24h)}</span>
          <span className="spec-strip-sub">
            <span>{tx24h.toLocaleString()} txs</span>
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">SPEND · 30D</span>
          <span className="spec-strip-value">{fmtUsdCompact(total30d)}</span>
          <span className="spec-strip-sub">
            <span>{tx30d.toLocaleString()} txs</span>
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
          <span className="spec-strip-label">EVENTS</span>
          <span className="spec-strip-value">{detail.recent.length}</span>
          <span className="spec-strip-sub">
            <span>{detail.recent.length === 0 ? "no recent activity" : "most recent first"}</span>
          </span>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" data-table="settlements" style={{ flex: 1 }}>
          <div className="spec-table-header">
            <span className="spec-table-title">RECENT ACTIVITY</span>
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
    </>
  );
}
