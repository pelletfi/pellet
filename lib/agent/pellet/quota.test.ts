import { describe, it, expect, beforeEach } from "vitest";
import { checkAndIncrementQuota, _resetForTests, DAILY_NL_CAP } from "./quota";

beforeEach(() => _resetForTests());

describe("checkAndIncrementQuota", () => {
  it("allows the first call and reports remaining = cap - 1", async () => {
    const r = await checkAndIncrementQuota("u1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(DAILY_NL_CAP - 1);
  });

  it("blocks once cap is reached", async () => {
    for (let i = 0; i < DAILY_NL_CAP; i++) {
      await checkAndIncrementQuota("u1");
    }
    const r = await checkAndIncrementQuota("u1");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("isolates users", async () => {
    for (let i = 0; i < DAILY_NL_CAP; i++) await checkAndIncrementQuota("u1");
    const r = await checkAndIncrementQuota("u2");
    expect(r.allowed).toBe(true);
  });
});
