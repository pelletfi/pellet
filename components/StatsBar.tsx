interface Stat {
  label: string;
  value: string;
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats-bar">
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            background: "var(--color-bg-subtle)",
            padding: 20,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            {stat.value}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              color: "var(--color-text-quaternary)",
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
