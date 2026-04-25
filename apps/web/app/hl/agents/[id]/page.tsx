import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "../../../(components)/Footer";
import { SiteHeader } from "../../../(components)/SiteHeader";
import { explorerAddressUrl } from "@/lib/hl/addresses";
import {
  getAgentById,
  listAttestationsForAgent,
  listValidationsForAgent,
  type AttestationRow,
  type ValidationRow,
} from "@/lib/hl/queries";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

function shortAddr(addr: string): string {
  if (!addr.startsWith("0x") || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function shortHash(hash: string): string {
  if (!hash.startsWith("0x") || hash.length < 12) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function shortHostname(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return uri.length > 36 ? `${uri.slice(0, 32)}…` : uri;
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

function fmtIso(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export default async function AgentProfile({ params }: PageProps) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const agent = await getAgentById("mainnet", id);
  if (!agent) notFound();

  // Sequential — HyperEVM rate-limits parallel calls.
  const attestations = await listAttestationsForAgent("mainnet", id);
  const validations = await listValidationsForAgent("mainnet", id);

  return (
    <div className="page">
      <SiteHeader />

      <section className="hl-header">
        <div className="hl-section-label">
          <Link href="/hl" className="hl-breadcrumb">
            ← Registry
          </Link>
        </div>
        <h1 className="hl-title">Agent #{agent.agentId}</h1>
        <p className="hl-lead">
          ERC-8004 agent record on HyperEVM. Controller transferable; metadata mutable by
          controller. Reputation and validation history is append-only.
        </p>
      </section>

      <section className="hl-section">
        <dl className="hl-record">
          <Field label="Controller">
            <a
              className="addr-link"
              href={explorerAddressUrl(agent.controller)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="addr-long">{agent.controller}</span>
              <span className="addr-short">{shortAddr(agent.controller)}</span>
            </a>
          </Field>
          <Field label="Registered">
            <span>{fmtIso(agent.registeredAt)}</span>
            <span className="hl-muted hl-time-ago">· {timeAgo(agent.registeredAt)}</span>
          </Field>
          <Field label="Metadata URI">
            {agent.metadataURI ? (
              <a
                className="addr-link"
                href={agent.metadataURI}
                target="_blank"
                rel="noopener noreferrer"
              >
                {agent.metadataURI} ↗
              </a>
            ) : (
              <span className="hl-muted">— (empty)</span>
            )}
          </Field>
        </dl>
      </section>

      <section className="hl-section">
        <div className="hl-table-head">
          <h3>Attestations</h3>
          <span className="hl-meta">
            {attestations.length} posted to this agent
          </span>
        </div>
        <AttestationsTable rows={attestations} />
      </section>

      <section className="hl-section">
        <div className="hl-table-head">
          <h3>Validations</h3>
          <span className="hl-meta">
            {validations.length} posted of this agent
          </span>
        </div>
        <ValidationsTable rows={validations} />
      </section>

      <Footer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hl-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function AttestationsTable({ rows }: { rows: AttestationRow[] }) {
  if (rows.length === 0) {
    return <div className="hl-empty">No attestations yet.</div>;
  }
  return (
    <table className="hl-table">
      <thead>
        <tr>
          <th className="idx">#</th>
          <th className="name">Attester</th>
          <th className="meta">Type</th>
          <th className="meta">Score</th>
          <th className="time">Posted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.attestationId}>
            <td className="idx">#{row.attestationId}</td>
            <td className="name">
              <a
                className="addr-link"
                href={explorerAddressUrl(row.attester)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="addr-long">{row.attester}</span>
                <span className="addr-short">{shortAddr(row.attester)}</span>
              </a>
            </td>
            <td className="meta">
              <span className="hl-mono">{shortHash(row.attestationType)}</span>
            </td>
            <td className="meta">{row.score}</td>
            <td className="time">{timeAgo(row.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ValidationsTable({ rows }: { rows: ValidationRow[] }) {
  if (rows.length === 0) {
    return <div className="hl-empty">No validations yet.</div>;
  }
  return (
    <table className="hl-table">
      <thead>
        <tr>
          <th className="idx">#</th>
          <th className="name">Validator</th>
          <th className="meta">Claim</th>
          <th className="meta">Proof</th>
          <th className="time">Posted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.validationId}>
            <td className="idx">#{row.validationId}</td>
            <td className="name">
              <a
                className="addr-link"
                href={explorerAddressUrl(row.validator)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="addr-long">{row.validator}</span>
                <span className="addr-short">{shortAddr(row.validator)}</span>
              </a>
            </td>
            <td className="meta">
              <span className="hl-mono">{shortHash(row.claimHash)}</span>
            </td>
            <td className="meta">
              {row.proofURI ? (
                <a
                  className="addr-link"
                  href={row.proofURI}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shortHostname(row.proofURI)} ↗
                </a>
              ) : (
                <span className="hl-muted">—</span>
              )}
            </td>
            <td className="time">{timeAgo(row.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
