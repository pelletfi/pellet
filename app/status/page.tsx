"use client";

import { useEffect, useState } from "react";

interface HealthResp {
  status: "ok" | "drift" | "fail";
  details: {
    cursor?: { last_block: number; chain_head: number; lag_blocks: number };
    peg_samples?: { latest_at: string | null; lag_seconds: number | null };
  };
  checked_at: string;
}

const PIPELINES: Array<{ name: string; cronName: string; schedule: string }> = [
  { name: "Event ingest", cronName: "ingest", schedule: "every 1 min" },
  { name: "Peg sampling", cronName: "peg-sample", schedule: "every 1 min" },
  { name: "Peg aggregator", cronName: "peg-aggregate", schedule: "every 5 min" },
  { name: "Peg-break detector", cronName: "peg-break-detect", schedule: "every 2 min" },
  { name: "Risk scorer", cronName: "risk-score", schedule: "every 5 min" },
  { name: "Reserves refresh", cronName: "reserves-refresh", schedule: "hourly" },
  { name: "Flow anomalies", cronName: "flow-anomaly", schedule: "every 15 min" },
  { name: "Webhook delivery", cronName: "webhook-deliver", schedule: "every 1 min" },
  { name: "Health monitor", cronName: "health-check", schedule: "every 2 min" },
  { name: "Role holders", cronName: "role-holders", schedule: "every 10 min" },
];

interface CronStat {
  name: string;
  latest_status: "ok" | "error" | null;
  latest_duration_ms: number;
  latest_started_at: string;
  latest_error: string | null;
  runs_24h: number;
  ok_24h: number;
  avg_duration_ms_24h: number | null;
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [crons, setCrons] = useState<CronStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/system/health").then((r) => r.json()),
      fetch("/api/v1/system/cron-runs").then((r) => r.ok ? r.json() : { crons: [] }),
    ])
      .then(([h, c]) => {
        setHealth(h as HealthResp);
        setCrons(c.crons ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cronByName = new Map(crons.map((c) => [c.name, c]));

  const status = health?.status ?? "unknown";
  const verdict =
    status === "ok"
      ? { label: "All systems operational", color: "var(--color-text-primary)" }
      : status === "drift"
        ? { label: "Drift detected", color: "var(--color-warning)" }
        : { label: "System fault", color: "var(--color-error, #e5484d)" };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px 80px" }}>
      <h1
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 36,
          fontWeight: 400,
          marginBottom: 8,
          color: "var(--color-text-primary)",
        }}
      >
        System status
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-tertiary)",
          marginBottom: 32,
        }}
      >
        Live readout from Pellet&apos;s ingestion + cron pipelines.
      </p>

      <div
        style={{
          padding: 20,
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          marginBottom: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="status-dot" style={status !== "ok" ? { background: "var(--color-warning)" } : undefined} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: verdict.color }}>
            {loading ? "Checking…" : verdict.label}
          </span>
        </div>
        {health && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>
            checked {timeAgo(health.checked_at)}
          </span>
        )}
      </div>

      {health?.details && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 40,
          }}
          className="status-metrics"
        >
          {health.details.cursor && (
            <Metric
              label="Ingest cursor lag"
              value={`${health.details.cursor.lag_blocks} blocks`}
              detail={`head ${health.details.cursor.chain_head.toLocaleString()}, cursor ${health.details.cursor.last_block.toLocaleString()}`}
            />
          )}
          {health.details.peg_samples && (
            <Metric
              label="Last peg sample"
              value={
                health.details.peg_samples.lag_seconds != null
                  ? `${health.details.peg_samples.lag_seconds}s ago`
                  : "—"
              }
              detail={
                health.details.peg_samples.latest_at
                  ? `at ${health.details.peg_samples.latest_at}`
                  : "no samples"
              }
            />
          )}
        </div>
      )}

      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-quaternary)",
          marginBottom: 16,
        }}
      >
        Active pipelines
      </h2>
      <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, overflow: "hidden" }}>
        {PIPELINES.map((p, i) => {
          const stat = cronByName.get(p.cronName);
          const successRate = stat && stat.runs_24h > 0 ? (stat.ok_24h / stat.runs_24h) * 100 : null;
          const dotColor =
            !stat ? "var(--color-border-default)" :
            stat.latest_status === "error" ? "var(--color-warning)" :
            "var(--color-text-primary)";
          return (
            <div
              key={p.cronName}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                padding: "14px 16px",
                borderTop: i === 0 ? "none" : "1px solid var(--color-border-subtle)",
                gap: 16,
                alignItems: "center",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{p.name}</div>
                {stat && stat.latest_started_at && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)", marginTop: 2 }}>
                    last run {timeAgo(stat.latest_started_at)} · {stat.latest_duration_ms}ms
                    {stat.avg_duration_ms_24h && ` · 24h avg ${stat.avg_duration_ms_24h}ms`}
                  </div>
                )}
              </div>
              {successRate !== null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: successRate === 100 ? "var(--color-text-tertiary)" : "var(--color-warning)" }}>
                  {successRate.toFixed(0)}%
                </span>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>
                {p.schedule}
              </span>
            </div>
          );
        })}
      </div>

      <p
        style={{
          marginTop: 32,
          fontSize: 12,
          color: "var(--color-text-quaternary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Probe URL: <a href="/api/v1/system/health" style={{ color: "var(--color-text-tertiary)" }}>/api/v1/system/health</a> — returns 200 if ok, 503 otherwise.
      </p>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ padding: 16, border: "1px solid var(--color-border-subtle)", borderRadius: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)", marginTop: 6 }}>
        {detail}
      </div>
    </div>
  );
}
