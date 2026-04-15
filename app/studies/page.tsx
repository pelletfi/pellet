"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";

const plates = [
  {
    num: "I",
    roman: "I",
    catalog: "Reserved Order",
    title: "A field study of stillness.",
    image: "/studies/reserved-order.png",
    date: "Apr 2026",
  },
  {
    num: "II",
    roman: "II",
    catalog: "Second Order",
    title: "A hydrograph of the ledger.",
    image: "/studies/second-order.png",
    date: "Apr 2026",
  },
  {
    num: "III",
    roman: "III",
    catalog: "Taxonomy of Stability",
    title: "A taxonomy of stability.",
    image: "/studies/taxonomy.png",
    date: "Apr 2026",
  },
];

function Plate({
  plate,
  index,
}: {
  plate: (typeof plates)[number];
  index: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2, margin: "-100px" });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }}
      className="plate-section"
    >
      {/* Running head */}
      <div className="plate-running">
        <span>
          Catalog · {plate.catalog} — {plate.roman}
        </span>
        <span className="plate-running-rule" />
        <span>MMXXVI · {plate.date}</span>
      </div>

      {/* Plate image */}
      <div className="plate-image-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={plate.image}
          alt={plate.title}
          className="plate-image"
        />
      </div>

      {/* Footer caption */}
      <div className="plate-footer">
        <span>
          Plate {plate.roman} of III
        </span>
        <span className="plate-footer-divider" />
        <Link href="/docs/methodology" className="plate-footer-link">
          methodology v1.0 ↗
        </Link>
      </div>
    </motion.section>
  );
}

export default function StudiesPage() {
  return (
    <div className="studies-root">
      <style>{`
        .studies-root {
          padding: 48px 48px 120px;
          max-width: 1240px;
          margin: 0 auto;
        }
        .studies-header {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 40px 0 80px;
          border-bottom: 1px solid var(--color-border-subtle);
          margin-bottom: 80px;
        }
        .studies-eyebrow {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .studies-title {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 64px;
          font-weight: 400;
          line-height: 1.05;
          letter-spacing: -0.025em;
          margin: 0;
        }
        .studies-lede {
          font-family: var(--font-sans);
          font-size: 16px;
          line-height: 1.6;
          color: var(--color-text-secondary);
          max-width: 560px;
          margin: 0;
        }

        .plate-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 80px 0;
          border-top: 1px solid var(--color-border-subtle);
        }
        .plate-section:first-of-type {
          border-top: none;
          padding-top: 0;
        }

        .plate-running {
          display: flex;
          align-items: center;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .plate-running-rule {
          flex: 1;
          height: 1px;
          background: var(--color-border-subtle);
        }

        .plate-image-wrap {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .plate-image {
          width: 100%;
          max-width: 780px;
          height: auto;
          display: block;
          border: 1px solid var(--color-border-subtle);
          border-radius: 2px;
        }

        .plate-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .plate-footer-divider {
          flex: 1;
          height: 1px;
          background: var(--color-border-subtle);
        }
        .plate-footer-link {
          color: var(--color-text-tertiary);
          text-decoration: none;
          transition: color 200ms ease;
        }
        .plate-footer-link:hover {
          color: var(--color-text-primary);
        }

        @media (max-width: 720px) {
          .studies-root { padding: 24px 16px 60px; }
          .studies-title { font-size: 44px; }
          .studies-header { padding: 24px 0 48px; margin-bottom: 48px; }
          .plate-section { padding: 48px 0; gap: 16px; }
          .plate-running, .plate-footer { font-size: 9px; gap: 10px; letter-spacing: 0.08em; }
        }
      `}</style>

      <motion.header
        className="studies-header"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <div className="studies-eyebrow">Pellet · Studies · Edition I</div>
        <h1 className="studies-title">
          Observational studies of the{" "}
          <em style={{ fontStyle: "italic" }}>Tempo</em> ledger.
        </h1>
        <p className="studies-lede">
          A folio of printable plates. Each study is a single composition —
          one question, one field, one method. Plates are continuously
          reproducible from live data via the Pellet API.
        </p>
      </motion.header>

      {plates.map((plate, i) => (
        <Plate key={plate.num} plate={plate} index={i} />
      ))}
    </div>
  );
}
