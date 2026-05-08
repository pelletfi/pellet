import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { listMppServices } from "@/lib/wallet/queries";
import { NewWebhookForm } from "@/components/wallet/NewWebhookForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "New webhook — Pellet",
};

export default async function NewWebhookPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/wallet/sign-in");

  const services = await listMppServices();
  const agentChoices = services.map((s) => ({ id: s.id, label: s.label }));

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>06</span>
            <span>New webhook</span>
          </h1>
          <Link href="/webhooks" className="spec-switch">
            <span className="spec-switch-seg">← WEBHOOKS</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          <span>
            Pick an agent and a callback URL. We&apos;ll POST signed events when they match. The signing secret is shown once after you create the subscription.
          </span>
        </div>
      </section>

      <div style={{ margin: "0 32px", paddingBottom: 32, maxWidth: 720 }}>
        <NewWebhookForm agents={agentChoices} />
      </div>
    </>
  );
}
