import { eventKindGlyph, glyphs } from "@/lib/design/glyphs";
import { PelletMark } from "./pellet-mark";

export type FeedEvent = {
  id: string;
  agentId: string;
  agentLabel: string;
  ts: string; // ISO
  kind: string;
  summary: string;
  txSig: string | null;
  sourceBlock?: number;
  methodologyVersion?: string;
  isPellet?: boolean;
};

type Props = { event: FeedEvent };

// Pure presentational. Card wraps a single event with the box-drawing aesthetic.
// Pellet-authored events render the actual mark inline as the agent glyph; other
// agents get the ▣ glyph in the foreground color.
//
// Wallet provenance (sourceBlock + methodologyVersion) is exposed via the
// article's title attribute — subtle hover surfaces "block N · methodology X"
// without crowding the card chrome.
export function EventCard({ event }: Props) {
  const kindGlyph = eventKindGlyph[event.kind] ?? eventKindGlyph.custom;
  const time = formatTime(event.ts);
  const provenance =
    event.sourceBlock != null && event.methodologyVersion
      ? `block ${event.sourceBlock} · methodology ${event.methodologyVersion}`
      : undefined;

  return (
    <article
      className="border border-border bg-bg transition-colors hover:bg-hover"
      title={provenance}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted">
        <span>{time}</span>
        <span className="inline-flex items-center gap-1">
          <span className="text-accent">{kindGlyph}</span>
          {event.kind}
        </span>
      </header>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {event.isPellet ? (
            <PelletMark size={14} alt="" />
          ) : (
            <span className="text-fg">{glyphs.agent}</span>
          )}
          <span className="text-sm">{event.agentLabel}</span>
        </div>
        <p className="mt-1 pl-6 text-sm text-fg">{event.summary}</p>
        {event.txSig && (
          <a
            href={`https://explore.tempo.xyz/tx/${event.txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 pl-6 text-xs text-muted hover:text-accent"
          >
            <span>{glyphs.txLink}</span>
            <span>tx {short(event.txSig)}</span>
          </a>
        )}
      </div>
    </article>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function short(sig: string): string {
  return `${sig.slice(0, 6)}…${sig.slice(-4)}`;
}
