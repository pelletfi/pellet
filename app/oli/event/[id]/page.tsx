import { eventDetail } from "@/lib/oli/queries";
import { formatBlockNumber, formatUsdcAmount, shortHash, shortAddress } from "@/lib/oli/format";
import { decodeEventLine } from "@/lib/oli/decode";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { ProvenanceBadge } from "@/components/oli/ProvenanceBadge";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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

  return (
    <div className="oli-page" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 880 }}>
      <header>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-quaternary)" }}>
          Event #{detail.id}
        </span>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontSize: 36,
            fontWeight: 400,
            margin: "8px 0 0",
            letterSpacing: "-0.015em",
            color: "var(--color-text-primary)",
          }}
        >
          {decoded.summary}
        </h1>
        <p style={{ marginTop: 8, color: "var(--color-text-tertiary)", fontSize: 13, display: "flex", gap: 12, alignItems: "center" }}>
          <span>{detail.ts.toUTCString()}</span>
          <span style={{ color: "var(--color-text-quaternary)" }}>·</span>
          <ProvenanceBadge sourceBlock={detail.sourceBlock} methodologyVersion={detail.methodologyVersion} />
        </p>
      </header>

      <section className="oli-event-page-section">
        <h2 className="oli-event-page-h2">Parties</h2>
        <dl className="oli-event-page-fields">
          <dt>Agent</dt>
          <dd>
            <Link href={`/oli/agents/${detail.agentId}`} className="oli-event-page-link">
              {detail.agentLabel}
            </Link>
            {detail.agentBio && (
              <span style={{ width: "100%", marginTop: 4, fontSize: 11, color: "var(--color-text-quaternary)" }}>
                {detail.agentBio}
              </span>
            )}
          </dd>
          <dt>Counterparty</dt>
          <dd>
            {detail.counterpartyLabel ?? (detail.counterpartyAddress ? shortAddress(detail.counterpartyAddress) : "—")}
            {detail.counterpartyAddress && (
              <a
                href={`https://explore.tempo.xyz/address/${detail.counterpartyAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="oli-event-page-action"
              >
                ↗ explorer
              </a>
            )}
            {detail.counterpartyCategory && (
              <span style={{ fontSize: 11, color: "var(--color-text-quaternary)", fontFamily: "var(--font-mono)" }}>
                category: {detail.counterpartyCategory}
              </span>
            )}
          </dd>
          {detail.routedToAddress && (
            <>
              <dt>Routed to</dt>
              <dd>
                <span style={{ color: "var(--color-accent)" }}>
                  {detail.routedToLabel ?? shortAddress(detail.routedToAddress)}
                </span>
                <a
                  href={`https://explore.tempo.xyz/address/${detail.routedToAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="oli-event-page-action"
                >
                  ↗ explorer
                </a>
                <span style={{ fontSize: 11, color: "var(--color-text-quaternary)", fontFamily: "var(--font-mono)" }}>
                  {detail.routedToCategory ? `category: ${detail.routedToCategory}` : "underlying provider"}
                </span>
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="oli-event-page-section">
        <h2 className="oli-event-page-h2">Transaction</h2>
        <dl className="oli-event-page-fields">
          <dt>Hash</dt>
          <dd>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{shortHash(detail.txHash)}</code>
            <a
              href={`https://explore.tempo.xyz/tx/${detail.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="oli-event-page-action"
            >
              ↗ explorer
            </a>
          </dd>
          <dt>Block</dt>
          <dd>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatBlockNumber(detail.sourceBlock)}</span>
            <a
              href={`https://explore.tempo.xyz/block/${detail.sourceBlock}`}
              target="_blank"
              rel="noopener noreferrer"
              className="oli-event-page-action"
            >
              ↗ explorer
            </a>
          </dd>
          <dt>Log index</dt>
          <dd><span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{detail.logIndex}</span></dd>
          <dt>Kind</dt>
          <dd>{detail.kind}</dd>
          <dt>Amount</dt>
          <dd>
            {detail.amountWei ? formatUsdcAmount(detail.amountWei, 6) : "—"}
            {detail.tokenAddress && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>
                token {shortAddress(detail.tokenAddress)}
              </span>
            )}
          </dd>
        </dl>
      </section>

      <section className="oli-event-page-section">
        <h2 className="oli-event-page-h2">OLI provenance</h2>
        <dl className="oli-event-page-fields">
          <dt>Methodology</dt>
          <dd><code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{detail.methodologyVersion}</code></dd>
          <dt>Source block</dt>
          <dd><span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatBlockNumber(detail.sourceBlock)}</span></dd>
          <dt>Matched at</dt>
          <dd><span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{detail.matchedAt.toUTCString()}</span></dd>
        </dl>
      </section>

      {detail.related.length > 0 && (
        <section className="oli-event-page-section">
          <h2 className="oli-event-page-h2">Related events in this transaction</h2>
          <ul className="oli-event-page-related">
            {detail.related.map((r) => (
              <li key={r.id}>
                <Link href={`/oli/event/${r.id}`} className="oli-event-page-link">
                  #{r.id} · {r.agentLabel} · {r.kind} · {r.amountWei ? formatUsdcAmount(r.amountWei, 6) : "—"}
                  {r.counterpartyLabel && ` ← ${r.counterpartyLabel}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
