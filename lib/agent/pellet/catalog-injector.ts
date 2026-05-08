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
    "When a user asks to use a service, refer to it by name in natural language and propose a `callMppService` tool call (which renders an inline confirmation).",
  ].join("\n");
}
