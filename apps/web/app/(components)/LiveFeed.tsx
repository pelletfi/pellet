"use client";

import { motion } from "motion/react";

type Item = {
  type: "Attest" | "Validate" | "Register";
  attest?: boolean; // styling flag — prototype sets `.type.attest` class
  addr: string;
  block: string;
  time: string;
};

const ITEMS: Item[] = [
  {
    type: "Attest",
    attest: true,
    addr: "0x8a2f…c5e1  →  0x1b47…0294",
    block: "#4,821,305",
    time: "2s ago",
  },
  {
    type: "Validate",
    addr: "0x5f7d…b8a2  →  0x9e3c…d451",
    block: "#4,821,304",
    time: "9s ago",
  },
  {
    type: "Attest",
    attest: true,
    addr: "0xaf81…230c  →  0x2d18…9abf",
    block: "#4,821,302",
    time: "14s ago",
  },
  {
    type: "Register",
    addr: "0x4c0e…7192  (new agent)",
    block: "#4,821,298",
    time: "28s ago",
  },
  {
    type: "Attest",
    attest: true,
    addr: "0x3b59…e8d2  →  0x8004…ba21",
    block: "#4,821,296",
    time: "41s ago",
  },
];

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

const row = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] as const },
  },
};

export function LiveFeed() {
  return (
    <motion.section
      className="live-feed"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="f-header">
        <h3>Live attestations</h3>
        <span className="f-meta">
          <span className="pellet-dot pellet-dot-lg" />
          Streaming
        </span>
      </div>
      {ITEMS.map((it, i) => (
        <motion.div
          key={i}
          className="feed-item"
          variants={row}
          whileHover="hover"
        >
          <span className={`type${it.attest ? " attest" : ""}`}>{it.type}</span>
          <span className="addr">{it.addr}</span>
          <motion.span
            className="arrow"
            variants={{ hover: { x: 4 } }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            →
          </motion.span>
          <span className="block">{it.block}</span>
          <span className="time">{it.time}</span>
        </motion.div>
      ))}
    </motion.section>
  );
}
