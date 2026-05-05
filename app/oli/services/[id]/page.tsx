import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serviceDetail } from "@/lib/oli/queries";
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
  const detail = await serviceDetail(id);
  if (!detail.head) return { title: "Service not found" };
  const title = `${detail.head.label} — MPP service`;
  return {
    title,
    description: detail.head.bio ?? `MPP service tracked by Pellet OLI.`,
  };
}

export default async function OliServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await serviceDetail(id);
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
  const sparkValues = trend7d.length > 1
    ? trend7d.map((t) => Number(t.amountWei) / 1_000_000)
    : [0, 0];
  const tx24h = trend24h.reduce((acc, t) => acc + t.txCount, 0);
  const total24h = trend24h.reduce(
    (acc, t) => acc + Number(t.amountWei) / 1_000_000,
    0,
  );
  const settlementAddr = detail.head.wallets?.[0] ?? "";
  const providersTotal = detail.providers.reduce(
    (acc, p) => acc + Number(p.amountSumWei),
    0,
  );

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>03</span>
            <span>{detail.head.label}</span>
            <span className="spec-page-title-em">— service</span>
          </h1>
          <Link href="/oli/services" className="spec-switch">
            <span className="spec-switch-seg">← ALL SERVICES</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          {detail.head.bio && (
            <>
              <span>{detail.head.bio}</span>
              <span className="spec-page-subhead-dot">·</span>
            </>
          )}
          <span className="spec-page-subhead-label">SETTLEMENT</span>
          {settlementAddr ? (
            <a
              href={`${EXPLORER}/address/${settlementAddr}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontVariantNumeric: "tabular-nums",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {shortAddr(settlementAddr)}
            </a>
          ) : (
            <span style={{ opacity: 0.5 }}>—</span>
          )}
        </div>
      </section>

      <section className="spec-kpi-stack">
        <div className="spec-kpi-card">
          <span className="spec-strip-label">REVENUE · 24H</span>
          <span className="spec-strip-value">{fmtUsdCompact(total24h)}</span>
          <span className="spec-strip-sub">
            <span>{tx24h.toLocaleString()} txs</span>
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">REVENUE · 30D</span>
          <span className="spec-strip-value">{fmtUsdCompact(total30d)}</span>
          <span className="spec-strip-sub">
            <span>{tx30d.toLocaleString()} txs</span>
            <span className="spec-strip-sub-faint">peak {fmtUsdExact(peakBucket)}/h</span>
          </span>
        </div>
        <div className="spec-kpi-card">
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
        <div className="spec-kpi-card">
          <span className="spec-strip-label">PROVIDERS</span>
          <span className="spec-strip-value">{detail.providers.length}</span>
          <span className="spec-strip-sub">
            <span>{detail.providers.length === 0 ? "no underlying providers" : "attributed on-chain"}</span>
          </span>
        </div>
      </section>

      {detail.providers.length > 0 && (
        <section className="spec-tables">
          <div className="spec-table" data-table="providers" style={{ flex: 1 }}>
            <div className="spec-table-header">
              <span className="spec-table-title">UNDERLYING PROVIDERS</span>
              <span className="spec-table-meta">
                <span className="spec-table-meta-faint">ROWS</span>
                <span>{detail.providers.length}</span>
              </span>
            </div>
            <div className="spec-row-head">
              <span style={{ width: 24, flexShrink: 0 }}>#</span>
              <span style={{ flex: 1, minWidth: 0 }}>PROVIDER</span>
              <span style={{ width: 88, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
                REVENUE
              </span>
              <span style={{ width: 56, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
                TXS
              </span>
              <span style={{ width: 56, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
                SHARE
              </span>
              <span style={{ width: 56, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
                LAST
              </span>
            </div>
            {detail.providers.map((p, i) => {
              const rev = Number(p.amountSumWei) / 1_000_000;
              const share = providersTotal > 0
                ? (Number(p.amountSumWei) / providersTotal) * 100
                : 0;
              const display = p.label
                ? p.label
                : p.kind === "address" && p.address
                ? shortAddr(p.address)
                : `fp:${p.fingerprint?.slice(0, 6)}…${p.fingerprint?.slice(-4)}`;
              return (
                <Link key={p.key} href={`/oli/providers/${p.key}`} className="spec-row">
                  <span style={{ width: 24, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {display}
                  </span>
                  <span
                    style={{ width: 88, flexShrink: 0, marginLeft: 24 }}
                    className="spec-cell-r"
                  >
                    {fmtUsdCompact(rev)}
                  </span>
                  <span
                    style={{ width: 56, flexShrink: 0, marginLeft: 24 }}
                    className="spec-cell-r"
                  >
                    {p.txCount.toLocaleString()}
                  </span>
                  <span
                    style={{ width: 56, flexShrink: 0, marginLeft: 24 }}
                    className="spec-cell-r"
                  >
                    {share.toFixed(1)}%
                  </span>
                  <span
                    style={{ width: 56, flexShrink: 0, marginLeft: 24, opacity: 0.7 }}
                    className="spec-cell-r"
                  >
                    {timeAgoShort(p.lastTs)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
