import { describe, expect, it } from "vitest";
import { decodeEventLine } from "./decode";

const labels: Record<string, { label: string; category: string }> = {
  "0xanthropicaddress0000000000000000000000000": {
    label: "Anthropic",
    category: "ai",
  },
};

describe("decodeEventLine", () => {
  it("renders agent → known-service when counterparty is in label map", () => {
    const line = decodeEventLine({
      agentId: "anthropic-mpp",
      agentLabel: "Anthropic",
      kind: "transfer",
      counterpartyAddress: "0xagent_x_payer000000000000000000000000000",
      amountWei: "3000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, labels);
    // Anthropic is the recipient; the payer is the unknown agent_x → "0xagent…000"
    expect(line.summary).toContain("paid");
    expect(line.summary).toContain("$0.003");
  });

  it("renders unknown-counterparty as a short address", () => {
    const line = decodeEventLine({
      agentId: "anthropic-mpp",
      agentLabel: "Anthropic",
      kind: "transfer",
      counterpartyAddress: "0xfffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef",
      amountWei: "1000000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, {});
    expect(line.summary).toContain("0xfffe…edef");
    expect(line.summary).toContain("Anthropic");
  });

  it("falls back to a generic line when amount/counterparty missing", () => {
    const line = decodeEventLine({
      agentId: "pellet",
      agentLabel: "Pellet",
      kind: "custom",
      counterpartyAddress: null,
      amountWei: null,
      tokenAddress: null,
      ts: new Date("2026-04-29T12:00:00Z"),
    }, {});
    expect(line.summary).toBe("Pellet · custom event");
  });

  it("always renders as '{agent} paid {counterparty}' for transfer events", () => {
    const line = decodeEventLine({
      agentId: "watched",
      agentLabel: "watched",
      kind: "transfer",
      counterpartyAddress: "0xanthropicaddress0000000000000000000000000",
      amountWei: "3000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, labels);
    expect(line.summary).toBe("watched paid Anthropic $0.003");
  });

  it("returns the inferred category when both ends are labeled services", () => {
    const line = decodeEventLine({
      agentId: "anthropic-mpp",
      agentLabel: "Anthropic",
      kind: "transfer",
      counterpartyAddress: "0xagent_x_payer000000000000000000000000000",
      amountWei: "3000",
      tokenAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      ts: new Date("2026-04-29T12:00:00Z"),
    }, labels);
    expect(line.category).toBe("ai");
  });
});
