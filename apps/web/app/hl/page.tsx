import Link from "next/link";

import { Footer } from "../(components)/Footer";
import { SiteHeader } from "../(components)/SiteHeader";
import { explorerAddressUrl, HL_REGISTRY_ADDRESSES } from "@/lib/hl/addresses";
import {
  getRegistryStats,
  listAllAgents,
  type AgentRow,
} from "@/lib/hl/queries";

export const revalidate = 60;

const MAINNET = HL_REGISTRY_ADDRESSES.mainnet;

const REGISTRIES = [
  { idx: "01", name: "Anchor", canonical: "Identity", addr: MAINNET.identity, anchor: "#identity" },
  { idx: "02", name: "Mesh", canonical: "Reputation", addr: MAINNET.reputation, anchor: "#reputation" },
  { idx: "03", name: "Cipher", canonical: "Validation", addr: MAINNET.validation, anchor: "#validation" },
];

function shortAddr(addr: string): string {
  if (!addr.startsWith("0x") || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function shortHostname(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return uri.length > 32 ? `${uri.slice(0, 28)}…` : uri;
  }
}

function timeAgo(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default async function RegistryDirectory() {
  // Sequential — HyperEVM RPC rate-limits parallel calls. Each helper is
  // already cached, so post-warmup the second hit is free.
  const stats = await getRegistryStats("mainnet");
  const agents = await listAllAgents("mainnet");

  return (
    <div className="page">
      <SiteHeader />

      <section className="hl-header">
        <div className="hl-section-label">§ Registry</div>
        <h1 className="hl-title">Open Agent Registry</h1>
        <p className="hl-lead">
          Browse every agent registered on Pellet&apos;s ERC-8004 identity, reputation, and
          validation registries on HyperEVM. The data is read directly from chain — no
          indexer, no synthesis, no opinion.
        </p>
      </section>

      <section className="hl-stats">
        <Stat label="Agents" value={stats.totalAgents.toLocaleString()} />
        <Stat label="Attestations" value={stats.totalAttestations.toLocaleString()} />
        <Stat label="Validations" value={stats.totalValidations.toLocaleString()} />
        <Stat label="Block" value={`#${Number(stats.headBlock).toLocaleString()}`} />
      </section>

      <section className="hl-section">
        <div className="hl-table-head">
          <h3>Agents</h3>
          <span className="hl-meta">All registrations · sorted newest first</span>
        </div>
        <AgentsTable rows={agents} />
      </section>

      <section className="hl-section">
        <div className="hl-table-head">
          <h3>Registries</h3>
          <span className="hl-meta">HyperEVM · chain 999 · verified</span>
        </div>
        <table className="hl-table">
          <thead>
            <tr>
              <th className="idx">§</th>
              <th className="name">Registry</th>
              <th className="canonical">Spec</th>
              <th className="addr">Address</th>
              <th className="status">Status</th>
            </tr>
          </thead>
          <tbody>
            {REGISTRIES.map((r) => (
              <tr key={r.idx}>
                <td className="idx">{r.idx}</td>
                <td className="name">
                  <Link href={`/${r.anchor}`}>{r.name}</Link>
                </td>
                <td className="canonical">{r.canonical}</td>
                <td className="addr">
                  <a
                    className="addr-link"
                    href={explorerAddressUrl(r.addr)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on HyperScan"
                  >
                    <span className="addr-long">{r.addr}</span>
                    <span className="addr-short">{shortAddr(r.addr)}</span>
                  </a>
                </td>
                <td className="status">
                  <span className="pellet-dot" style={{ marginRight: 8 }} />
                  Live
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hl-stat">
      <span className="hl-stat-value">{value}</span>
      <span className="hl-stat-label">{label}</span>
    </div>
  );
}

function AgentsTable({ rows }: { rows: AgentRow[] }) {
  if (rows.length === 0) {
    return <div className="hl-empty">No agents registered yet.</div>;
  }
  return (
    <table className="hl-table">
      <thead>
        <tr>
          <th className="idx">#</th>
          <th className="name">Controller</th>
          <th className="meta">Metadata</th>
          <th className="time">Registered</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.agentId}>
            <td className="idx">
              <Link href={`/hl/agents/${row.agentId}`} className="hl-id-link">
                #{row.agentId}
              </Link>
            </td>
            <td className="name">
              <a
                className="addr-link"
                href={explorerAddressUrl(row.controller)}
                target="_blank"
                rel="noopener noreferrer"
                title="View on HyperScan"
              >
                <span className="addr-long">{row.controller}</span>
                <span className="addr-short">{shortAddr(row.controller)}</span>
              </a>
            </td>
            <td className="meta">
              {row.metadataURI ? (
                <a
                  className="addr-link"
                  href={row.metadataURI}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shortHostname(row.metadataURI)} ↗
                </a>
              ) : (
                <span className="hl-muted">—</span>
              )}
            </td>
            <td className="time">{timeAgo(row.registeredAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
