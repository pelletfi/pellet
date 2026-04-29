// /agents — placeholder. Will be rewritten with the agent-feed surface
// once the live terminal aesthetic gets rebuilt. For now it links back to
// the landing and sits in the nav.
export const metadata = {
  title: "Pellet — Agents",
};

export default function AgentsPage() {
  return (
    <div className="page-container-narrow">
      <h1
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 40,
          fontWeight: 400,
          letterSpacing: "-0.025em",
          margin: "0 0 24px",
        }}
      >
        Agents
      </h1>
      <p style={{ color: "var(--color-text-secondary)", maxWidth: 560 }}>
        The canonical interface for autonomous agent activity on Tempo. Live feed,
        OLI provenance on every event, methodology-versioned for re-verification.
      </p>
      <p
        style={{
          color: "var(--color-text-tertiary)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginTop: 32,
        }}
      >
        v0 — terminal aesthetic rebuild in progress
      </p>
    </div>
  );
}
