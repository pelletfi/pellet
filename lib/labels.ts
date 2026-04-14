import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface AddressLabel {
  address: string;
  label: string;
  category: string;
  source: string;
  notes: unknown;
}

// Lookup multiple addresses at once. Returns map of lowercased address → label.
// Addresses without a label entry are absent from the map.
export async function lookupLabels(addresses: string[]): Promise<Map<string, AddressLabel>> {
  const map = new Map<string, AddressLabel>();
  if (addresses.length === 0) return map;

  const lowered = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const r = await db.execute(sql`
    SELECT address, label, category, source, notes
    FROM address_labels
    WHERE address = ANY(${sql.raw(`ARRAY[${lowered.map((a) => `'${a.replace(/'/g, "''")}'`).join(",")}]::text[]`)})
  `);
  const rows = (((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as unknown) as AddressLabel[];
  for (const row of rows) map.set(row.address, row);
  return map;
}

export async function lookupLabel(address: string): Promise<AddressLabel | null> {
  const map = await lookupLabels([address]);
  return map.get(address.toLowerCase()) ?? null;
}
