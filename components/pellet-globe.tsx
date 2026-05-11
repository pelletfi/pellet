/**
 * Pellet globe mark — wireframe sphere with a settlement node.
 *
 * Replaces the legacy pixel-P mark. Pure single-weight geometry in the
 * Bass / Vignelli / Rand mid-century identity tradition. One asymmetric
 * solid diamond in the upper-right quadrant ("settlement node") + a smaller
 * antipode shadow node in the lower-left.
 *
 *   - 8 meridians (vertical great-circle halves)
 *   - 4 latitudes (horizontal circles, including the equator)
 *   - Pinched diamond nodes at every meridian × latitude intersection
 *   - Settlement node: solid diamond, upper-right
 *   - Antipode: smaller solid diamond, lower-left
 *
 * Strokes inherit `currentColor`. The `compact` variant doubles the stroke
 * weight for sizes below ~64px (favicon, social avatar) where the hairline
 * version disappears into anti-aliasing fuzz.
 */

type Props = {
  size?: number;
  /** Doubles stroke weight + drops the latitude detail for small sizes. */
  compact?: boolean;
  className?: string;
};

const VB = 200;
const C = VB / 2;
const R = 92;

// Meridian longitudes (degrees from the front-facing meridian).
// 0° is the central vertical, ±90° forms the outline. Symmetric pairs render
// the front and back halves of each great circle.
const MERIDIAN_ANGLES = [0, 22.5, 45, 67.5, 90];

// Latitude positions as a fraction of R from the equator. 0 = equator,
// ±1 = pole. We render 3 visible interior latitudes (the equator plus two
// off-equator rings). The poles are implicit in the meridian endpoints.
const LATITUDE_FRACTIONS = [-0.62, 0, 0.62];

// View tilt — slight elevation of the eye above the equator gives the
// latitudes a visible elliptical shape. 0 = head-on (latitudes degenerate
// to flat lines). ~22° reads as "globe" without being a 3D illustration.
const TILT_DEG = 22;
const TILT = (TILT_DEG * Math.PI) / 180;

/** Build the path for one meridian half (front side) at longitude φ. */
function meridianPath(phiDeg: number): string {
  if (phiDeg === 0) {
    // Front-facing meridian projects to a vertical line through the center.
    return `M ${C} ${C - R} L ${C} ${C + R}`;
  }
  if (Math.abs(phiDeg) === 90) {
    // Side meridians form the outline circle. Render as a single full circle
    // path so we don't double-stroke it from both halves.
    return `M ${C - R} ${C} A ${R} ${R} 0 1 0 ${C + R} ${C} A ${R} ${R} 0 1 0 ${C - R} ${C} Z`;
  }
  const rx = R * Math.abs(Math.sin((phiDeg * Math.PI) / 180));
  const sweep = phiDeg > 0 ? 1 : 0;
  return `M ${C} ${C - R} A ${rx} ${R} 0 0 ${sweep} ${C} ${C + R}`;
}

/** Latitude ellipse — horizontal circle on the sphere, projected. */
function latitudeEllipse(frac: number): { cy: number; rx: number; ry: number } {
  // y on the sphere = R * frac (positive = south for our SVG coord)
  const phi = Math.asin(frac); // angle from equator
  const cy = C + R * frac * Math.cos(TILT);
  const rx = R * Math.cos(phi);
  // Vertical compression of the latitude ellipse based on tilt.
  const ry = rx * Math.sin(TILT);
  return { cy, rx, ry };
}

/** Project a (lat, lon) point on the sphere to 2D for diamond placement. */
function project(latFrac: number, lonDeg: number): { x: number; y: number } {
  const lat = Math.asin(latFrac);
  const lon = (lonDeg * Math.PI) / 180;
  // 3D point on unit sphere
  const px = Math.cos(lat) * Math.sin(lon);
  const py = Math.sin(lat);
  const pz = Math.cos(lat) * Math.cos(lon);
  // Apply tilt around x-axis (rotate camera so we see latitudes as ellipses)
  const py2 = py * Math.cos(TILT) - pz * Math.sin(TILT);
  return { x: C + R * px, y: C + R * py2 };
}

/** A small filled diamond used at every intersection node. */
function Diamond({ x, y, size = 2.4 }: { x: number; y: number; size?: number }) {
  return (
    <path
      d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`}
      fill="currentColor"
    />
  );
}

export function PelletGlobe({ size = 64, compact = false, className }: Props) {
  const stroke = compact ? 2.4 : 1.2;
  const nodeSize = compact ? 3.2 : 2.2;

  // Settlement node: upper-right quadrant. Latitude +0.62 (above equator),
  // longitude +45° (one meridian right of center).
  const settle = project(-0.62, 45);
  // Antipode shadow: diametrically opposite — lower-left. Smaller.
  const anti = project(0.62, -45);

  // Render every meridian × latitude intersection node. Skip the settlement
  // and antipode positions (they're rendered separately, larger).
  const nodes: { x: number; y: number; key: string }[] = [];
  for (const lat of LATITUDE_FRACTIONS) {
    for (const lonAbs of MERIDIAN_ANGLES) {
      for (const lon of lonAbs === 0 || lonAbs === 90 ? [lonAbs] : [-lonAbs, lonAbs]) {
        if (lonAbs === 90) continue; // outline meridians don't have visible interior nodes
        const p = project(lat, lon);
        const key = `${lat}_${lon}`;
        nodes.push({ ...p, key });
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outline */}
      <circle cx={C} cy={C} r={R} />

      {/* Latitudes (skip in compact for legibility at small sizes) */}
      {!compact &&
        LATITUDE_FRACTIONS.map((frac) => {
          const { cy, rx, ry } = latitudeEllipse(frac);
          if (ry < 0.5) {
            // Effectively a horizontal line at the equator (tilt is small).
            return <line key={`lat-${frac}`} x1={C - rx} y1={cy} x2={C + rx} y2={cy} />;
          }
          return <ellipse key={`lat-${frac}`} cx={C} cy={cy} rx={rx} ry={ry} />;
        })}

      {/* Meridians (interior only — outline is the circle above) */}
      {!compact &&
        MERIDIAN_ANGLES.filter((a) => a !== 90).map((phi) =>
          phi === 0 ? (
            <path key={`mer-${phi}`} d={meridianPath(0)} />
          ) : (
            <g key={`mer-${phi}`}>
              <path d={meridianPath(-phi)} />
              <path d={meridianPath(phi)} />
            </g>
          ),
        )}

      {/* Intersection nodes (skip in compact) */}
      {!compact && nodes.map((n) => <Diamond key={n.key} x={n.x} y={n.y} size={nodeSize} />)}

      {/* Settlement node — the asymmetric anchor */}
      <Diamond x={settle.x} y={settle.y} size={compact ? 6 : 5} />

      {/* Antipode shadow — smaller, lower-left */}
      {!compact && <Diamond x={anti.x} y={anti.y} size={3.2} />}
    </svg>
  );
}
