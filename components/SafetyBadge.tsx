import type { SafetyResult } from "@/lib/types";

const VERDICT_CONFIG: Record<
  SafetyResult["verdict"],
  { label: string; color: string; bg: string; border: string }
> = {
  LOW_RISK: {
    label: "Low Risk",
    color: "#4ade80",
    bg: "rgba(74, 222, 128, 0.08)",
    border: "rgba(74, 222, 128, 0.25)",
  },
  CAUTION: {
    label: "Caution",
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.25)",
  },
  MEDIUM_RISK: {
    label: "Medium Risk",
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.25)",
  },
  HIGH_RISK: {
    label: "High Risk",
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.08)",
    border: "rgba(248, 113, 113, 0.25)",
  },
  CRITICAL: {
    label: "Critical",
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.12)",
    border: "rgba(248, 113, 113, 0.4)",
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
              fontFamily: "var(--font-geist-mono), monospace",
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
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "12px",
            color: "#555",
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
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "11px",
                color: "#f87171",
                background: "rgba(248, 113, 113, 0.08)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
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
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "11px",
                color: "#fbbf24",
                background: "rgba(251, 191, 36, 0.08)",
                border: "1px solid rgba(251, 191, 36, 0.2)",
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
              background: safety.can_buy ? "#4ade80" : "#f87171",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "11px",
              color: "#888",
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
              background: safety.can_sell ? "#4ade80" : "#f87171",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "11px",
              color: "#888",
            }}
          >
            {safety.can_sell ? "sellable" : "not sellable"}
          </span>
        </div>
      </div>
    </div>
  );
}
