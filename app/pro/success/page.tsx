import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Link from "next/link";
import { CopyKey } from "./CopyKey";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome to Pellet Pro",
  description: "Your API key and next steps.",
};

interface Search {
  searchParams: Promise<{ session_id?: string }>;
}

async function resolveApiKey(sessionId: string): Promise<{
  email: string;
  apiKey: string;
} | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") return null;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!customerId) return null;

    // Retry briefly because webhook may land moments after the redirect.
    // 5 tries × 1s = 5s max.
    for (let i = 0; i < 5; i += 1) {
      const r = await db.execute(sql`
        SELECT email, api_key
        FROM pellet_pro_subscribers
        WHERE stripe_customer_id = ${customerId}
        LIMIT 1
      `);
      const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
      const row = rows[0];
      if (row) {
        return { email: row.email as string, apiKey: row.api_key as string };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return null;
  } catch {
    return null;
  }
}

export default async function SuccessPage({ searchParams }: Search) {
  const { session_id } = await searchParams;
  const data = session_id ? await resolveApiKey(session_id) : null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 80px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-text-quaternary)",
          marginBottom: 12,
        }}
      >
        Pellet Pro
      </div>
      <h1
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: "clamp(40px, 6vw, 64px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          fontWeight: 400,
          color: "var(--color-text-primary)",
          margin: "0 0 28px",
        }}
      >
        {data ? "Welcome aboard." : "Finalizing your subscription…"}
      </h1>

      {!data && (
        <>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--color-text-tertiary)", margin: "0 0 16px" }}>
            Your payment succeeded. We&apos;re finishing provisioning your API key now —
            this usually takes a second. If this page doesn&apos;t update on its own, refresh.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-quaternary)" }}>
            If it still doesn&apos;t appear after a minute, email{" "}
            <a href="mailto:hello@pelletfi.com" style={{ color: "var(--color-text-secondary)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              hello@pelletfi.com
            </a>{" "}
            with your receipt.
          </p>
        </>
      )}

      {data && (
        <>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--color-text-tertiary)", margin: "0 0 40px" }}>
            Subscription confirmed to <span style={{ color: "var(--color-text-primary)" }}>{data.email}</span>.
            Here&apos;s your API key — it authenticates you against every Pellet endpoint.
          </p>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-text-quaternary)",
              marginBottom: 10,
            }}
          >
            Your API key
          </div>
          <CopyKey apiKey={data.apiKey} />

          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--color-text-tertiary)",
            }}
          >
            <strong style={{ color: "var(--color-text-primary)" }}>Save this now.</strong>{" "}
            For security reasons this is the only time the full key is displayed. If you
            lose it, email <a href="mailto:hello@pelletfi.com" style={{ color: "var(--color-text-secondary)", textDecoration: "underline", textUnderlineOffset: 3 }}>hello@pelletfi.com</a> and we&apos;ll rotate it for you.
          </div>

          <div style={{ marginTop: 56 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
                marginBottom: 14,
              }}
            >
              Using your key
            </div>
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                lineHeight: 1.6,
                background: "var(--color-bg-subtle, rgba(255,255,255,0.02))",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 6,
                padding: 16,
                overflowX: "auto",
                color: "var(--color-text-secondary)",
              }}
            >
{`# SDK (v1.3.0+)
import { Pellet } from "@pelletfi/sdk";
const pellet = new Pellet({ apiKey: "${data.apiKey.slice(0, 14)}..." });

# Or raw HTTP
curl -H "Authorization: Bearer ${data.apiKey.slice(0, 14)}..." \\
     https://pelletfi.com/api/v1/stablecoins`}
            </pre>
          </div>

          <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/docs"
              style={{
                padding: "10px 18px",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 6,
                fontSize: 13,
                color: "var(--color-text-primary)",
                textDecoration: "none",
              }}
            >
              Read the docs →
            </Link>
            <Link
              href="/dashboard/webhooks"
              style={{
                padding: "10px 18px",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 6,
                fontSize: 13,
                color: "var(--color-text-primary)",
                textDecoration: "none",
              }}
            >
              Webhook subscriptions →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
