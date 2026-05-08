import { describe, expect, it } from "vitest";
import { matchEvent, type RawEventRow, type AgentLite } from "./matcher";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const AIXBT_WALLET = "0xabcdef0000000000000000000000000000000001";
// 32-byte topic format: 0x + 24 zeros + 40-hex address.
const AIXBT_TOPIC = "0x000000000000000000000000abcdef0000000000000000000000000000000001";

const aixbt: AgentLite = {
  id: "aixbt",
  label: "aixbt",
  wallets: [AIXBT_WALLET],
};

describe("matchEvent", () => {
  it("matches an agent when its wallet appears as topic1 (Transfer.from)", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [TRANSFER_TOPIC, AIXBT_TOPIC, "0x000000000000000000000000recipient00000000000000000000000000000000"],
        data: "0x0",
      },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches).toHaveLength(1);
    expect(matches[0].agentId).toBe("aixbt");
    expect(matches[0].kind).toBe("transfer");
    expect(matches[0].summary).toContain("aixbt");
  });

  it("matches an agent when its wallet appears as topic2 (Transfer.to)", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [TRANSFER_TOPIC, "0x000000000000000000000000sender0000000000000000000000000000000000", AIXBT_TOPIC],
        data: "0x0",
      },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches).toHaveLength(1);
    expect(matches[0].agentId).toBe("aixbt");
  });

  it("returns empty when no agent wallet matches any topic", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [
          TRANSFER_TOPIC,
          "0x000000000000000000000000unrelated00000000000000000000000000000000",
          "0x000000000000000000000000unrelated2_000000000000000000000000000000",
        ],
        data: "0x0",
      },
    };
    expect(matchEvent(evt, [aixbt])).toHaveLength(0);
  });

  it("attaches Wallet provenance (sourceBlock + methodologyVersion)", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 12345,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: { topics: [TRANSFER_TOPIC, AIXBT_TOPIC, "0x0"], data: "0x0" },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches[0].sourceBlock).toBe(12345);
    expect(matches[0].methodologyVersion).toMatch(/^v\d+\.\d+/);
  });

  it("kinds unknown event types as 'custom'", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xWeirdContract",
      eventType: "0xdeadbeef",
      args: { topics: ["0xdeadbeef", AIXBT_TOPIC], data: "0x0" },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches[0].kind).toBe("custom");
  });

  it("matches case-insensitively (topics may be hex-uppercased)", () => {
    const upperTopic = AIXBT_TOPIC.toUpperCase().replace("0X", "0x");
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: { topics: [TRANSFER_TOPIC, upperTopic, "0x0"], data: "0x0" },
    };
    expect(matchEvent(evt, [aixbt])).toHaveLength(1);
  });
});

describe("matchEvent — amount + counterparty extraction", () => {
  it("decodes the Transfer amount from event data", () => {
    // Transfer(address from, address to, uint256 value); value is ABI-encoded
    // in event.data as 32-byte big-endian. 1.5 USDC.e (6 decimals) = 1_500_000.
    const valueHex = (1_500_000).toString(16).padStart(64, "0");
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0x20c000000000000000000000b9537d11c60e8b50", // USDC.e
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [TRANSFER_TOPIC, AIXBT_TOPIC, "0x000000000000000000000000counterparty00000000000000000000000000"],
        data: `0x${valueHex}`,
      },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches[0].amountWei).toBe("1500000");
    expect(matches[0].tokenAddress).toBe("0x20c000000000000000000000b9537d11c60e8b50");
  });

  it("captures the counterparty (the OTHER party in the Transfer)", () => {
    const valueHex = (1_000_000).toString(16).padStart(64, "0");
    const counterpartyTopic = "0x000000000000000000000000fffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef";
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        // aixbt as `from` (topic1), counterparty as `to` (topic2)
        topics: [TRANSFER_TOPIC, AIXBT_TOPIC, counterpartyTopic],
        data: `0x${valueHex}`,
      },
    };
    const matches = matchEvent(evt, [aixbt]);
    // Counterparty is captured as a 20-byte address (lowercase, 0x + 40 hex).
    expect(matches[0].counterpartyAddress).toBe("0xfffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef");
  });

  it("yields null amount + counterparty when topics insufficient", () => {
    const evt: RawEventRow = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xWeird",
      eventType: "0xdeadbeef",
      args: { topics: ["0xdeadbeef", AIXBT_TOPIC], data: "0x" },
    };
    const matches = matchEvent(evt, [aixbt]);
    expect(matches[0].amountWei).toBeNull();
    expect(matches[0].counterpartyAddress).toBeNull();
  });
});
