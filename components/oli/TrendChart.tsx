type Point = { ts: Date; value: number };

const ACCENT = "#9a9a9a";

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return abs >= 100 ? n.toFixed(0) : n.toFixed(2);
}

export function TrendChart({
  points,
  height = 140,
  formatY = (n) => fmtCompact(n),
}: {
  points: Point[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  if (points.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--color-text-quaternary)",
          border: "1px solid var(--color-border-subtle)",
          background: "transparent",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        not enough data yet
      </div>
    );
  }

  const W = 800;
  const H = height;
  const padT = 12, padB = 18, padL = 0, padR = 0;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const ys = points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) => padT + ((yMax - v) / yRange) * innerH;

  // Stepped polyline — square corners between samples instead of smooth interp.
  const stepPath: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const x = xFor(i);
    const y = yFor(points[i].value);
    if (i === 0) {
      stepPath.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      const prevY = yFor(points[i - 1].value);
      // horizontal-then-vertical step (right-angle corners)
      stepPath.push(`L ${x.toFixed(2)} ${prevY.toFixed(2)}`);
      stepPath.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }

  // Three hairline gridlines: min, mid, max.
  const gridYs = [yMin, (yMin + yMax) / 2, yMax];

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.value - first.value;
  const deltaPct = first.value !== 0 ? (delta / Math.abs(first.value)) * 100 : null;

  return (
    <div style={{ width: "100%", fontVariantNumeric: "tabular-nums" }}>
      {/* Mono tape header — min · max · last · Δ */}
      <div
        style={{
          display: "flex",
          gap: 16,
          paddingBottom: 8,
          marginBottom: 4,
          borderBottom: "1px solid var(--color-border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.04em",
          color: "var(--color-text-tertiary)",
          flexWrap: "wrap",
        }}
      >
        <span>
          <span style={{ color: "var(--color-text-quaternary)", textTransform: "uppercase" }}>min </span>
          {formatY(yMin)}
        </span>
        <span>
          <span style={{ color: "var(--color-text-quaternary)", textTransform: "uppercase" }}>max </span>
          {formatY(yMax)}
        </span>
        <span>
          <span style={{ color: "var(--color-text-quaternary)", textTransform: "uppercase" }}>last </span>
          <span style={{ color: "var(--color-text-primary)" }}>{formatY(last.value)}</span>
        </span>
        {deltaPct != null && (
          <span>
            <span style={{ color: "var(--color-text-quaternary)", textTransform: "uppercase" }}>Δ </span>
            <span style={{ color: delta >= 0 ? ACCENT : "var(--color-text-secondary)" }}>
              {delta >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
        {/* Hairline horizontal gridlines, very low opacity */}
        {gridYs.map((gv, i) => (
          <line
            key={i}
            x1={0}
            x2={W}
            y1={yFor(gv)}
            y2={yFor(gv)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="1 5"
            strokeWidth={1}
          />
        ))}

        {/* Stepped trend line — sharp corners, accent color */}
        <path
          d={stepPath.join(" ")}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.25}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* Hairline tick at the most-recent sample */}
        <line
          x1={xFor(points.length - 1)}
          x2={xFor(points.length - 1)}
          y1={yFor(last.value) - 4}
          y2={yFor(last.value) + 4}
          stroke={ACCENT}
          strokeWidth={1.25}
        />
      </svg>
    </div>
  );
}
