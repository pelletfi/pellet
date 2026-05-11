"use client";

/**
 * Sphere — wireframe anchor for the /pltn hero.
 *
 * Static SVG base layer; the mp4 paints on top once it's decoded and ready.
 * If the video stalls (autoplay block, HMR cache, slow network) the SVG
 * remains visible so the hero always has the globe — no empty box.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PelletGlobe } from "@/components/pellet-globe";

const HERO_VIDEO = "/pellet-finance.mp4";

export function Sphere() {
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduced) v.pause();
    else v.play().catch(() => {});
  }, [reduced, videoReady]);

  return (
    <div className="pltn-sphere-wrap">
      <motion.div
        className="pltn-sphere"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="pltn-sphere-svg" aria-hidden>
          <PelletGlobe size={520} />
        </div>
        <video
          ref={videoRef}
          className="pltn-sphere-video"
          src={HERO_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          data-ready={videoReady ? 1 : 0}
          onCanPlay={() => setVideoReady(true)}
          aria-hidden
        />
      </motion.div>
    </div>
  );
}

/**
 * Pure abstract chrome — soft mercurial shapes, no architecture.
 *
 * Layers:
 *   1. Off-axis chrome base (bright top-left → deep navy bottom-right)
 *   2. A meandering dark blob — the "shadow side" of the chrome
 *   3. A counter-blob of bright reflection
 *   4. Top-right specular kiss
 *   5. Soft latitudinal contours
 *   6. Rim shadow
 */
function ChromeFallback({ reduced }: { reduced: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      animate={reduced ? undefined : { rotate: [0, 360] }}
      transition={{ duration: 110, ease: "linear", repeat: Infinity }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        {/* Chrome — bright top-left → mid-grey body → soft mid-darkening at edge.
            Avoids true black so the sphere stays visible against the navy-black page. */}
        <radialGradient id="pltn-chrome" cx="32%" cy="26%" r="100%">
          <stop offset="0%"   stopColor="#f6f4f0" />
          <stop offset="10%"  stopColor="#d2d4d7" />
          <stop offset="30%"  stopColor="#8b9098" />
          <stop offset="55%"  stopColor="#4d535c" />
          <stop offset="80%"  stopColor="#2a2f38" />
          <stop offset="100%" stopColor="#1c2029" />
        </radialGradient>

        <radialGradient id="pltn-rim" cx="50%" cy="50%" r="50%">
          <stop offset="68%"  stopColor="#000" stopOpacity="0" />
          <stop offset="92%"  stopColor="#000" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
        </radialGradient>

        <radialGradient id="pltn-spec" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff" stopOpacity="1" />
          <stop offset="55%"  stopColor="#fff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="pltn-soft" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#dadbdc" stopOpacity="0.55" />
          <stop offset="60%"  stopColor="#dadbdc" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#dadbdc" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="pltn-shadow-soft" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#0a0e16" stopOpacity="0.45" />
          <stop offset="70%"  stopColor="#0a0e16" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0a0e16" stopOpacity="0" />
        </radialGradient>

        <clipPath id="pltn-sphere-clip">
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>

      <g clipPath="url(#pltn-sphere-clip)">
        {/* base chrome */}
        <rect width="200" height="200" fill="url(#pltn-chrome)" />

        {/* gentle diagonal dark band — keeps the sphere from reading flat */}
        <ellipse cx="125" cy="118" rx="80" ry="22" fill="url(#pltn-shadow-soft)" transform="rotate(-22 125 118)" />

        {/* counter bright reflections — give the chrome a sense of motion */}
        <ellipse cx="80"  cy="82"  rx="52" ry="16" fill="url(#pltn-soft)" transform="rotate(-12 80 82)" />
        <ellipse cx="150" cy="148" rx="44" ry="14" fill="url(#pltn-soft)" transform="rotate(28 150 148)" />

        {/* main specular */}
        <ellipse cx="64" cy="44" rx="36" ry="22" fill="url(#pltn-spec)" transform="rotate(-30 64 44)" />

        {/* small bottom-right specular kiss */}
        <ellipse cx="142" cy="158" rx="22" ry="8" fill="url(#pltn-spec)" opacity="0.55" transform="rotate(20 142 158)" />

        {/* latitudinal contour lines for surface curvature */}
        <g fill="none" stroke="#f4f2ee" strokeWidth="0.25" opacity="0.10">
          <ellipse cx="100" cy="100" rx="96" ry="60" />
          <ellipse cx="100" cy="100" rx="96" ry="36" />
          <ellipse cx="100" cy="100" rx="96" ry="14" />
        </g>

        {/* gentle rim shadow */}
        <rect width="200" height="200" fill="url(#pltn-rim)" />
      </g>
    </motion.svg>
  );
}
