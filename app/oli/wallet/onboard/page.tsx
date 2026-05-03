import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { listConnectedAgents } from "@/lib/db/wallet-agent-connections";
import { SpecimenOnboardConnect } from "./SpecimenOnboardConnect";

export const metadata: Metadata = {
  title: "Connect your agent — Pellet Wallet",
  description:
    "Connect Claude Code, Cursor, Claude Desktop, ChatGPT, or Claude.ai to your Pellet wallet so your agent can transact, request approvals, and chat with you.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletOnboardPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  // For users who already have agents connected, show the same screen
  // but the count gives them a contextual signal that they don't HAVE to
  // add another. Skip button still goes straight to the dashboard.
  const connected = await listConnectedAgents(userId);

  return (
    <SpecimenOnboardConnect
      basePath="/oli/wallet"
      mcpUrl="http://localhost:3000/mcp"
      connectedCount={connected.length}
    />
  );
}
