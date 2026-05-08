import { db } from "@/lib/db/client";
import { addressLabels } from "@/lib/db/schema";
import type { LabelMap } from "./decode";

export async function buildLabelMap(): Promise<LabelMap> {
  const rows = await db
    .select({ address: addressLabels.address, label: addressLabels.label, category: addressLabels.category })
    .from(addressLabels);
  const map: LabelMap = {};
  for (const r of rows) {
    map[r.address.toLowerCase()] = { label: r.label, category: r.category };
  }
  return map;
}
