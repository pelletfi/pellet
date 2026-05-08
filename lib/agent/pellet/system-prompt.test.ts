import { describe, it, expect, vi } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

vi.mock("./knowledge/loader", () => ({
  loadWalletKnowledge: vi.fn(async () => "FAKE WALLET DOCS"),
}));

vi.mock("./catalog-injector", () => ({
  formatCatalogForPrompt: vi.fn(() => "FAKE CATALOG"),
}));

vi.mock("@/lib/mpp/registry", () => ({
  MPP_SERVICES: [],
}));

describe("buildSystemPrompt", () => {
  it("includes identity, behavioral rules, knowledge, cheatsheet, and catalog", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toMatch(/Pellet Agent/);
    expect(prompt).toMatch(/never moves? funds/i);
    expect(prompt).toMatch(/FAKE WALLET DOCS/);
    expect(prompt).toMatch(/FAKE CATALOG/);
    expect(prompt).toMatch(/Pellet Wallet Cheatsheet/);
  });
});
