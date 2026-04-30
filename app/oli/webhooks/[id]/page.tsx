import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { getWebhook, listDeliveries } from "@/lib/oli/webhooks";
import { WebhookDetail } from "@/components/oli/WebhookDetail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Webhook — Pellet OLI",
};

export default async function WebhookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet");

  const { id } = await params;
  const sp = await searchParams;
  const oneShotSecret = typeof sp.secret === "string" ? sp.secret : null;

  const [sub, deliveries] = await Promise.all([
    getWebhook(id),
    listDeliveries(id),
  ]);

  if (!sub) notFound();

  return (
    <WebhookDetail
      sub={sub}
      deliveries={deliveries.slice(0, 25)}
      oneShotSecret={oneShotSecret}
    />
  );
}
