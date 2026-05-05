import { eventDetail } from "@/lib/oli/queries";
import { formatBlockNumber, formatUsdcAmount, shortHash, shortAddress } from "@/lib/oli/format";
import { decodeEventLine } from "@/lib/oli/decode";
import { buildLabelMap } from "@/lib/oli/labelMap";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TEMPO_EXPLORER_URL } from "@/lib/wallet/tempo-config";

const EXPLORER = TEMPO_EXPLORER_URL;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await eventDetail(Number(id));
  if (!detail) return { title: "Event not found — Pellet OLI" };
  const labelMap = await buildLabelMap();
  const decoded = decodeEventLine(
    {
      agentId: detail.agentId,
      agentLabel: detail.agentLabel,
      kind: detail.kind,
      counterpartyAddress: detail.counterpartyAddress,
      amountWei: detail.amountWei,
      tokenAddress: detail.tokenAddress,
      ts: detail.ts,
    },
    labelMap,
  );
  const title = `${decoded.summary} — Pellet OLI`;
  return {
    title,
    description: `Event #${detail.id} on Tempo · block ${detail.sourceBlock} · ${detail.methodologyVersion}`,
    openGraph: {
      title,
      description: `Decoded autonomous economic event on Tempo, captured by Pellet OLI methodology ${detail.methodologyVersion}.`,
      url: `https://pellet.network/oli/event/${detail.id}`,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description: `Event #${detail.id} on Tempo · ${detail.methodologyVersion}`,
    },
  };
}

export default async function OliEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const [detail, labelMap] = await Promise.all([
    eventDetail(numericId),
    buildLabelMap(),
  ]);
  if (!detail) notFound();

  const decoded = decodeEventLine(
    {
      agentId: detail.agentId,
      agentLabel: detail.agentLabel,
      kind: detail.kind,
      counterpartyAddress: detail.counterpartyAddress,
      amountWei: detail.amountWei,
      tokenAddress: detail.tokenAddress,
      ts: detail.ts,
    },
    labelMap,
  );

  const counterpartyDisplay =
    detail.counterpartyLabel ??
    (detail.counterpartyAddress ? shortAddress(detail.counterpartyAddress) : null);
  const routedDisplay = detail.routedToAddress
    ? detail.routedToLabel ?? shortAddress(detail.routedToAddress)
    : null;

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>01</span>
            <span>Event</span>
            <span className="spec-page-title-em">— #{detail.id}</span>
          </h1>
          <Link href="/oli" className="spec-switch">
            <span className="spec-switch-seg">← LEDGER</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          <span>{decoded.summary}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {detail.ts.toUTCString()}
          </span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">METHODOLOGY</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {detail.methodologyVersion}
          </span>
        </div>
      </section>

      <section className="spec-kpi-stack">
        <div className="spec-kpi-card">
          <span className="spec-strip-label">AMOUNT</span>
          <span className="spec-strip-value spec-strip-value-md">
            {detail.amountWei ? formatUsdcAmount(detail.amountWei, 6) : "—"}
          </span>
          <span className="spec-strip-sub">
            {detail.tokenAddress ? (
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                token {shortAddress(detail.tokenAddress)}
              </span>
            ) : (
              <span className="spec-strip-sub-faint">no token</span>
            )}
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">KIND</span>
          <span className="spec-strip-value spec-strip-value-md">{detail.kind}</span>
          <span className="spec-strip-sub">
            <span>decoded event class</span>
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">BLOCK</span>
          <span className="spec-strip-value spec-strip-value-md">
            {formatBlockNumber(detail.sourceBlock)}
          </span>
          <span className="spec-strip-sub">
            <a
              href={`${EXPLORER}/block/${detail.sourceBlock}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              explorer ↗
            </a>
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">LOG INDEX</span>
          <span className="spec-strip-value spec-strip-value-md">{detail.logIndex}</span>
          <span className="spec-strip-sub">
            <span>position in tx</span>
          </span>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" style={{ flex: 1 }}>
          <div className="spec-table-header">
            <span className="spec-table-title">PARTIES</span>
          </div>
          <div className="spec-meta-grid spec-meta-grid-wide" style={{ paddingTop: 12 }}>
            <span className="spec-meta-label">agent</span>
            <span>
              <Link
                href={`/oli/agents/${detail.agentId}`}
                style={{ textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                {detail.agentLabel}
              </Link>
              {detail.agentBio && (
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 11,
                    opacity: 0.6,
                  }}
                >
                  {detail.agentBio}
                </span>
              )}
            </span>

            <span className="spec-meta-label">counterparty</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {counterpartyDisplay ?? <span style={{ opacity: 0.55 }}>—</span>}
              {detail.counterpartyAddress && (
                <a
                  href={`${EXPLORER}/address/${detail.counterpartyAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: 8,
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    opacity: 0.7,
                  }}
                >
                  explorer ↗
                </a>
              )}
              {detail.counterpartyCategory && (
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 11,
                    opacity: 0.55,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  category: {detail.counterpartyCategory}
                </span>
              )}
            </span>

            {routedDisplay && (
              <>
                <span className="spec-meta-label">routed to</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {routedDisplay}
                  {detail.routedToAddress && (
                    <a
                      href={`${EXPLORER}/address/${detail.routedToAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginLeft: 8,
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                        opacity: 0.7,
                      }}
                    >
                      explorer ↗
                    </a>
                  )}
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 11,
                      opacity: 0.55,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {detail.routedToCategory
                      ? `category: ${detail.routedToCategory}`
                      : "underlying provider"}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" style={{ flex: 1 }}>
          <div className="spec-table-header">
            <span className="spec-table-title">TRANSACTION</span>
          </div>
          <div className="spec-meta-grid spec-meta-grid-wide" style={{ paddingTop: 12 }}>
            <span className="spec-meta-label">hash</span>
            <span style={{ fontVariantNumeric: "tabular-nums", wordBreak: "break-all" }}>
              {detail.txHash}
              <a
                href={`${EXPLORER}/tx/${detail.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 8,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  opacity: 0.7,
                }}
              >
                explorer ↗
              </a>
            </span>

            <span className="spec-meta-label">matched at</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {detail.matchedAt.toUTCString()}
            </span>
          </div>
        </div>
      </section>

      {detail.related.length > 0 && (
        <section className="spec-tables">
          <div className="spec-table" style={{ flex: 1 }}>
            <div className="spec-table-header">
              <span className="spec-table-title">
                RELATED EVENTS · SAME TX
              </span>
              <span className="spec-table-meta">
                <span className="spec-table-meta-faint">ROWS</span>
                <span>{detail.related.length}</span>
              </span>
            </div>
            <div className="spec-row-head">
              <span style={{ width: 60, flexShrink: 0 }}>#</span>
              <span style={{ flex: 1, minWidth: 0 }}>AGENT</span>
              <span style={{ width: 86, flexShrink: 0 }} className="spec-cell-r">
                KIND
              </span>
              <span style={{ width: 110, flexShrink: 0 }} className="spec-cell-r">
                AMOUNT
              </span>
              <span style={{ flex: 1, minWidth: 0, marginLeft: 16 }}>
                COUNTERPARTY
              </span>
            </div>
            {detail.related.map((r) => (
              <Link key={r.id} href={`/oli/event/${r.id}`} className="spec-row">
                <span style={{ width: 60, flexShrink: 0 }}>#{r.id}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.agentLabel}
                </span>
                <span
                  style={{ width: 86, flexShrink: 0, opacity: 0.7 }}
                  className="spec-cell-r"
                >
                  {r.kind}
                </span>
                <span
                  style={{ width: 110, flexShrink: 0 }}
                  className="spec-cell-r"
                >
                  {r.amountWei ? formatUsdcAmount(r.amountWei, 6) : "—"}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    marginLeft: 16,
                    opacity: 0.7,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.counterpartyLabel ?? "—"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
