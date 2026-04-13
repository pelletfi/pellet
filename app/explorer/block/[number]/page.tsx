import Link from "next/link";
import { getBlockInfo, getLatestBlockNumber } from "@/lib/explorer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string): string {
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatTimestamp(unix: bigint): string {
  return new Date(Number(unix) * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function BlockPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const blockNumber = parseInt(number, 10);

  if (isNaN(blockNumber) || blockNumber < 0) {
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
          Invalid block number.
        </p>
      </main>
    );
  }

  const [block, latestBlock] = await Promise.all([
    getBlockInfo(blockNumber),
    getLatestBlockNumber().catch(() => blockNumber),
  ]);

  if (!block) {
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
          Block not found.
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

  // Derive parent block number from current block
  const parentBlockNumber = blockNumber > 0 ? blockNumber - 1 : null;
  const hasNext = blockNumber < latestBlock;
  const hasPrev = blockNumber > 0;

  return (
    <main className="page-container-narrow">
      {/* Header */}
      <header style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Block #{blockNumber.toLocaleString()}
        </h1>
      </header>

      {/* Block Details */}
      <Section title="Block Details">
        <DataRow label="Timestamp" value={formatTimestamp(block.timestamp)} />
        <DataRow
          label="Transactions"
          value={block.transactionCount.toLocaleString()}
        />
        <DataRow
          label="Hash"
          value={
            <span title={block.hash}>{truncate(block.hash)}</span>
          }
        />
        <DataRow
          label="Parent hash"
          value={
            parentBlockNumber !== null ? (
              <Link
                href={`/explorer/block/${parentBlockNumber}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                }}
                title={block.parentHash}
              >
                {truncate(block.parentHash)}
              </Link>
            ) : (
              <span title={block.parentHash}>{truncate(block.parentHash)}</span>
            )
          }
        />
      </Section>

      {/* Transactions */}
      <Section title="Transactions">
        {block.transactions.length === 0 ? (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-text-tertiary)",
              margin: 0,
            }}
          >
            Empty block
          </p>
        ) : (
          <div>
            {block.transactions.slice(0, 20).map((txHash) => (
              <div
                key={txHash}
                style={{
                  padding: "5px 0",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                <Link
                  href={`/explorer/tx/${txHash}`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    color: "var(--color-text-primary)",
                    textDecoration: "none",
                  }}
                >
                  {truncate(txHash)}
                </Link>
              </div>
            ))}
            {block.transactions.length > 20 && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--color-text-quaternary)",
                  marginTop: "8px",
                  marginBottom: 0,
                }}
              >
                + {block.transactions.length - 20} more transactions
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Block navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        {hasPrev ? (
          <Link
            href={`/explorer/block/${blockNumber - 1}`}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              textDecoration: "none",
              padding: "8px 16px",
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "6px",
              transition: "background 150ms ease, border-color 150ms ease",
            }}
          >
            &larr; Previous Block
          </Link>
        ) : (
          <span />
        )}
        {hasNext ? (
          <Link
            href={`/explorer/block/${blockNumber + 1}`}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              textDecoration: "none",
              padding: "8px 16px",
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "6px",
              transition: "background 150ms ease, border-color 150ms ease",
            }}
          >
            Next Block &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Back link */}
      <div>
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
