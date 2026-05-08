import { describe, it, expect } from "vitest";
import { formatCatalogForPrompt } from "./catalog-injector";
import type { RegistryEntry } from "@/lib/mpp/registry";

describe("formatCatalogForPrompt", () => {
  it("renders a registry list with id/name/category/url", () => {
    const reg: RegistryEntry[] = [
      { id: "openai", name: "OpenAI", category: "ai", url: "https://openai.mpp.tempo.xyz", discoveryUrl: "https://openai.mpp.tempo.xyz/openapi.json" },
      { id: "alchemy", name: "Alchemy", category: "blockchain", url: "https://mpp.alchemy.com", discoveryUrl: "https://mpp.alchemy.com/openapi.json" },
    ];
    const out = formatCatalogForPrompt(reg);
    expect(out).toContain("openai");
    expect(out).toContain("OpenAI");
    expect(out).toContain("ai");
    expect(out).toContain("alchemy");
    expect(out).toContain("blockchain");
  });

  it("returns a sentence noting empty catalog when empty", () => {
    expect(formatCatalogForPrompt([])).toMatch(/no services/i);
  });
});
