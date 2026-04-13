import { redirect } from "next/navigation";
import Link from "next/link";
import { isContract, getAddressTxCount } from "@/lib/explorer";
import { isTip20 } from "@/lib/pipeline/compliance";
import { TEMPO_ADDRESSES } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<string, string> = {
  [TEMPO_ADDRESSES.pathUsd.toLowerCase()]: "pathUSD Stablecoin",
  [TEMPO_ADDRESSES.tip20Factory.toLowerCase()]: "TIP-20 Factory",
  [TEMPO_ADDRESSES.stablecoinDex.toLowerCase()]: "Stablecoin DEX",
  [TEMPO_ADDRESSES.tip403Registry.toLowerCase()]: "TIP-403 Registry",
  [TEMPO_ADDRESSES.feeManager.toLowerCase()]: "Fee Manager",
};

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

export default async function AddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  // Validate address format
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
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
          Invalid address format.
        </p>
      </main>
    );
  }

  const addr = address as `0x${string}`;

  // If it's a TIP-20 token, redirect to the token page
  const tip20 = await isTip20(addr).catch(() => false);
  if (tip20) {
    redirect(`/explorer/token/${address}`);
  }

  // Fetch data in parallel
  const [txCount, contract] = await Promise.all([
    getAddressTxCount(address),
    isContract(address),
  ]);

  const systemLabel = SYSTEM_LABELS[address.toLowerCase()] ?? null;

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
            Address
          </h1>
          {systemLabel && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-success)",
                background: "rgba(48,164,108,0.12)",
                border: "1px solid rgba(48,164,108,0.25)",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              {systemLabel}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text-quaternary)",
            wordBreak: "break-all",
          }}
        >
          {address}
        </div>
      </header>

      {/* Overview */}
      <Section title="Overview">
        <DataRow label="Address" value={address} />
        <DataRow label="Transaction count" value={txCount.toLocaleString()} />
        <DataRow label="Contract" value={contract ? "Yes" : "No"} />
        {systemLabel && <DataRow label="System role" value={systemLabel} />}
      </Section>

      {/* Recent Transactions */}
      <Section title="Recent Transactions">
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text-tertiary)",
            margin: 0,
          }}
        >
          Transaction history requires indexing. Coming soon.
        </p>
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
