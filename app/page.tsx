import Nav from "@/components/Nav";
import Search from "@/components/Search";
import TokenCard from "@/components/TokenCard";
import { getPools, searchTokens } from "@/lib/gecko";
import type { GeckoPool } from "@/lib/gecko";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ColHeader({ label, right }: { label: string; right?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        fontSize: "11px",
        fontWeight: 500,
        color: "#444",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        textAlign: right ? "right" : "left",
      }}
    >
      {label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  let pools: GeckoPool[] = [];
  let hasNext = false;
  let error: string | null = null;

  try {
    if (query) {
      const res = await searchTokens(query);
      pools = res.data ?? [];
    } else {
      const res = await getPools(page);
      pools = res.data ?? [];
      hasNext = !!res.links?.next;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to fetch pools";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Nav />

      <main
        style={{
          flex: 1,
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          padding: "32px 24px",
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: "28px" }}>
          <h1
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "20px",
              fontWeight: 600,
              color: "#f5f5f5",
              letterSpacing: "-0.02em",
              marginBottom: "4px",
            }}
          >
            {query ? `Results for "${query}"` : "Tokens"}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "13px",
              color: "#555",
              marginBottom: "20px",
            }}
          >
            {query ? "Pools matching your search on Tempo" : "Top pools by 24h volume on Tempo"}
          </p>
          <Search defaultValue={query} />
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: "16px",
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "8px",
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "13px",
              color: "#f87171",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        {!error && (
          <div
            style={{
              border: "1px solid #1a1a1f",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 120px 120px",
                padding: "10px 16px",
                background: "#0d0d10",
                borderBottom: "1px solid #1a1a1f",
              }}
            >
              <ColHeader label="Token" />
              <ColHeader label="Price" right />
              <ColHeader label="Volume 24h" right />
              <ColHeader label="Liquidity" right />
            </div>

            {/* Rows */}
            {pools.length === 0 ? (
              <div
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  fontFamily: "var(--font-geist-sans)",
                  fontSize: "14px",
                  color: "#555",
                }}
              >
                {query ? "No pools found for that query." : "No pools available."}
              </div>
            ) : (
              pools.map((pool) => (
                <TokenCard key={pool.id} pool={pool} />
              ))
            )}
          </div>
        )}

        {/* Pagination — only for non-search browse */}
        {!query && !error && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "20px",
              padding: "0 4px",
            }}
          >
            {page > 1 ? (
              <a
                href={`/?page=${page - 1}`}
                style={{
                  fontFamily: "var(--font-geist-sans)",
                  fontSize: "13px",
                  color: "#888",
                  textDecoration: "none",
                  padding: "6px 12px",
                  border: "1px solid #1a1a1f",
                  borderRadius: "6px",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                ← Previous
              </a>
            ) : (
              <span />
            )}

            <span
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "12px",
                color: "#444",
              }}
            >
              page {page}
            </span>

            {hasNext && (
              <a
                href={`/?page=${page + 1}`}
                style={{
                  fontFamily: "var(--font-geist-sans)",
                  fontSize: "13px",
                  color: "#888",
                  textDecoration: "none",
                  padding: "6px 12px",
                  border: "1px solid #1a1a1f",
                  borderRadius: "6px",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                Next →
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
