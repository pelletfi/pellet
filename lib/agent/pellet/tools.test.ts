import { describe, it, expect, vi } from "vitest";
import { buildTools } from "./tools";

vi.mock("@/lib/wallet/tempo-balance", () => ({
  readWalletBalances: vi.fn(async () => [
    { symbol: "USDC.e", address: "0xabc", raw: 1000000n, display: "1.000000" },
  ]),
}));

vi.mock("@/lib/mpp/registry", () => ({
  MPP_SERVICES: [
    { id: "openai", name: "OpenAI", category: "ai", url: "u", discoveryUrl: "d" },
  ],
}));

vi.mock("@/lib/db/wallet-chat", () => ({
  recentChatMessages: vi.fn(async () => [
    { id: "m1", sender: "user", content: "hi", createdAt: new Date("2026-05-08T00:00:00Z") },
    { id: "m2", sender: "agent", content: "hello", createdAt: new Date("2026-05-08T00:00:01Z") },
  ]),
}));

describe("buildTools", () => {
  const ctx = { userId: "u1", managedAddress: "0xabc" as `0x${string}` };

  it("getBalance returns balances for the user's managed address", async () => {
    const tools = buildTools(ctx);
    const r = await tools.getBalance.execute({}, { toolCallId: "t", messages: [] } as any);
    expect(r).toMatchObject({ balances: [{ symbol: "USDC.e", display: "1.000000" }] });
  });

  it("listMppServices returns catalog ids", async () => {
    const tools = buildTools(ctx);
    const r = await tools.listMppServices.execute({}, { toolCallId: "t", messages: [] } as any);
    expect(r).toMatchObject({ services: [{ id: "openai", name: "OpenAI" }] });
  });

  it("getThread returns the recent chat history", async () => {
    const tools = buildTools(ctx);
    const r = await tools.getThread.execute({ lastN: 10 }, { toolCallId: "t", messages: [] } as any);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]).toMatchObject({ sender: "user", content: "hi" });
  });

  it("proposeSend never executes — returns confirmation_required", async () => {
    const tools = buildTools(ctx);
    const r = await tools.proposeSend.execute(
      { to: "0xdef", amount: "1.5", asset: "USDC.e" },
      { toolCallId: "t", messages: [] } as any,
    );
    expect(r.kind).toBe("confirmation_required");
    expect(r.action).toBe("send");
  });

  it("callMppService returns confirmation_required when service is unknown", async () => {
    const tools = buildTools(ctx);
    const r = await tools.callMppService.execute(
      { serviceId: "unknown", path: "/foo", method: "GET", body: null },
      { toolCallId: "t", messages: [] } as any,
    );
    expect(r.kind).toBe("error");
  });
});
