import { describe, it, expect } from "vitest";
import { parseInput } from "./agent";

describe("parseInput", () => {
  it("recognizes /balance as a slash command", () => {
    expect(parseInput("/balance")).toEqual({ kind: "slash", verb: "balance", args: [] });
  });

  it("parses /services with args", () => {
    expect(parseInput("/services search")).toEqual({
      kind: "slash",
      verb: "services",
      args: ["search"],
    });
  });

  it("treats anything else as natural language", () => {
    expect(parseInput("what's my balance?")).toEqual({
      kind: "nl",
      text: "what's my balance?",
    });
  });

  it("handles empty input", () => {
    expect(parseInput("")).toEqual({ kind: "empty" });
    expect(parseInput("   ")).toEqual({ kind: "empty" });
  });
});
