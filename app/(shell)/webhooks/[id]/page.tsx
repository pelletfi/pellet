import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { getWebhook, listDeliveries } from "@/lib/wallet/webhooks";
import { WebhookDetail } from "@/components/wallet/WebhookDetail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Webhook — Pellet",
};

export default async function WebhookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await readUserSession();
  if (!userId) redirect("/wallet/sign-in");

  const { id } = await params;
  const sp = await searchParams;
  const oneShotSecret = typeof sp.secret === "string" ? sp.secret : null;

  const [sub, deliveries] = await Promise.all([
    getWebhook(id),
    listDeliveries(id),
  ]);

  if (!sub) notFound();

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>06</span>
            <span>Webhook</span>
            <span className="spec-page-title-em">— {sub.label ?? sub.id.slice(0, 8)}</span>
          </h1>
          <Link href="/webhooks" className="spec-switch">
            <span className="spec-switch-seg">← ALL WEBHOOKS</span>
          </Link>
        </div>
      </section>

      <div style={{ margin: "0 32px", paddingBottom: 32 }}>
        <WebhookDetail
          sub={sub}
          deliveries={deliveries.slice(0, 25)}
          oneShotSecret={oneShotSecret}
        />
      </div>
    </>
  );
}
