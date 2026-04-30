import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

// nodejs runtime so we can read font files from disk via fs. ImageResponse
// (next/og) supports both runtimes; nodejs is more reliable for font loading.
export const runtime = "nodejs";
export const alt = "Pellet OLI — Open-Ledger Interface for Tempo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(file: string): Promise<ArrayBuffer> {
  const path = join(process.cwd(), "public", "fonts", file);
  const buf = await readFile(path);
  // Node Buffer is a Uint8Array under the hood — slice into a fresh
  // ArrayBuffer so Satori treats it as immutable binary data.
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export default async function Image() {
  // CommitMono's OTF carries an Apple-specific `ltag` OpenType table that
  // Satori (the next/og renderer) can't parse — fails the build with
  // "ReferenceError: ltagTable is not defined". The OG card falls back
  // to Geist Mono; site-wide CommitMono survives via the regular CSS path
  // (browsers parse OTFs fine; only Satori's stricter OT parser blows up).
  const [geistBold, geistMono, instrumentSerifItalic] = await Promise.all([
    loadFont("Geist-Bold.ttf"),
    loadFont("GeistMono-Regular.ttf"),
    loadFont("InstrumentSerif-Italic.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000",
          color: "#fff",
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {/* YInMn accent stripe top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#7a96b2",
          }}
        />

        {/* Header row: P mark + mono kicker */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="4" fill="#fff" />
            <path
              d="M11 9h6.5a4.5 4.5 0 0 1 0 9H13v5h-2V9zm2 2v5h4.5a2.5 2.5 0 0 0 0-5H13z"
              fill="#000"
            />
          </svg>
          <span
            style={{
              fontSize: 18,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              fontFamily: "Geist Mono",
            }}
          >
            PELLET · OLI
          </span>
        </div>

        {/* Hero: Instrument Serif italic headline */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            marginTop: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Instrument Serif",
              fontStyle: "italic",
              fontSize: 110,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 400,
            }}
          >
            <span>Open-Ledger</span>
            <span>Interface</span>
          </div>
        </div>

        {/* Footer: mono tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 18,
            fontFamily: "Geist Mono",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.04em",
          }}
        >
          <span>autonomous economic activity on tempo</span>
          <span style={{ color: "#7a96b2" }}>pellet.network</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistBold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: geistMono, weight: 400, style: "normal" },
        {
          name: "Instrument Serif",
          data: instrumentSerifItalic,
          weight: 400,
          style: "italic",
        },
      ],
    },
  );
}
