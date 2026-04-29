"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { decodeEventLine, type LabelMap } from "@/lib/oli/decode";
import {
  formatTimeAgo,
  shortHash,
  formatBlockNumber,
  formatUsdcAmount,
} from "@/lib/oli/format";
import type { RecentEventRow } from "@/lib/oli/queries";
import { ProvenanceBadge } from "./ProvenanceBadge";
import Link from "next/link";

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

  useEffect(() => {
    const es = new EventSource("/api/oli/feed");
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
  }, []);

  if (events.length === 0) {
    return (
      <div className="oli-eventstream-empty">
        no events yet — waiting for the next ingest cycle
      </div>
    );
  }

  return (
    <div className="oli-eventstream">
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

  // For gateway-routed events, show the underlying service in the summary line.
  const routedSuffix = event.routedToAddress
    ? ` → ${event.routedToLabel ?? shortHash(event.routedToAddress)}`
    : "";

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  return (
    <div className={`oli-event-row${open ? " oli-event-row-open" : ""}${isLive ? " oli-event-row-live" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        className="oli-event-row-header"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleHeaderKeyDown}
        aria-expanded={open}
      >
        <span className="oli-event-row-chevron" aria-hidden="true">
          ›
        </span>
        <span className="oli-event-row-time">{formatTimeAgo(event.ts)}</span>
        <span className="oli-event-row-summary">
          {decoded.summary}
          {routedSuffix && (
            <span className="oli-event-row-routed">{routedSuffix}</span>
          )}
        </span>
        <Link
          href={`/oli/event/${event.id}`}
          className="oli-event-row-tx-link"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="oli-event-row-tx">tx {shortHash(event.txHash)}</span>
        </Link>
        <ProvenanceBadge
          sourceBlock={event.sourceBlock}
          methodologyVersion={event.methodologyVersion}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="oli-event-row-detail"
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
  link?: string;
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
      link: `/oli/agents/${event.agentId}`,
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
    <div className="oli-event-detail">
      <dl className="oli-event-detail-fields">
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
      className="oli-event-detail-field-pair"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "contents" }}
    >
      <dt>{field.label}</dt>
      <dd>
        {field.link ? (
          <a
            href={field.link}
            className="oli-event-detail-action"
            style={{ color: "var(--color-text-primary)", fontSize: 13 }}
          >
            {field.value}
          </a>
        ) : (
          <span>{field.value}</span>
        )}

        {field.copy && (
          <button
            type="button"
            className={`oli-event-detail-action${copied ? " oli-event-detail-action-copied" : ""}`}
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
            className="oli-event-detail-action"
            title="View on explorer"
          >
            ↗
          </a>
        )}

        {field.sub && (
          <span className="oli-event-detail-sub">{field.sub}</span>
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
    <div className={`oli-event-detail-raw${open ? " oli-event-detail-raw-open" : ""}`}>
      <button
        type="button"
        className="oli-event-detail-raw-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="oli-event-detail-raw-toggle-chevron" aria-hidden="true">
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
            <pre className="oli-event-detail-raw-payload">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
