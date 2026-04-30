import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skills",
  description:
    "A curated index of skill.md manifests relevant to autonomous-agent payments — Pellet OLI, Stripe Link, and emerging entries.",
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
    id: "pellet-oli",
    name: "Pellet OLI",
    vendor: "Pellet",
    status: "live",
    installUrl: "https://pellet.network/skill.md",
    category: "observability",
    bio: "Query autonomous economic activity on Tempo — live revenue, transaction counts, per-service attribution. Use when an agent or user asks about agent payments, MPP service revenue, gateway routing, or wants to deep-link a tx hash. Backs onto the open /api/oli/* endpoints.",
    shipped: "2026-04-29",
    link: { label: "pellet.network/oli", href: "/oli" },
  },
  {
    id: "pellet-wallet",
    name: "Pellet Wallet",
    vendor: "Pellet",
    status: "live",
    installUrl: "https://pellet.network/skill.md#pellet-wallet",
    category: "payments",
    bio: "Open agent wallet on Tempo. Pair once with a passkey, set on-chain spending caps, agent pays autonomously within those caps via the Pellet MCP server. Every payment is a public Tempo tx with a deep-linkable explorer URL. Live on Moderato testnet; mainnet pending.",
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
  return (
    <div
      className="oli-page oli-skills"
      style={{
        padding: "32px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 880,
      }}
    >
      <header>
        <span className="oli-meth-kicker">Reference</span>
        <h1 className="oli-meth-h1">Skills</h1>
        <p className="oli-meth-lede">
          A curated index of <code className="oli-meth-mono">skill.md</code>{" "}
          manifests an agent can install — anchored on autonomous payments
          and observability. The convention emerged from Anthropic and
          went mainstream when Stripe shipped one for Link the same day
          this page launched. Whichever rail or service publishes a public
          install URL, we list it here.
        </p>
      </header>

      <Section title="Live" subtitle="installable today">
        {SKILLS.filter((s) => s.status === "live").map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </Section>

      <Section title="Watching" subtitle="catalogued as they ship">
        <ul className="oli-skills-watch">
          <li>
            <Mono>x402</Mono> endpoints publishing skill manifests for
            agent-direct invocation (Coinbase agent kit, etc.)
          </li>
          <li>
            <Mono>MCP</Mono> servers exposing payment flows via skill.md —
            the natural intersection of the two emerging install conventions
          </li>
          <li>
            Per-rail aggregator skills (Tempo MPP, Locus MPP) advertising
            their own install URLs as they mature
          </li>
        </ul>
      </Section>

      <p className="oli-meth-foot">
        Know one we're missing? Open an issue at{" "}
        <a
          href="https://github.com/pelletnetwork/pellet/issues"
          className="oli-meth-link"
        >
          pelletnetwork/pellet
        </a>
        . Bar for inclusion: live install URL, real autonomous-agent use
        case, vendor identifiable.
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 8,
          marginBottom: 12,
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-tertiary)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-quaternary)",
          }}
        >
          {subtitle}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <article className="oli-skill-card">
      <header className="oli-skill-card-head">
        <div className="oli-skill-card-id">
          <h3 className="oli-skill-card-name">{skill.name}</h3>
          <span className="oli-skill-card-vendor">
            {skill.vendor} · {skill.category}
          </span>
        </div>
      </header>

      <p className="oli-skill-card-bio">{skill.bio}</p>

      <div className="oli-skill-card-install">
        <span className="oli-skill-card-install-label">install</span>
        <code className="oli-skill-card-install-url">{skill.installUrl}</code>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
        <a
          href={skill.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="oli-rail-card-link"
        >
          view manifest ↗
        </a>
        <a
          href={skill.link.href}
          target={skill.link.href.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="oli-rail-card-link"
        >
          {skill.link.label} ↗
        </a>
      </div>
    </article>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="oli-meth-mono">{children}</code>;
}
