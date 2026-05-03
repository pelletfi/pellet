import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { listConnectedAgents } from "@/lib/db/wallet-agent-connections";
import { SpecimenConnectedAgents } from "./SpecimenConnectedAgents";

export const metadata: Metadata = {
  title: "Connected Agents — Pellet Wallet",
  description: "Manage the agents authorized to act on your wallet.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletAgentsPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const agents = await listConnectedAgents(userId);

  return (
    <SpecimenConnectedAgents
      basePath="/oli/wallet"
      agents={agents.map((agent) => ({
        id: agent.id,
        clientId: agent.clientId,
        clientName: agent.clientName,
        clientType: agent.clientType,
        scopes: agent.scopes,
        connectedAt: agent.connectedAt.toISOString(),
        lastSeenAt: agent.lastSeenAt.toISOString(),
        tokenExpiresAt: agent.tokenExpiresAt?.toISOString() ?? null,
        tokenState: agent.tokenState,
        activeTokenCount: agent.activeTokenCount,
        webhookEnabled: agent.webhookEnabled,
      }))}
    />
  );
}
