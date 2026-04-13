interface Stat {
  label: string;
  value: string;
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1px",
        background: "var(--color-border)",
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            flex: 1,
            background: "var(--color-surface)",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "22px",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "4px",
            }}
          >
            {stat.value}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 500,
              textTransform: "uppercase" as const,
              letterSpacing: "1.5px",
              color: "var(--color-muted)",
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
