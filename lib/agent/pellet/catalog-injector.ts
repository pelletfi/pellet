import type { RegistryEntry } from "@/lib/mpp/registry";

export function formatCatalogForPrompt(services: RegistryEntry[]): string {
  if (services.length === 0) return "No services indexed in the catalog.";
  const rows = services.map(
    (s) => `- ${s.id} | ${s.name} | category: ${s.category} | ${s.url}`,
  );
  return [
    "Available MPP / x402 services (by id):",
    ...rows,
    "",
    "Use these ids with `/call <id>` or by referring to them by name in natural language.",
  ].join("\n");
}
