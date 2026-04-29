import type { Delta } from "@/lib/oli/format";

export type Stat = {
  label: string;
  value: string;
  delta?: Delta;
  hint?: string;
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="oli-stat-strip">
      {stats.map((s) => (
        <div key={s.label} className="oli-stat">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-quaternary)",
            }}
          >
            {s.label}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
            <span className="oli-stat-value" style={{ fontSize: 32, fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {s.value}
            </span>
            {s.delta && s.delta.tone !== "neutral" && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color:
                    s.delta.tone === "positive"
                      ? "var(--color-success)"
                      : "var(--color-error)",
                }}
              >
                {s.delta.display}
              </span>
            )}
          </div>
          {s.hint && (
            <span style={{ marginTop: 4, fontSize: 11, color: "var(--color-text-quaternary)" }}>
              {s.hint}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
