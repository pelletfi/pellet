import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

// Composite risk score 0-100, higher = more risk.
// Weighted sum of explainable components. Each component returns a 0-100 sub-score.

interface Components {
  peg_risk: number;          // based on 24h stddev + max deviation
  peg_break_risk: number;    // based on active / recent peg-break events
  supply_risk: number;       // supply headroom vs cap
  policy_risk: number;       // has policy? recent changes?
}

const WEIGHTS: Components = {
  peg_risk: 0.40,
  peg_break_risk: 0.30,
  supply_risk: 0.20,
  policy_risk: 0.10,
};

async function getNumber(q: Promise<unknown>): Promise<number | null> {
  const result = await q;
  const rows = ((result as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const v = rows[0] ? Object.values(rows[0])[0] : null;
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

async function pegRisk(stable: string): Promise<number> {
  // Use 24h aggregate: stddev + max_deviation_bps
  const stddev = await getNumber(db.execute(sql`
    SELECT stddev_price FROM peg_aggregates WHERE stable = ${stable} AND window_label = '24h' LIMIT 1
  `));
  const maxDev = await getNumber(db.execute(sql`
    SELECT max_deviation_bps FROM peg_aggregates WHERE stable = ${stable} AND window_label = '24h' LIMIT 1
  `));

  if (stddev == null && maxDev == null) return 20; // no data → mild baseline

  // Normalize: 100bps max = 100 score. Linear.
  const devScore = Math.min(100, (maxDev ?? 0));
  const stddevScore = Math.min(100, (stddev ?? 0) * 10_000); // stddev is in price units; *10000 = bps
  return Math.max(devScore, stddevScore);
}

async function pegBreakRisk(stable: string): Promise<number> {
  // Active (ongoing) event adds heavily. Recent events (last 7d) add linearly.
  const active = await getNumber(db.execute(sql`
    SELECT COUNT(*)::int FROM peg_events
    WHERE stable = ${stable} AND ended_at IS NULL
  `));
  const recent7d = await getNumber(db.execute(sql`
    SELECT COUNT(*)::int FROM peg_events
    WHERE stable = ${stable} AND started_at >= NOW() - INTERVAL '7 days'
  `));
  const severe7d = await getNumber(db.execute(sql`
    SELECT COUNT(*)::int FROM peg_events
    WHERE stable = ${stable} AND severity = 'severe' AND started_at >= NOW() - INTERVAL '7 days'
  `));

  let score = 0;
  if ((active ?? 0) > 0) score += 60;
  score += Math.min(25, (recent7d ?? 0) * 5);
  score += Math.min(15, (severe7d ?? 0) * 15);
  return Math.min(100, score);
}

async function supplyRisk(stable: string): Promise<number> {
  // headroom_pct: percentage of supply cap remaining (100 = fresh, 0 = capped)
  const headroom = await getNumber(db.execute(sql`
    SELECT headroom_pct FROM stablecoins WHERE address = ${stable} LIMIT 1
  `));
  if (headroom == null || headroom < 0) return 15; // -1 = uncapped; give a low baseline
  // Low headroom = high risk. <10% left = 80 score, linear.
  return Math.max(0, Math.min(100, 100 - headroom));
}

async function policyRisk(stable: string): Promise<number> {
  const policyType = await db.execute(sql`
    SELECT policy_type FROM stablecoins WHERE address = ${stable} LIMIT 1
  `);
  const rows = ((policyType as { rows?: Record<string, unknown>[] }).rows
    ?? (policyType as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const t = rows[0]?.policy_type;

  // Blacklist = highest (issuer can block arbitrarily), whitelist = middle, none = lowest.
  if (t === "blacklist") return 50;
  if (t === "whitelist") return 30;
  if (t === "compound") return 45;
  return 10;
}

export interface ScoreResult {
  stablesScored: number;
}

export async function computeRiskScores(): Promise<ScoreResult> {
  let stablesScored = 0;
  for (const stable of KNOWN_STABLECOINS) {
    const addr = stable.address.toLowerCase();
    const components: Components = {
      peg_risk: await pegRisk(addr),
      peg_break_risk: await pegBreakRisk(addr),
      supply_risk: await supplyRisk(addr),
      policy_risk: await policyRisk(addr),
    };
    const composite =
      components.peg_risk * WEIGHTS.peg_risk +
      components.peg_break_risk * WEIGHTS.peg_break_risk +
      components.supply_risk * WEIGHTS.supply_risk +
      components.policy_risk * WEIGHTS.policy_risk;

    const compositeStr = composite.toFixed(2);
    const componentsJson = JSON.stringify(components);
    await db.execute(sql`
      INSERT INTO risk_scores (stable, composite, components, computed_at)
      VALUES (${addr}, ${compositeStr}, ${componentsJson}::jsonb, NOW())
      ON CONFLICT (stable) DO UPDATE SET
        composite = EXCLUDED.composite,
        components = EXCLUDED.components,
        computed_at = EXCLUDED.computed_at
    `);
    await db.execute(sql`
      INSERT INTO risk_scores_history (stable, composite, components, computed_at)
      VALUES (${addr}, ${compositeStr}, ${componentsJson}::jsonb, NOW())
    `);
    stablesScored += 1;
  }
  return { stablesScored };
}
