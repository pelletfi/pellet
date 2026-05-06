import type { MppPreset, MppService } from "./types";
import { parseDiscoveryDoc } from "./parse-discovery";

export interface RegistryEntry {
  id: string;
  name: string;
  category: string;
  url: string;
  discoveryUrl: string;
}

export const MPP_SERVICES: RegistryEntry[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    url: "https://openai.mpp.tempo.xyz",
    discoveryUrl: "https://openai.mpp.tempo.xyz/openapi.json",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "ai",
    url: "https://anthropic.mpp.tempo.xyz",
    discoveryUrl: "https://anthropic.mpp.tempo.xyz/openapi.json",
  },
  {
    id: "parallel",
    name: "Parallel",
    category: "search",
    url: "https://parallelmpp.dev",
    discoveryUrl: "https://parallelmpp.dev/openapi.json",
  },
  {
    id: "alchemy",
    name: "Alchemy",
    category: "blockchain",
    url: "https://mpp.alchemy.com",
    discoveryUrl: "https://mpp.alchemy.com/openapi.json",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "ai",
    url: "https://openrouter.mpp.tempo.xyz",
    discoveryUrl: "https://openrouter.mpp.tempo.xyz/openapi.json",
  },
  {
    id: "stabletravel",
    name: "StableTravel",
    category: "data",
    url: "https://stabletravel.dev",
    discoveryUrl: "https://stabletravel.dev/openapi.json",
  },
  {
    id: "stripe-climate",
    name: "Stripe Climate",
    category: "web",
    url: "https://climate.stripe.dev",
    discoveryUrl: "https://climate.stripe.dev/openapi.json",
  },
  {
    id: "browserbase",
    name: "Browserbase",
    category: "web",
    url: "https://mpp.browserbase.com",
    discoveryUrl: "https://mpp.browserbase.com/openapi.json",
  },
];

export const MPP_PRESETS: MppPreset[] = [
  {
    id: "research",
    name: "Research",
    description: "Web search, extraction, and browser automation",
    serviceIds: ["parallel", "browserbase"],
    defaultBudget: "2000000",
  },
  {
    id: "ai-access",
    name: "AI Access",
    description: "LLM inference across providers",
    serviceIds: ["openai", "anthropic", "openrouter"],
    defaultBudget: "5000000",
  },
  {
    id: "full-stack",
    name: "Full Stack",
    description: "All available MPP services",
    serviceIds: MPP_SERVICES.map((s) => s.id),
    defaultBudget: "10000000",
  },
];

export async function fetchServiceDiscovery(
  entry: RegistryEntry,
  signal?: AbortSignal,
): Promise<MppService | null> {
  try {
    const res = await fetch(entry.discoveryUrl, {
      signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const doc = await res.json();
    return parseDiscoveryDoc(entry.id, entry.url, doc);
  } catch {
    return null;
  }
}

export async function fetchAllServices(
  signal?: AbortSignal,
): Promise<MppService[]> {
  const results = await Promise.allSettled(
    MPP_SERVICES.map((entry) => fetchServiceDiscovery(entry, signal)),
  );

  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((s): s is MppService => s !== null);
}
