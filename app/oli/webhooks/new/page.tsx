import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { listMppServices } from "@/lib/oli/queries";
import { NewWebhookForm } from "@/components/oli/NewWebhookForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "New webhook — Pellet OLI",
};

export default async function NewWebhookPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet");

  const services = await listMppServices();
  const agentChoices = services.map((s) => ({ id: s.id, label: s.label }));

  return (
    <div className="oli-page" style={{ maxWidth: 720 }}>
      <header className="oli-page-header">
        <div>
          <h1 className="oli-page-h1">
            New webhook
            <span className="oli-page-h1-em">(OLI)</span>
          </h1>
          <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
            Pick an agent and a callback URL. We'll POST signed events when they
            match. The signing secret is shown once after you create the
            subscription.
          </p>
        </div>
        <Link
          href="/oli/webhooks"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-quaternary)",
            textDecoration: "none",
          }}
        >
          ← back
        </Link>
      </header>

      <NewWebhookForm agents={agentChoices} />
    </div>
  );
}
