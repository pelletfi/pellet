import Link from "next/link";
import { getTxInfo } from "@/lib/explorer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string): string {
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--color-bg-subtle)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "8px",
        padding: "24px",
        marginBottom: "16px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "14px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function DataRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: "14px",
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: "success" | "reverted" | "pending" }) {
  const colors: Record<string, { text: string; bg: string; border: string }> = {
    success: {
      text: "var(--color-success, #30a46c)",
      bg: "rgba(48,164,108,0.12)",
      border: "rgba(48,164,108,0.25)",
    },
    reverted: {
      text: "var(--color-danger, #e5484d)",
      bg: "rgba(229,72,77,0.12)",
      border: "rgba(229,72,77,0.25)",
    },
    pending: {
      text: "var(--color-warning, #f5a623)",
      bg: "rgba(245,166,35,0.12)",
      border: "rgba(245,166,35,0.25)",
    },
  };
  const c = colors[status];
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "4px",
        padding: "2px 7px",
      }}
    >
      {status}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  // Validate tx hash format
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return (
      <main className="page-container-narrow">
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--color-text-tertiary)",
            padding: "48px 0",
            textAlign: "center",
          }}
        >
          Invalid transaction hash.
        </p>
      </main>
    );
  }

  const tx = await getTxInfo(hash);

  if (!tx) {
    return (
      <main className="page-container-narrow">
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--color-text-tertiary)",
            padding: "48px 0",
            textAlign: "center",
          }}
        >
          Transaction not found.
        </p>
        <div style={{ textAlign: "center" }}>
          <Link
            href="/explorer"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              textDecoration: "none",
            }}
          >
            &larr; Explorer
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container-narrow">
      {/* Header */}
      <header style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Transaction
          </h1>
          <StatusBadge status={tx.status} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text-quaternary)",
            wordBreak: "break-all",
          }}
        >
          {hash}
        </div>
      </header>

      {/* Transaction Details */}
      <Section title="Transaction Details">
        <DataRow label="Status" value={<StatusBadge status={tx.status} />} />
        <DataRow
          label="Block"
          value={
            <Link
              href={`/explorer/block/${tx.blockNumber}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                color: "var(--color-text-primary)",
                textDecoration: "none",
              }}
            >
              {tx.blockNumber.toLocaleString()}
            </Link>
          }
        />
        <DataRow
          label="From"
          value={
            <Link
              href={`/explorer/address/${tx.from}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                color: "var(--color-text-primary)",
                textDecoration: "none",
              }}
            >
              {truncate(tx.from)}
            </Link>
          }
        />
        <DataRow
          label="To"
          value={
            tx.to ? (
              <Link
                href={`/explorer/address/${tx.to}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                }}
              >
                {truncate(tx.to)}
              </Link>
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--color-text-tertiary)",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                }}
              >
                Contract Creation
              </span>
            )
          }
        />
        <DataRow label="Value" value={`${tx.value} TEMPO`} />
        <DataRow label="Gas used" value={tx.gasUsed} />
      </Section>

      {/* Back link */}
      <div style={{ marginTop: "24px" }}>
        <Link
          href="/explorer"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
          }}
        >
          &larr; Explorer
        </Link>
      </div>
    </main>
  );
}
