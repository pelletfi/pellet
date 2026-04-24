"use client";

import { motion } from "motion/react";

type Registry = {
  label: string;
  section: string; // "§01" etc
  method: string; // "register()"
  returns: string; // "agentId"
};

const REGISTRIES: Registry[] = [
  { label: "ANCHOR", section: "§ 01", method: "register()", returns: "agentId" },
  { label: "MESH", section: "§ 02", method: "attest()", returns: "attestationId" },
  { label: "CIPHER", section: "§ 03", method: "prove()", returns: "validationId" },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const riseVariants = {
  hidden: { opacity: 0 },
  show: (i: number) => ({
    opacity: 1,
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      ease: [0.2, 0.65, 0.3, 0.9] as const,
    },
  }),
};

const strokeVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number) => ({
    pathLength: 1,
    opacity: 0.85,
    transition: {
      pathLength: { duration: 0.55, delay: 0.35 + i * 0.08, ease: [0.2, 0.65, 0.3, 0.9] as const },
      opacity: { duration: 0.25, delay: 0.35 + i * 0.08 },
    },
  }),
};

const fadeVariants = {
  hidden: { opacity: 0 },
  show: (i: number) => ({
    opacity: 1,
    transition: {
      duration: 0.35,
      delay: 0.7 + i * 0.06,
    },
  }),
};

export function Architecture() {
  return (
    <section className="architecture">
      <div className="arch-label">Fig. 02 — Protocol Flow</div>

      <motion.div
        className="arch-frame"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        variants={containerVariants}
      >
        {/* corner register marks */}
        <span className="arch-corner arch-corner--tl" aria-hidden>
          <svg viewBox="0 0 14 14" width="14" height="14">
            <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="0.9" />
            <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        </span>
        <span className="arch-corner arch-corner--tr" aria-hidden>
          <svg viewBox="0 0 14 14" width="14" height="14">
            <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="0.9" />
            <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        </span>
        <span className="arch-corner arch-corner--bl" aria-hidden>
          <svg viewBox="0 0 14 14" width="14" height="14">
            <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="0.9" />
            <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        </span>
        <span className="arch-corner arch-corner--br" aria-hidden>
          <svg viewBox="0 0 14 14" width="14" height="14">
            <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="0.9" />
            <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        </span>

        {/* AGENT box — top, centered */}
        <motion.div className="arch-agent" variants={riseVariants} custom={0}>
          <div className="arch-box arch-box--agent">
            <span className="arch-box-kicker">caller</span>
            <span className="arch-box-label">AGENT</span>
          </div>
        </motion.div>

        {/* fan-out SVG: three paths from AGENT down to each registry.
            Each line continuously flows via a slow strokeDashoffset cycle —
            reads as "alive" / "in motion" without any orb packets. */}
        <svg
          className="arch-fan"
          viewBox="0 0 600 140"
          preserveAspectRatio="none"
          aria-hidden
        >
          {[
            "M 300 0 C 300 40, 100 60, 100 140",
            "M 300 0 L 300 140",
            "M 300 0 C 300 40, 500 60, 500 140",
          ].map((d, i) => (
            <g key={i}>
              <motion.path
                d={d}
                fill="none"
                stroke="var(--navy)"
                strokeWidth="1"
                strokeOpacity="0.55"
                strokeDasharray="160 40"
                initial={{ strokeDashoffset: 0, opacity: 0 }}
                animate={{ strokeDashoffset: [-0, -200], opacity: 0.9 }}
                transition={{
                  strokeDashoffset: {
                    duration: 4.2 + i * 0.3,
                    repeat: Infinity,
                    ease: "linear",
                    delay: 0.4 + i * 0.15,
                  },
                  opacity: {
                    duration: 0.8,
                    delay: 0.35 + i * 0.08,
                    ease: [0.2, 0.65, 0.3, 0.9],
                  },
                }}
              />
              {/* arrow head at bottom endpoint */}
              <motion.polyline
                points={
                  i === 0
                    ? "96,134 100,140 104,134"
                    : i === 1
                      ? "296,134 300,140 304,134"
                      : "496,134 500,140 504,134"
                }
                fill="none"
                stroke="var(--navy)"
                strokeWidth="1"
                strokeOpacity="0.85"
                variants={fadeVariants}
                custom={i}
              />
            </g>
          ))}
        </svg>

        {/* method labels floating next to each fan path */}
        <div className="arch-methods">
          {REGISTRIES.map((r, i) => (
            <motion.div
              key={r.label}
              className="arch-method"
              variants={fadeVariants}
              custom={i}
            >
              {r.method}
            </motion.div>
          ))}
        </div>

        {/* three registry boxes */}
        <div className="arch-registries">
          {REGISTRIES.map((r, i) => (
            <motion.div
              key={r.label}
              className="arch-cell"
              variants={riseVariants}
              custom={i + 1}
            >
              <div className="arch-box arch-box--registry">
                <span className="arch-box-kicker">{r.section}</span>
                <span className="arch-box-label">{r.label}</span>
              </div>
              <motion.div
                className="arch-return"
                variants={fadeVariants}
                custom={i + 3}
              >
                <span className="arch-return-arrow">↳</span>
                <span className="arch-return-type">{r.returns}</span>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* settlement rail — dashed hairline */}
        <motion.div
          className="arch-chain"
          variants={fadeVariants}
          custom={6}
        >
          <span className="arch-chain-rule" />
          <span className="arch-chain-label">HYPEREVM · CHAIN 999 · SETTLEMENT</span>
          <span className="arch-chain-rule" />
        </motion.div>
      </motion.div>
    </section>
  );
}
