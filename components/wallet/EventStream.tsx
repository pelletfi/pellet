"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { decodeEventLine, type LabelMap } from "@/lib/wallet/decode";
import {
  formatTimeAgo,
  shortHash,
  formatBlockNumber,
  formatUsdcAmount,
} from "@/lib/wallet/format";
import type { RecentEventRow } from "@/lib/wallet/queries";
import { ProvenanceBadge } from "./ProvenanceBadge";

// ── Top-level ─────────────────────────────────────────────────────────────

const MAX_EVENTS = 200; // cap memory

export function EventStream({
  events: initialEvents,
  labelMap,
}: {
  events: RecentEventRow[];
  labelMap: LabelMap;
}) {
  const [events, setEvents] = useState<RecentEventRow[]>(initialEvents);
  const [pulseIds, setPulseIds] = useState<Set<number>>(new Set());
  const seen = useRef<Set<number>>(new Set(initialEvents.map((e) => e.id)));

  // SSE live feed gated by NEXT_PUBLIC_LIVE_FEED — disabled by default.
  // Holding open SSE connections runs Vercel functions for the full 60s
  // maxDuration per viewer; with cron only running every 6h the realtime
  // delta is small. Visitors see SSR'd events on each page load. Re-enable
  // by setting NEXT_PUBLIC_LIVE_FEED=1 if/when traffic warrants.
  const liveFeedEnabled = process.env.NEXT_PUBLIC_LIVE_FEED === "1";
  useEffect(() => {
    if (!liveFeedEnabled) return;
    const es = new EventSource("/api/feed");
    es.onmessage = (msg) => {
      try {
        const wire = JSON.parse(msg.data) as RecentEventRow & { ts: string };
        if (seen.current.has(wire.id)) return;
        seen.current.add(wire.id);
        const event: RecentEventRow = { ...wire, ts: new Date(wire.ts) };
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
        // amber pulse for 1.6s
        setPulseIds((prev) => new Set([...prev, event.id]));
        setTimeout(() => {
          setPulseIds((prev) => {
            const next = new Set(prev);
            next.delete(event.id);
            return next;
          });
        }, 1600);
      } catch {
        // malformed payload — skip
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects on transient errors; nothing to do.
    };
    return () => es.close();
  }, [liveFeedEnabled]);

  if (events.length === 0) {
    return (
      <div className="wallet-eventstream-empty">
        no events yet — waiting for the next ingest cycle
      </div>
    );
  }

  return (
    <div className="wallet-eventstream">
      {events.map((e) => (
        <EventRow key={e.id} event={e} labelMap={labelMap} isLive={pulseIds.has(e.id)} />
      ))}
    </div>
  );
}

// ── Row (click-to-expand) ─────────────────────────────────────────────────

function EventRow({
  event,
  labelMap,
  isLive = false,
}: {
  event: RecentEventRow;
  labelMap: LabelMap;
  isLive?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const decoded = decodeEventLine(
    {
      agentId: event.agentId,
      agentLabel: event.agentLabel,
      kind: event.kind,
      counterpartyAddress: event.counterpartyAddress,
      amountWei: event.amountWei,
      tokenAddress: event.tokenAddress,
      ts: event.ts,
    },
    labelMap,
  );

  // For gateway-routed events, show the underlying service in the summary
  // line. Pattern A (address) takes priority; Pattern B (fingerprint) falls
  // back to a label-or-short-fp. Fingerprint labels live in address_labels
  // under the synthetic 'fp_<hex>' key.
  const fpKey = event.routedFingerprint
    ? `fp_${event.routedFingerprint}`.toLowerCase()
    : null;
  const fpLabel = fpKey ? labelMap[fpKey]?.label ?? null : null;
  const routedSuffix = event.routedToAddress
    ? ` → ${event.routedToLabel ?? shortHash(event.routedToAddress)}`
    : event.routedFingerprint
    ? ` → ${fpLabel ?? `fp:${event.routedFingerprint.slice(0, 6)}…${event.routedFingerprint.slice(-4)}`}`
    : "";

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  return (
    <div className={`wallet-event-row${open ? " wallet-event-row-open" : ""}${isLive ? " wallet-event-row-live" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        className="wallet-event-row-header"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleHeaderKeyDown}
        aria-expanded={open}
      >
        <span className="wallet-event-row-chevron" aria-hidden="true">
          ›
        </span>
        <span className="wallet-event-row-time">{formatTimeAgo(event.ts)}</span>
        <span className="wallet-event-row-summary">
          {decoded.summary}
          {routedSuffix && (
            <span className="wallet-event-row-routed">{routedSuffix}</span>
          )}
        </span>
        <a
          href={`https://explore.tempo.xyz/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="wallet-event-row-tx-link"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="wallet-event-row-tx">tx {shortHash(event.txHash)}</span>
        </a>
        <ProvenanceBadge
          sourceBlock={event.sourceBlock}
          methodologyVersion={event.methodologyVersion}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="wallet-event-row-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: {
                duration: 0.35,
                ease: [0.16, 1, 0.3, 1],
              },
              opacity: {
                duration: 0.25,
                ease: [0.16, 1, 0.3, 1],
              },
            }}
          >
            <EventDetailPanel event={event} labelMap={labelMap} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────

type FieldDef = {
  label: string;
  value: string;
  copy?: string | null;
  external?: string;
  sub?: string | null;
};

function EventDetailPanel({
  event,
  labelMap,
}: {
  event: RecentEventRow;
  labelMap: LabelMap;
}) {
  const cpKey = event.counterpartyAddress?.toLowerCase();
  const cpLabel = cpKey ? (labelMap[cpKey]?.label ?? null) : null;
  const cpCategory = cpKey ? (labelMap[cpKey]?.category ?? null) : null;

  const amountDisplay =
    event.amountWei != null
      ? `${formatUsdcAmount(event.amountWei, 6)}${event.tokenAddress ? " · USDC.e" : ""}`
      : "—";

  const routedToKey = event.routedToAddress?.toLowerCase();
  const routedToLabel =
    event.routedToLabel ?? (routedToKey ? labelMap[routedToKey]?.label ?? null : null);

  const fields: FieldDef[] = [
    {
      label: "Agent",
      value: event.agentLabel,
    },
    {
      label: "Counterparty",
      value:
        cpLabel ??
        (event.counterpartyAddress
          ? shortHash(event.counterpartyAddress)
          : "—"),
      copy: event.counterpartyAddress ?? null,
      external: event.counterpartyAddress
        ? `https://explore.tempo.xyz/address/${event.counterpartyAddress}`
        : undefined,
      sub: cpCategory,
    },
    ...(event.routedToAddress
      ? [
          {
            label: "Routed to",
            value: routedToLabel ?? shortHash(event.routedToAddress),
            copy: event.routedToAddress,
            external: `https://explore.tempo.xyz/address/${event.routedToAddress}`,
            sub: routedToLabel ? null : "underlying provider",
          } satisfies FieldDef,
        ]
      : event.routedFingerprint
      ? [
          {
            label: "Routed to",
            value: `fp:${event.routedFingerprint.slice(0, 6)}…${event.routedFingerprint.slice(-4)}`,
            copy: event.routedFingerprint,
            sub: "pattern-b grouping (provider not yet identified)",
          } satisfies FieldDef,
        ]
      : []),
    {
      label: "Amount",
      value: amountDisplay,
    },
    {
      label: "Tx",
      value: shortHash(event.txHash),
      copy: event.txHash,
      external: `https://explore.tempo.xyz/tx/${event.txHash}`,
    },
    {
      label: "Block",
      value: formatBlockNumber(event.sourceBlock),
      external: `https://explore.tempo.xyz/block/${event.sourceBlock}`,
    },
    {
      label: "Kind",
      value: event.kind,
    },
    {
      label: "Provenance",
      value: `methodology ${event.methodologyVersion}`,
      sub: `source block ${formatBlockNumber(event.sourceBlock)}`,
    },
  ];

  return (
    <div className="wallet-event-detail">
      <dl className="wallet-event-detail-fields">
        {fields.map((f, i) => (
          <FieldRow key={f.label} field={f} delay={i * 0.02} />
        ))}
      </dl>
      <RawPayloadDisclosure event={event} />
    </div>
  );
}

// ── Individual field row (animated stagger) ───────────────────────────────

function FieldRow({ field, delay }: { field: FieldDef; delay: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable — silently no-op
    }
  };

  return (
    <motion.div
      className="wallet-event-detail-field-pair"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "contents" }}
    >
      <dt>{field.label}</dt>
      <dd>
        <span>{field.value}</span>

        {field.copy && (
          <button
            type="button"
            className={`wallet-event-detail-action${copied ? " wallet-event-detail-action-copied" : ""}`}
            onClick={() => handleCopy(field.copy!)}
            title="Copy to clipboard"
          >
            {copied ? "copied" : "[copy]"}
          </button>
        )}

        {field.external && (
          <a
            href={field.external}
            target="_blank"
            rel="noopener noreferrer"
            className="wallet-event-detail-action"
            title="View on explorer"
          >
            ↗
          </a>
        )}

        {field.sub && (
          <span className="wallet-event-detail-sub">{field.sub}</span>
        )}
      </dd>
    </motion.div>
  );
}

// ── Raw payload disclosure ────────────────────────────────────────────────

function RawPayloadDisclosure({ event }: { event: RecentEventRow }) {
  const [open, setOpen] = useState(false);

  const payload = {
    txHash: event.txHash,
    sourceBlock: event.sourceBlock,
    kind: event.kind,
    agentId: event.agentId,
    counterpartyAddress: event.counterpartyAddress,
    amountWei: event.amountWei,
    tokenAddress: event.tokenAddress,
    methodologyVersion: event.methodologyVersion,
    ts: event.ts,
  };

  return (
    <div className={`wallet-event-detail-raw${open ? " wallet-event-detail-raw-open" : ""}`}>
      <button
        type="button"
        className="wallet-event-detail-raw-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="wallet-event-detail-raw-toggle-chevron" aria-hidden="true">
          ›
        </span>
        Raw Payload
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
            }}
            style={{ overflow: "hidden" }}
          >
            <pre className="wallet-event-detail-raw-payload">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
