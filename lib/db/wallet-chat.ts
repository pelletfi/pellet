import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletChatMessages } from "@/lib/db/schema";

export type WalletChatRow = {
  id: string;
  userId: string;
  sessionId: string | null;
  sender: "agent" | "user" | "system";
  kind: "status" | "question" | "approval_request" | "reply" | "report";
  content: string;
  intentId: string | null;
  metadata: unknown;
  createdAt: Date;
};

function toRow(r: typeof walletChatMessages.$inferSelect): WalletChatRow {
  return {
    id: r.id,
    userId: r.userId,
    sessionId: r.sessionId,
    sender: r.sender as WalletChatRow["sender"],
    kind: r.kind as WalletChatRow["kind"],
    content: r.content,
    intentId: r.intentId,
    metadata: r.metadata,
    createdAt: r.createdAt,
  };
}

export async function getChatMessageById(id: string): Promise<WalletChatRow | null> {
  const rows = await db
    .select()
    .from(walletChatMessages)
    .where(eq(walletChatMessages.id, id))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

export async function recentChatMessages(
  userId: string,
  limit = 100,
): Promise<WalletChatRow[]> {
  const rows = await db
    .select()
    .from(walletChatMessages)
    .where(eq(walletChatMessages.userId, userId))
    .orderBy(desc(walletChatMessages.createdAt))
    .limit(limit);
  return rows.map(toRow);
}

export async function insertChatMessage(input: {
  userId: string;
  sessionId: string | null;
  sender: WalletChatRow["sender"];
  kind: WalletChatRow["kind"];
  content: string;
  intentId?: string | null;
  metadata?: unknown;
}): Promise<WalletChatRow> {
  const [row] = await db
    .insert(walletChatMessages)
    .values({
      userId: input.userId,
      sessionId: input.sessionId,
      sender: input.sender,
      kind: input.kind,
      content: input.content,
      intentId: input.intentId ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  return toRow(row);
}

// Filter helper for SSE consumers — only forward rows for the subscribed user.
export function isForUser(row: WalletChatRow, userId: string): boolean {
  return row.userId === userId;
}
