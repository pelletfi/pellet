import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skills",
  description:
    "A curated index of skill.md manifests relevant to autonomous-agent payments — Pellet, Stripe Link, and emerging entries.",
};

type Skill = {
  id: string;
  name: string;
  vendor: string;
  status: "live" | "watching";
  installUrl: string;
  category: "payments" | "observability" | "infrastructure";
  bio: string;
  shipped: string;
  link: { label: string; href: string };
};

const SKILLS: Skill[] = [
  {
    id: "pellet-wallet",
    name: "Pellet Wallet",
    vendor: "Pellet",
    status: "live",
    installUrl: "https://pellet.network/skill.md#pellet-wallet",
    category: "payments",
    bio: "Agent wallet on Tempo. Pair once with a passkey, set on-chain spending caps, agent pays autonomously within those caps via the Pellet MCP server. Every payment is a signed Tempo tx. Live on Moderato testnet; mainnet pending.",
    shipped: "2026-04-29",
    link: { label: "pellet.network/wallet", href: "/wallet" },
  },
  {
    id: "stripe-link",
    name: "Stripe Link Wallet",
    vendor: "Stripe",
    status: "live",
    installUrl: "https://link.com/skill.md",
    category: "payments",
    bio: "Securely empower agents to spend on the user's behalf via Stripe Link. Payment credentials never exposed; user approves every purchase. Settlement happens on Stripe's traditional rails — private to Stripe, no public ledger.",
    shipped: "2026-04-29",
    link: { label: "link.com/agents", href: "https://link.com/agents" },
  },
];

export default function SkillsPage() {
  const live = SKILLS.filter((s) => s.status === "live");

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>09</span>
            <span>Skills</span>
          </h1>
        </div>
        <div className="spec-page-subhead">
          <span>
            A curated index of <code>skill.md</code> manifests an agent can
            install — anchored on autonomous payments and observability. Whichever
            rail or service publishes a public install URL, we list it here.
          </span>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" style={{ flex: 1 }}>
          <div className="spec-table-header">
            <span className="spec-table-title">LIVE · INSTALLABLE TODAY</span>
            <span className="spec-table-meta">
              <span className="spec-table-meta-faint">ROWS</span>
              <span>{live.length}</span>
            </span>
          </div>
          {live.map((s) => (
            <SkillCard key={s.id} skill={s} />
          ))}
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" style={{ flex: 1 }}>
          <div className="spec-table-header">
            <span className="spec-table-title">
              WATCHING · CATALOGUED AS THEY SHIP
            </span>
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: "16px 0 0",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <li>
              <code>x402</code> endpoints publishing skill manifests for
              agent-direct invocation (Coinbase agent kit, etc.)
            </li>
            <li>
              <code>MCP</code> servers exposing payment flows via{" "}
              <code>skill.md</code> — the natural intersection of the two
              emerging install conventions
            </li>
            <li>
              Per-rail aggregator skills (Tempo MPP, Locus MPP) advertising
              their own install URLs as they mature
            </li>
          </ul>
        </div>
      </section>

      <p
        style={{
          margin: "0 32px 32px",
          fontSize: 12,
          opacity: 0.6,
          letterSpacing: "0.02em",
          maxWidth: 720,
          lineHeight: 1.6,
        }}
      >
        Know one we&apos;re missing? Open an issue at{" "}
        <a
          href="https://github.com/pelletnetwork/pellet/issues"
          style={{ textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          pelletnetwork/pellet
        </a>
        . Bar for inclusion: live install URL, real autonomous-agent use
        case, vendor identifiable.
      </p>
    </>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "16px 0",
        borderTop: "1px solid var(--line-thin)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {skill.name}
          </h3>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            {skill.vendor} · {skill.category}
          </span>
        </div>
      </header>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          opacity: 0.85,
          maxWidth: 720,
        }}
      >
        {skill.bio}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          install
        </span>
        <code
          style={{
            fontVariantNumeric: "tabular-nums",
            wordBreak: "break-all",
          }}
        >
          {skill.installUrl}
        </code>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "baseline",
          fontSize: 12,
        }}
      >
        <a
          href={skill.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "underline",
            textUnderlineOffset: 2,
            opacity: 0.85,
          }}
        >
          view manifest ↗
        </a>
        <a
          href={skill.link.href}
          target={skill.link.href.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          style={{
            textDecoration: "underline",
            textUnderlineOffset: 2,
            opacity: 0.85,
          }}
        >
          {skill.link.label} ↗
        </a>
      </div>
    </article>
  );
}
