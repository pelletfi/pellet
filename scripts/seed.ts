import { CURATED_AGENTS } from "@/data/curated-agents";
import { upsertAgent } from "@/lib/db/agents";

async function main() {
  for (const agent of CURATED_AGENTS) {
    await upsertAgent(agent);
    console.log(`✓ ${agent.id}`);
  }
  console.log(`seeded ${CURATED_AGENTS.length} agent(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
