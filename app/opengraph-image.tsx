import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Pellet — Stablecoin Intelligence on Tempo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "rgba(255,255,255,0.93)",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 18,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span>MPP-NATIVE</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
          <span>BUILT FOR TEMPO</span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 80,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "rgba(255,255,255,0.93)",
              maxWidth: 1000,
            }}
          >
            The first payments chain has its own
          </div>
          <div
            style={{
              fontSize: 80,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              fontStyle: "italic",
              color: "rgba(255,255,255,0.78)",
            }}
          >
            stablecoin intelligence.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
          }}
        >
          <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Pellet</div>
          <div>pelletfi.com</div>
        </div>
      </div>
    ),
    size,
  );
}
