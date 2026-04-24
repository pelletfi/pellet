"use client";

import { motion } from "motion/react";

export function PullQuote() {
  return (
    <motion.section
      className="pull-quote"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.5, ease: [0.2, 0.65, 0.3, 0.9] }}
    >
      <span className="q-left">Thesis — 01</span>
      <blockquote>
        &ldquo;The registry stores facts.
        <br />
        Consumers compose judgement.&rdquo;
        <br />
        <em>— Pellet, on reputation</em>
      </blockquote>
      <span className="q-right">Fig. 01</span>
    </motion.section>
  );
}
