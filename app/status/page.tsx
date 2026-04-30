import type { Metadata } from "next";
import Link from "next/link";
import { tempoClient } from "@/lib/rpc";

export const metadata: Metadata = {
  title: "Status",
  description: "Live system health for Pellet — Tempo RPC reachability, latest block.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Health =
  | { status: "ok"; block: number; rpcUrl: string }
  | { status: "fail"; error: string; rpcUrl: string };

async function readHealth(): Promise<Health> {
  const rpcUrl = process.env.TEMPO_RPC_URL ?? "https://rpc.tempo.xyz";
  try {
    const block = Number(await tempoClient.getBlockNumber());
    return { status: "ok", block, rpcUrl };
  } catch (e) {
    return {
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
      rpcUrl,
    };
  }
}

export default async function StatusPage() {
  const health = await readHealth();
  const checkedAt = new Date().toISOString();
  const ok = health.status === "ok";

  return (
    <div className="status-page">
      <header className="status-header">
        <span className="status-kicker">System</span>
        <h1 className="status-h1">Status</h1>
        <p className="status-lede">
          Live reachability for the Tempo RPC that backs every chart on this
          site. Auto-refresh on reload — same source as the{" "}
          <code className="status-inline-code">/api/v1/health</code> endpoint.
        </p>
      </header>

      <section className="status-row">
        <div className="status-row-label">Tempo RPC</div>
        <div className="status-row-value">
          <span
            className="status-pill"
            data-tone={ok ? "ok" : "fail"}
          >
            <span className="status-pill-dot" />
            {ok ? "operational" : "incident"}
          </span>
        </div>
      </section>

      {ok && (
        <section className="status-row">
          <div className="status-row-label">Latest block</div>
          <div className="status-row-value">
            <code className="status-mono">{health.block.toLocaleString()}</code>
          </div>
        </section>
      )}

      {!ok && (
        <section className="status-row">
          <div className="status-row-label">Error</div>
          <div className="status-row-value">
            <code className="status-mono status-error">{health.error}</code>
          </div>
        </section>
      )}

      <section className="status-row">
        <div className="status-row-label">Endpoint</div>
        <div className="status-row-value">
          <code className="status-mono">{health.rpcUrl}</code>
        </div>
      </section>

      <section className="status-row">
        <div className="status-row-label">Checked</div>
        <div className="status-row-value">
          <code className="status-mono">{checkedAt}</code>
        </div>
      </section>

      <footer className="status-footer">
        <Link href="/api/v1/health" className="status-footer-link">
          Raw JSON →
        </Link>
        <Link href="/oli" className="status-footer-link">
          Open ledger →
        </Link>
      </footer>
    </div>
  );
}
