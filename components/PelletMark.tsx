// v3a — paired mark from Paper artboard 1Z0-0. Italic "P." + 11 whoosh
// streaks trailing left. Source frame is 180×178; this component scales
// proportionally via the `height` prop.

type Streak = { top: number; left: number; width: number; height: number; opacity: number };

// Positions lifted from Paper's generated JSX — do not tweak without updating Paper.
const STREAKS: Streak[] = [
  { top: 54, left: 5, width: 77, height: 1, opacity: 0.35 },
  { top: 44, left: 12, width: 70, height: 1, opacity: 0.35 },
  { top: 64, left: 0, width: 78, height: 1, opacity: 0.55 },
  { top: 74, left: 0, width: 74, height: 1, opacity: 0.75 },
  { top: 84, left: 0, width: 70, height: 2, opacity: 0.9 },
  { top: 94, left: 0, width: 66, height: 1, opacity: 0.7 },
  { top: 104, left: 0, width: 62, height: 1, opacity: 0.5 },
  { top: 114, left: 5, width: 55, height: 1, opacity: 0.3 },
  { top: 124, left: 12, width: 46, height: 1, opacity: 0.3 },
  { top: 124, left: 12, width: 46, height: 1, opacity: 0.3 },
  { top: 131, left: 35, width: 23, height: 1, opacity: 0.3 },
];

const NATIVE_W = 180;
const NATIVE_H = 178;

export function PelletMark({
  height = 178,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const scale = height / NATIVE_H;
  const width = NATIVE_W * scale;

  return (
    <div
      className={className}
      style={{
        width,
        height,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: NATIVE_W,
          height: NATIVE_H,
          position: "relative",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {STREAKS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              width: s.width,
              height: s.height,
              backgroundImage: `linear-gradient(270deg, rgba(255,255,255,${s.opacity}) 0%, rgba(255,255,255,0) 100%)`,
              boxSizing: "border-box",
            }}
          />
        ))}

        {/* P. — absolute-centered to match Paper's flex center */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 78,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontSize: 130,
            lineHeight: "130px",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            whiteSpace: "pre",
          }}
        >
          P.
        </div>
      </div>
    </div>
  );
}

export default PelletMark;
