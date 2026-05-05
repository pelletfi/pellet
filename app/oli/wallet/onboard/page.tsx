import type { Metadata } from "next";
import { headers } from "next/headers";
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

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const mcpUrl = `${proto}://${host}/mcp`;

  const connected = await listConnectedAgents(userId);

  return (
    <SpecimenOnboardConnect
      basePath="/oli/wallet"
      mcpUrl={mcpUrl}
      connectedCount={connected.length}
    />
  );
}
