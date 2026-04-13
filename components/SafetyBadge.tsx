import type { SafetyResult } from "@/lib/types";

const VERDICT_CONFIG: Record<
  SafetyResult["verdict"],
  { label: string; color: string; bg: string; border: string }
> = {
  LOW_RISK: {
    label: "Low Risk",
    color: "var(--color-positive)",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  CAUTION: {
    label: "Caution",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  MEDIUM_RISK: {
    label: "Medium Risk",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  HIGH_RISK: {
    label: "High Risk",
    color: "var(--color-negative)",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  CRITICAL: {
    label: "Critical",
    color: "var(--color-negative)",
    bg: "#fef2f2",
    border: "#fecaca",
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
            color: "var(--color-secondary)",
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
                color: "var(--color-negative)",
                background: "#fef2f2",
                border: "1px solid #fecaca",
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
                color: "#d97706",
                background: "#fffbeb",
                border: "1px solid #fde68a",
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
              background: safety.can_buy ? "var(--color-positive)" : "var(--color-negative)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-secondary)",
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
              background: safety.can_sell ? "var(--color-positive)" : "var(--color-negative)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-secondary)",
            }}
          >
            {safety.can_sell ? "sellable" : "not sellable"}
          </span>
        </div>
      </div>
    </div>
  );
}
