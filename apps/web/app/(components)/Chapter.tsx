"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { explorerAddressUrl } from "@/lib/hl/addresses";

const FULL_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/** Middle-truncate a full 0x address to `0xAAAAAAAA…LLLL` (8 + ellipsis + 4). */
function shortenAddr(addr: string): string {
  if (!FULL_ADDR_RE.test(addr)) return addr;
  return `${addr.slice(0, 10)}…${addr.slice(-4)}`;
}

type Props = {
  id?: string;
  sectionId: string;
  title: string;
  subtitle?: string; // ERC-8004 term beneath Pellet title
  addr: string;
  statusLabel?: string;
  imageSrc: string;
  imageAlt: string;
  body: ReactNode;
  linkLabel?: string;
  linkHref?: string;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const child = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.55, ease: [0.2, 0.65, 0.3, 0.9] as const },
  },
};

export function Chapter({
  id,
  sectionId,
  title,
  subtitle,
  addr,
  statusLabel = "Live",
  imageSrc,
  imageAlt,
  body,
  linkLabel,
  linkHref,
}: Props) {
  return (
    <motion.section
      id={id}
      className="chapter"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
    >
      <motion.header className="chapter-head" variants={child}>
        <span className="section-id">{sectionId}</span>
        <div className="chapter-title-block">
          <h2 className="chapter-title">{title}</h2>
          {subtitle && <span className="chapter-subtitle">{subtitle}</span>}
        </div>
        {FULL_ADDR_RE.test(addr) ? (
          <a
            className="chapter-addr addr-link"
            href={explorerAddressUrl(addr)}
            target="_blank"
            rel="noopener noreferrer"
            title={`View ${addr} on HyperScan`}
          >
            {shortenAddr(addr)}
          </a>
        ) : (
          <span className="chapter-addr">{addr}</span>
        )}
        <span className="chapter-status">
          <span className="pellet-dot" />
          {statusLabel}
        </span>
      </motion.header>

      <motion.div className="chapter-image" variants={child}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt={imageAlt} />
      </motion.div>

      <motion.div className="chapter-body" variants={child}>
        <p>{body}</p>
        {linkLabel && linkHref && (
          <a href={linkHref} className="chapter-link">
            {linkLabel}
          </a>
        )}
      </motion.div>
    </motion.section>
  );
}
