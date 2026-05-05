import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { loadDashboardData, type DashboardData } from "@/lib/wallet/dashboard-data";
import { recentChatMessages } from "@/lib/db/wallet-chat";
import { SpecimenWalletDashboard } from "./SpecimenWalletDashboard";

export const metadata: Metadata = {
  title: "Wallet Dashboard — Pellet",
  description: "Your Pellet Wallet — managed Tempo address, active agent sessions, payment history.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ShareAgent = "cursor" | "gpt55";

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeShareAgent(value: string | undefined): ShareAgent | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "cursor") return "cursor";
  if (["gpt55", "gpt5", "gpt"].includes(normalized)) return "gpt55";
  return null;
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function ahead(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

function shareDashboardData(data: DashboardData, agent: ShareAgent): DashboardData {
  const isCursor = agent === "cursor";
  const sessionId = isCursor ? "share-session-cursor" : "share-session-gpt55";
  const clientId = isCursor ? "cursor-mcp-client" : "gpt-5-5-wallet-agent";
  const clientName = isCursor ? "MCP" : "GPT-5.5";
  const capWei = isCursor ? "500000000" : "1000000000";
  const usedWei = isCursor ? "38000000" : "126000000";
  const perCallWei = isCursor ? "500000" : "1000000";

  return {
    ...data,
    balances: [
      {
        symbol: "USDC.e",
        address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        display: isCursor ? "2840.20" : "6420.55",
        rawWei: isCursor ? "2840200000" : "6420550000",
      },
      {
        symbol: "pathUSD",
        address: "0x0000000000000000000000000000000000000000",
        display: isCursor ? "410.00" : "880.00",
        rawWei: isCursor ? "410000000" : "880000000",
      },
    ],
    sessions: [
      {
        id: sessionId,
        label: isCursor ? "cursor-mcp" : "gpt-5.5-wallet",
        spendCapWei: capWei,
        spendUsedWei: usedWei,
        perCallCapWei: perCallWei,
        expiresAt: ahead(isCursor ? 6 : 14),
        revokedAt: null,
        authorizeTxHash: isCursor
          ? "0x0f7a6c2e5e4f8a9b7d6c5b4a39281716253445566778899aabbccddeeff0011"
          : "0x55a9120f3b8c7d6e5f4a392817160f7a6c2e53445566778899aabbccddeeff",
        createdAt: ago(isCursor ? 78 : 34),
      },
    ],
    payments: [
      {
        id: `${agent}-spend-1`,
        sessionId,
        recipient: isCursor
          ? "0x77b97a2c55882988c70d6f52780f0ca3f64a3140"
          : "0x302c30200112233445566778899aabbccddeeff0",
        amountWei: isCursor ? "8750000" : "42000000",
        txHash: isCursor
          ? "0xa14e3f9120c88b77ca2c55882988c70d6f52780f0ca3f64a3140"
          : "0x9b31e20f302c30200112233445566778899aabbccddeeff0",
        status: "confirmed",
        createdAt: ago(isCursor ? 4 : 7),
      },
      {
        id: `${agent}-spend-2`,
        sessionId,
        recipient: "0x9eb604889341f37a521ca6e6dd02a1b1feaaabb",
        amountWei: isCursor ? "1250000" : "18000000",
        txHash: "0x2da708a392817160f7a6c2e53445566778899aabbccddeeff0011",
        status: "signed",
        createdAt: ago(isCursor ? 31 : 46),
      },
      {
        id: `${agent}-spend-3`,
        sessionId,
        recipient: "0x4f1a22a92247d321ee9e52cce6e98a12fb6a9c40",
        amountWei: isCursor ? "3140000" : "66000000",
        txHash: "0xb88c771201333100112233445566778899aabbccddeeff0011",
        status: "confirmed",
        createdAt: ago(isCursor ? 124 : 188),
      },
    ],
    agents: [
      {
        id: isCursor ? "share-agent-cursor" : "share-agent-gpt55",
        clientId,
        clientName,
        clientType: "dynamic",
        scopes: [
          "wallet:read",
          "wallet:chat",
          "wallet:spend:request",
          "wallet:spend:authorized",
        ],
        tokenState: "active",
        lastSeenAt: ago(isCursor ? 1 : 2),
        webhookEnabled: true,
        sessionId,
      },
    ],
  };
}

export default async function OliWalletDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const data = await loadDashboardData(userId);
  if (!data) redirect("/oli/wallet/sign-in");
  const params = (await searchParams) ?? {};
  const shareAgent = normalizeShareAgent(
    readParam(params.shareAgent) ?? readParam(params.captureAgent),
  );
  const displayData = shareAgent ? shareDashboardData(data, shareAgent) : data;

  const recentChat = (await recentChatMessages(userId, 50)).reverse();
  const chatMessages = recentChat.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    clientId: r.clientId,
    sessionId: r.sessionId,
    sender: r.sender,
    kind: r.kind,
    content: r.content,
    intentId: r.intentId,
    metadata: r.metadata ?? null,
    ts: r.createdAt.toISOString(),
  }));

  return (
    <SpecimenWalletDashboard
      user={displayData.user}
      balances={displayData.balances}
      chart={displayData.chart}
      sessions={displayData.sessions}
      payments={displayData.payments}
      agents={displayData.agents}
      basePath="/oli/wallet"
      chatMessages={chatMessages}
    />
  );
}
