import { describe, expect, it } from "vitest";
import {
  formatUsdcAmount,
  formatTimeAgo,
  shortHash,
  shortAddress,
  formatBlockNumber,
  formatDelta,
} from "./format";

describe("formatUsdcAmount", () => {
  it("renders 6-decimal stables in USD-style", () => {
    // 1_500_000 wei (6 decimals) = $1.50
    expect(formatUsdcAmount("1500000", 6)).toBe("$1.50");
  });

  it("handles sub-cent amounts", () => {
    expect(formatUsdcAmount("3000", 6)).toBe("$0.003");
  });

  it("handles large amounts with commas", () => {
    expect(formatUsdcAmount("1234567890000", 6)).toBe("$1,234,567.89");
  });

  it("returns em-dash for null/undefined", () => {
    expect(formatUsdcAmount(null, 6)).toBe("—");
    expect(formatUsdcAmount(undefined, 6)).toBe("—");
  });
});

describe("formatTimeAgo", () => {
  it("renders seconds for sub-minute", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-29T11:59:30Z");
    expect(formatTimeAgo(ts, now)).toBe("30s ago");
  });

  it("renders minutes for sub-hour", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-29T11:42:00Z");
    expect(formatTimeAgo(ts, now)).toBe("18m ago");
  });

  it("renders hours for sub-day", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-29T08:30:00Z");
    expect(formatTimeAgo(ts, now)).toBe("3h ago");
  });

  it("renders days otherwise", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    const ts = new Date("2026-04-25T12:00:00Z");
    expect(formatTimeAgo(ts, now)).toBe("4d ago");
  });
});

describe("shortHash", () => {
  it("truncates a 0x-prefixed hash to 6+4 with ellipsis", () => {
    expect(shortHash("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"))
      .toBe("0xddf2…b3ef");
  });

  it("returns the input if it's shorter than the truncation budget", () => {
    expect(shortHash("0xabc")).toBe("0xabc");
  });
});

describe("shortAddress", () => {
  it("truncates a 20-byte address to 6+4", () => {
    expect(shortAddress("0xfffefdfcfbfafaf9f8f7f6f5f4f3f2f1f0eeedef")).toBe("0xfffe…edef");
  });
});

describe("formatBlockNumber", () => {
  it("formats with commas", () => {
    expect(formatBlockNumber(17332551)).toBe("17,332,551");
  });
});

describe("formatDelta", () => {
  it("renders positive deltas with sign + green class hint", () => {
    expect(formatDelta(0.082)).toEqual({ display: "+8.2%", tone: "positive" });
  });

  it("renders negative deltas", () => {
    expect(formatDelta(-0.034)).toEqual({ display: "-3.4%", tone: "negative" });
  });

  it("renders zero as neutral", () => {
    expect(formatDelta(0)).toEqual({ display: "0.0%", tone: "neutral" });
  });

  it("returns null tone when prior is missing", () => {
    expect(formatDelta(null)).toEqual({ display: "—", tone: "neutral" });
  });
});
