// Specimen-shell helpers — shared by /wallet pages. The big bar-chart components
// (RevenueChart / TxChart / ChartsRow) were retired when the dashboard moved
// to inline KPI sparklines; the static /specimen/page.tsx mock keeps its own
// local copy of the chart for design-reference. What remains here:
//
//   • Sparkline       — inline trend rendered next to KPI values + table cells
//   • VerifyBadge     — checkmark glyph next to verified entities
//   • fmt* helpers    — consistent number formatting across surfaces

export function fmtUsdCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

export function fmtUsdExact(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

export function fmtIntCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 70;
  const h = 16;
  const pad = 1.5;
  if (values.length < 2) {
    return (
      <svg className="spec-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => [
    i * stepX,
    pad + (h - pad * 2) - ((v - min) / span) * (h - pad * 2),
  ]) as Array<[number, number]>;

  const t = 0.5;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * (t / 3);
    const c1y = p1[1] + (p2[1] - p0[1]) * (t / 3);
    const c2x = p2[0] - (p3[0] - p1[0]) * (t / 3);
    const c2y = p2[1] - (p3[1] - p1[1]) * (t / 3);
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }

  return (
    <svg
      className="spec-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function VerifyBadge() {
  return (
    <svg className="spec-verify" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.4 5.6 L4.8 7 L7.6 4" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
