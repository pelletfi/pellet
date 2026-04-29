import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rails",
  description:
    "Pellet OLI tracks the agent economy across payment rails. Tempo MPP is indexed live; other rails (Stripe Link, x402, MCP-native) are catalogued as they ship.",
};

type Rail = {
  id: string;
  name: string;
  vendor: string;
  status: "indexed" | "documented" | "watching";
  protocol: string;
  settlement: string;
  observability: string;
  pelletCoverage: string;
  shipped: string;
  link: { label: string; href: string };
  bio: string;
};

const RAILS: Rail[] = [
  {
    id: "tempo-mpp",
    name: "Tempo MPP",
    vendor: "Tempo",
    status: "indexed",
    protocol: "x402 + MPP request envelope",
    settlement: "USDC.e / USDT0 on Tempo (chainId 4217)",
    observability: "public on-chain ledger; per-event provenance",
    pelletCoverage:
      "Live. Transfer events ingested hourly; gateway routing recovered via Settlement event (Pattern A) + calldata fingerprint (Pattern B). ~100% coverage of gateway txs by group.",
    shipped: "2025",
    link: { label: "tempo.xyz/mpp", href: "https://tempo.xyz/mpp" },
    bio: "Stable-native payment rail with native HTTP 402 challenge/response. Each request advertises a recipient, currency, escrow contract; agents settle on-chain and the response unlocks. The Tempo MPP Gateway aggregates ~17 underlying providers (Anthropic, OpenAI, Gemini, Modal, fal.ai, etc.) behind a single settlement address.",
  },
  {
    id: "stripe-link",
    name: "Stripe Link Wallet for Agents",
    vendor: "Stripe",
    status: "documented",
    protocol: "Stripe Link + skill.md install convention",
    settlement: "Card / bank rails wrapped for agents; private",
    observability: "Stripe-only — no public ledger",
    pelletCoverage:
      "None. Settlement happens off-chain inside Stripe's network; not externally indexable. Pellet documents the rail's existence and links to canonical sources, but cannot surface live volumes.",
    shipped: "2026-04-29",
    link: { label: "link.com/agents", href: "https://link.com/agents" },
    bio: "Launched the same day as this page. Agents call Link with payment credentials approved per-purchase by the user. Skill installable via `link.com/skill.md` — the convention Anthropic seeded that's now an emerging install standard for agent capabilities.",
  },
  {
    id: "x402-direct",
    name: "x402 (direct, off-Tempo)",
    vendor: "Coinbase + community",
    status: "watching",
    protocol: "HTTP 402 + EIP-3009 transferWithAuthorization",
    settlement: "USDC on Base, Optimism, Polygon, etc.",
    observability: "public on-chain (chain-by-chain)",
    pelletCoverage:
      "Watching. Each chain that sees meaningful x402 activity is a candidate for an OLI rail expansion — same Pellet methodology applies (decode Transfers, attribute via tx context).",
    shipped: "2024",
    link: { label: "x402.org", href: "https://x402.org" },
    bio: "The protocol underneath both Tempo MPP and Coinbase's agent payment kit. Open spec. Chain-agnostic. As more agents bypass aggregators and call x402 endpoints directly on Base/Optimism/etc., those flows become Pellet-indexable too.",
  },
  {
    id: "mcp-native",
    name: "MCP-native payments",
    vendor: "Anthropic ecosystem",
    status: "watching",
    protocol: "Model Context Protocol — payment-capable servers",
    settlement: "Provider-defined (varies)",
    observability: "Provider-dependent",
    pelletCoverage:
      "Watching. MCP servers that ship payment flows can settle on whatever rail they choose — some will be on-chain, some won't. Where there's a public ledger, the Pellet methodology applies.",
    shipped: "ongoing",
    link: { label: "modelcontextprotocol.io", href: "https://modelcontextprotocol.io" },
    bio: "Not a payment rail itself — a discovery + invocation protocol that payment-aware servers ride. As agents adopt MCP for tool use, pay-per-call MCP servers will follow. Pellet would index whichever ones settle to public ledgers.",
  },
];

export default function RailsPage() {
  return (
    <div
      className="oli-page oli-rails"
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
        <h1 className="oli-meth-h1">Rails</h1>
        <p className="oli-meth-lede">
          Pellet OLI is rail-neutral. Wherever agent payments settle to a
          public ledger, the same methodology applies: ingest events, match
          to watched entities, attribute routing, surface provenance. Below
          is the current map of payment rails relevant to autonomous agents
          — what we index live, what we document, what we're watching.
        </p>
      </header>

      <div className="oli-rails-list">
        {RAILS.map((rail) => (
          <RailCard key={rail.id} rail={rail} />
        ))}
      </div>

      <p className="oli-meth-foot">
        Missing a rail? Open an issue at{" "}
        <a
          href="https://github.com/pelletnetwork/pellet/issues"
          className="oli-meth-link"
        >
          pelletnetwork/pellet
        </a>
        . The bar for inclusion: it carries autonomous-agent payments and is
        either indexed, documented, or worth catalogueing.
      </p>
    </div>
  );
}

function RailCard({ rail }: { rail: Rail }) {
  return (
    <article className="oli-rail-card">
      <header className="oli-rail-card-head">
        <div className="oli-rail-card-id">
          <h2 className="oli-rail-card-name">{rail.name}</h2>
          <span className="oli-rail-card-vendor">{rail.vendor}</span>
        </div>
        <StatusBadge status={rail.status} />
      </header>

      <p className="oli-rail-card-bio">{rail.bio}</p>

      <dl className="oli-rail-card-fields">
        <Field label="Protocol" value={rail.protocol} />
        <Field label="Settlement" value={rail.settlement} />
        <Field label="Observability" value={rail.observability} />
        <Field label="Pellet coverage" value={rail.pelletCoverage} accent />
        <Field label="Shipped" value={rail.shipped} />
      </dl>

      <a
        href={rail.link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="oli-rail-card-link"
      >
        {rail.link.label} ↗
      </a>
    </article>
  );
}

function StatusBadge({ status }: { status: Rail["status"] }) {
  const labels: Record<Rail["status"], string> = {
    indexed: "INDEXED · LIVE",
    documented: "DOCUMENTED",
    watching: "WATCHING",
  };
  return <span className={`oli-rail-status oli-rail-status-${status}`}>{labels[status]}</span>;
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="oli-rail-field">
      <dt>{label}</dt>
      <dd className={accent ? "oli-rail-field-accent" : undefined}>{value}</dd>
    </div>
  );
}
