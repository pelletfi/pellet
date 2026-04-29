import { db } from "./client";
import { agents } from "./schema";
import type { SeedAgent } from "@/data/curated-agents";
import { eq } from "drizzle-orm";

export async function listActiveAgents() {
  return db.select().from(agents).where(eq(agents.active, true));
}

export async function upsertAgent(a: SeedAgent): Promise<void> {
  await db
    .insert(agents)
    .values({
      id: a.id,
      label: a.label,
      source: a.source,
      wallets: a.wallets.map((w) => w.toLowerCase()),
      bio: a.bio,
      links: a.links,
    })
    .onConflictDoUpdate({
      target: agents.id,
      set: {
        label: a.label,
        source: a.source,
        wallets: a.wallets.map((w) => w.toLowerCase()),
        bio: a.bio,
        links: a.links,
      },
    });
}
