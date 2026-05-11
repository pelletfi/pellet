"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const HERO_VIDEO = "/pellet-finance.mp4";

export function Sphere() {
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduced) {
      v.pause();
      return;
    }
    // Chrome occasionally blocks muted autoplay on the first paint of a new
    // tab. Retry briefly, then fall back to starting on the user's first
    // interaction so the sphere always animates eventually.
    let attempts = 0;
    const tryPlay = () => {
      v.play().catch(() => {
        if (++attempts < 4) setTimeout(tryPlay, 300);
      });
    };
    tryPlay();
    const onInteract = () => v.play().catch(() => {});
    document.addEventListener("pointerdown", onInteract, { once: true });
    document.addEventListener("scroll", onInteract, { once: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("scroll", onInteract);
    };
  }, [reduced]);

  return (
    <div className="pltn-sphere-wrap">
      <motion.div
        className="pltn-sphere"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <video
          ref={videoRef}
          className="pltn-sphere-video"
          src={HERO_VIDEO}
          poster="/pellet-finance-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
      </motion.div>
    </div>
  );
}
