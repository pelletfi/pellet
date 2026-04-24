"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

const PART_MAIN = "Agentic Infrastructure";
const PART_SUB = "on Hyperliquid.";
const CHAR_MS = 28;
const INTER_PAUSE_MS = 220;

export function Hero() {
  const [mainLen, setMainLen] = useState(0);
  const [subLen, setSubLen] = useState(0);
  const [showLede, setShowLede] = useState(false);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let mainTimer: ReturnType<typeof setInterval> | null = null;
    let subTimer: ReturnType<typeof setInterval> | null = null;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;

    let i = 0;
    mainTimer = setInterval(() => {
      if (cancelled) return;
      i += 1;
      setMainLen(i);
      if (i >= PART_MAIN.length) {
        if (mainTimer) clearInterval(mainTimer);
        pauseTimer = setTimeout(() => {
          if (cancelled) return;
          let j = 0;
          subTimer = setInterval(() => {
            if (cancelled) return;
            j += 1;
            setSubLen(j);
            if (j >= PART_SUB.length) {
              if (subTimer) clearInterval(subTimer);
              setTimeout(() => {
                if (!cancelled) setShowLede(true);
              }, 180);
              setTimeout(() => {
                if (!cancelled) setShowCta(true);
              }, 900);
            }
          }, CHAR_MS);
        }, INTER_PAUSE_MS);
      }
    }, CHAR_MS);

    return () => {
      cancelled = true;
      if (mainTimer) clearInterval(mainTimer);
      if (subTimer) clearInterval(subTimer);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, []);

  const mainText = PART_MAIN.slice(0, mainLen);
  const subText = PART_SUB.slice(0, subLen);
  const mainTyping = mainLen < PART_MAIN.length;
  const subTyping = !mainTyping && subLen < PART_SUB.length;

  return (
    <section className="hero">
      <div className="hero-text">
        <div>
          <h1 className="hero-h1">
            <span className="hero-h1-main">
              {mainText}
              {mainTyping && (
                <span className="hero-h1-caret" aria-hidden>
                  ▋
                </span>
              )}
            </span>
            <span className="hero-h1-sub">
              {subText}
              {subTyping && (
                <span className="hero-h1-caret" aria-hidden>
                  ▋
                </span>
              )}
            </span>
          </h1>

          <motion.div
            className="hero-meta"
            initial={{ opacity: 0 }}
            animate={showLede ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.2, 0.65, 0.3, 0.9] }}
          >
            Version 1.0 · Deployed Apr 2026 · HyperEVM chain 999
          </motion.div>

          <motion.div
            className="hero-abstract"
            initial={{ opacity: 0 }}
            animate={showLede ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0.65, 0.3, 0.9] }}
          >
            <p>
              <span className="hero-abstract-lede">Pellet</span> is a coordination
              layer for autonomous agents on HyperEVM. Three on-chain registries —
              Anchor, Mesh, and Cipher — issue cryptographic identities, index
              attestations, and settle verifiable proofs.
            </p>
            <p>
              The substrate is permissionless, composable, and
              consumer-of-truth neutral: registries store facts, applications
              compose judgement. No gated APIs, no extractive rent, no off-chain
              scoring.
            </p>
          </motion.div>
        </div>

        <motion.div
          className="hero-cta-row"
          initial={{ opacity: 0 }}
          animate={showCta ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <motion.a href="#" className="hero-cta hero-cta--primary" whileHover="hover">
            Explore the protocol{" "}
            <motion.span
              aria-hidden="true"
              variants={{ hover: { x: 4 } }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              style={{ display: "inline-block" }}
            >
              →
            </motion.span>
          </motion.a>
          <motion.a
            href="https://github.com/pelletnetwork/pellet/tree/main/packages/hl-sdk"
            target="_blank"
            rel="noreferrer"
            className="hero-cta hero-cta--trailing"
            whileHover="hover"
          >
            SDK{" "}
            <motion.span
              aria-hidden="true"
              variants={{ hover: { x: 3, y: -3 } }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              style={{ display: "inline-block" }}
            >
              ↗
            </motion.span>
          </motion.a>
          <motion.a
            href="https://github.com/pelletnetwork/pellet"
            target="_blank"
            rel="noreferrer"
            className="hero-cta"
            whileHover="hover"
          >
            GitHub{" "}
            <motion.span
              aria-hidden="true"
              variants={{ hover: { x: 3, y: -3 } }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              style={{ display: "inline-block" }}
            >
              ↗
            </motion.span>
          </motion.a>
        </motion.div>
      </div>

      <motion.div
        className="hero-media"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.65, 0.3, 0.9] }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          width={1280}
          height={800}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        >
          <source src="/videos/hero.mov" type="video/quicktime" />
          <source src="/videos/hero.mov" type="video/mp4" />
        </video>
      </motion.div>

    </section>
  );
}
