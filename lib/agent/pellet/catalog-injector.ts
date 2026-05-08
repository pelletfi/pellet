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
    "When a user asks to use a service, IMMEDIATELY emit a `callMppService` tool call. Do not describe what you're going to do in prose first — emit the tool. The tool's return value is the confirmation prompt the user will see.",
  ].join("\n");
}
