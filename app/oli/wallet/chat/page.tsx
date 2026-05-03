import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { recentChatMessages } from "@/lib/db/wallet-chat";
import { listConnectedAgents } from "@/lib/db/wallet-agent-connections";
import { SpecimenWalletChat } from "./SpecimenWalletChat";

export const metadata: Metadata = {
  title: "Wallet Chat — Pellet",
  description: "Live chat thread between you and your agents.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function OliWalletChatPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string | string[]; connectionId?: string | string[] }>;
}) {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const query = await searchParams;
  const requestedAgentId =
    firstParam(query.agent) ?? firstParam(query.connectionId);
  const agents = await listConnectedAgents(userId);
  const selectedAgent =
    agents.find((agent) => agent.id === requestedAgentId) ?? agents[0] ?? null;

  // Initial paint: last 50 messages oldest-first so the SSE stream can
  // append in chronological order without re-ordering.
  const recent = (
    await recentChatMessages(userId, 50, {
      connectionId: selectedAgent?.id ?? null,
    })
  ).reverse();

  return (
    <SpecimenWalletChat
      basePath="/oli/wallet"
      agents={agents.map((agent) => ({
        id: agent.id,
        clientId: agent.clientId,
        clientName: agent.clientName,
        clientType: agent.clientType,
        tokenState: agent.tokenState,
        webhookEnabled: agent.webhookEnabled,
        lastSeenAt: agent.lastSeenAt.toISOString(),
      }))}
      selectedAgentId={selectedAgent?.id ?? null}
      initialMessages={recent.map((r) => ({
        id: r.id,
        connectionId: r.connectionId,
        clientId: r.clientId,
        sessionId: r.sessionId,
        sender: r.sender,
        kind: r.kind,
        content: r.content,
        intentId: r.intentId,
        ts: r.createdAt.toISOString(),
      }))}
    />
  );
}
