import type { SafetyResult } from "@/lib/types";

const VERDICT_CONFIG: Record<
  SafetyResult["verdict"],
  { label: string; color: string; bg: string; border: string }
> = {
  LOW_RISK: {
    label: "Low Risk",
    color: "var(--color-success)",
    bg: "rgba(48,164,108,0.12)",
    border: "rgba(48,164,108,0.25)",
  },
  CAUTION: {
    label: "Caution",
    color: "var(--color-warning)",
    bg: "rgba(245,166,35,0.10)",
    border: "rgba(245,166,35,0.25)",
  },
  MEDIUM_RISK: {
    label: "Medium Risk",
    color: "var(--color-warning)",
    bg: "rgba(245,166,35,0.10)",
    border: "rgba(245,166,35,0.25)",
  },
  HIGH_RISK: {
    label: "High Risk",
    color: "var(--color-error)",
    bg: "rgba(229,72,77,0.12)",
    border: "rgba(229,72,77,0.25)",
  },
  CRITICAL: {
    label: "Critical",
    color: "var(--color-error)",
    bg: "rgba(229,72,77,0.12)",
    border: "rgba(229,72,77,0.25)",
  },
};

interface SafetyBadgeProps {
  safety: SafetyResult;
}

export default function SafetyBadge({ safety }: SafetyBadgeProps) {
  const cfg = VERDICT_CONFIG[safety.verdict];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Verdict badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "6px",
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: cfg.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 600,
              color: cfg.color,
              letterSpacing: "0.02em",
            }}
          >
            {cfg.label}
          </span>
        </div>

        {/* Score */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}
        >
          score {safety.score}/100
        </span>
      </div>

      {/* Flag chips */}
      {safety.flags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {safety.flags.map((flag) => (
            <span
              key={flag}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-error)",
                background: "rgba(229,72,77,0.12)",
                border: "1px solid rgba(229,72,77,0.25)",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              {flag}
            </span>
          ))}
          {safety.warnings.map((warn) => (
            <span
              key={warn}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-warning)",
                background: "rgba(245,166,35,0.10)",
                border: "1px solid rgba(245,166,35,0.25)",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              {warn}
            </span>
          ))}
        </div>
      )}

      {/* Tradeable status */}
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: safety.can_buy ? "var(--color-success)" : "var(--color-error)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-secondary)",
            }}
          >
            {safety.can_buy ? "buyable" : "not buyable"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: safety.can_sell ? "var(--color-success)" : "var(--color-error)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-secondary)",
            }}
          >
            {safety.can_sell ? "sellable" : "not sellable"}
          </span>
        </div>
      </div>
    </div>
  );
}
