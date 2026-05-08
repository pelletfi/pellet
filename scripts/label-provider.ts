// Upsert a row in address_labels for an attributed provider — handles both
// real addresses (Pattern A) and fingerprint groups (Pattern B), keyed
// uniformly so the Wallet UI surfaces the label automatically the moment it
// lands.
//
// Usage:
//   npm run label-provider -- 0xc95c4f0d7d0806ade007b79483738a2ff8b35769 "Anthropic" ai
//   npm run label-provider -- fp_8bdbf8cc304c4816750e "Claude Sonnet 4.5" ai
//
// Args: <key> <label> [category]   — category defaults to "provider".
// Run against .env.local; single shared Neon branch covers prod too.

import { db } from "@/lib/db/client";
import { addressLabels } from "@/lib/db/schema";

function usage(): never {
  console.error(
    "usage: npm run label-provider -- <key> <label> [category]\n" +
      "  <key>      lowercase 0x-address (Pattern A) or 'fp_<20-hex>' (Pattern B)\n" +
      "  <label>    human-readable display name (e.g. 'Anthropic')\n" +
      "  <category> optional, defaults to 'provider'\n",
  );
  process.exit(2);
}

function validateKey(key: string): string {
  const lc = key.toLowerCase();
  if (lc.startsWith("fp_")) {
    const hex = lc.slice(3);
    if (!/^[0-9a-f]{20}$/.test(hex)) {
      console.error(`invalid fingerprint key: ${key}`);
      console.error(`  expected 'fp_' + 20 hex chars (10 bytes); got ${hex.length} chars`);
      process.exit(2);
    }
    return lc;
  }
  if (!/^0x[0-9a-f]{40}$/.test(lc)) {
    console.error(`invalid address key: ${key}`);
    console.error(`  expected '0x' + 40 hex chars (20 bytes)`);
    process.exit(2);
  }
  return lc;
}

async function main() {
  const [keyArg, labelArg, categoryArg] = process.argv.slice(2);
  if (!keyArg || !labelArg) usage();

  const key = validateKey(keyArg);
  const label = labelArg.trim();
  const category = (categoryArg ?? "provider").trim();

  await db
    .insert(addressLabels)
    .values({
      address: key,
      label,
      category,
      source: "manual",
      notes: { seededBy: "scripts/label-provider.ts" },
    })
    .onConflictDoUpdate({
      target: addressLabels.address,
      set: { label, category, source: "manual", updatedAt: new Date() },
    });

  console.log(`✓ labeled ${key} → "${label}" (${category})`);
  console.log(`  refresh /wallet to see it surface across the UI.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
