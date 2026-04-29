export function PixelIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="none"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="2" y="0" width="4" height="1" fill="#0a0a0a" />
      <rect x="1" y="1" width="6" height="1" fill="#333333" />
      <rect x="0" y="2" width="8" height="4" fill="#0a0a0a" />
      <rect x="2" y="3" width="1" height="1" fill="#ffffff" opacity="0.3" />
      <rect x="1" y="6" width="6" height="1" fill="#333333" />
      <rect x="2" y="7" width="4" height="1" fill="#0a0a0a" />
    </svg>
  );
}
