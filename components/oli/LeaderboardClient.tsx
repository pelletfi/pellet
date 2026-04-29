"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export type LeaderboardRowData = {
  id: string;
  cells: ReactNode[];
  aligns: ("left" | "right")[];
  href?: string;
};

export function LeaderboardClient({
  title,
  rowCount,
  headers,
  aligns,
  gridTemplate,
  rows,
  hasChevron,
}: {
  title: string;
  rowCount: number;
  headers: string[];
  aligns: ("left" | "right")[];
  gridTemplate: string;
  rows: LeaderboardRowData[];
  hasChevron: boolean;
}) {
  return (
    <div className="oli-leaderboard">
      <div className="oli-leaderboard-title">
        <span>{title}</span>
        <span style={{ color: "var(--color-text-quaternary)", fontSize: 11 }}>
          {rowCount} rows
        </span>
      </div>

      <div className="oli-leaderboard-table">
        {/* Header */}
        <div
          className="oli-leaderboard-row oli-leaderboard-header"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <span /> {/* rank column */}
          {headers.map((h, i) => (
            <span key={i} style={{ textAlign: aligns[i] ?? "left" }}>
              {h}
            </span>
          ))}
          {hasChevron ? <span /> : null}
        </div>

        {/* Data rows */}
        {rows.map((row, idx) => {
          const rank = String(idx + 1).padStart(2, "0");
          const inner = (
            <motion.div
              className="oli-leaderboard-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: idx * 0.03,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-quaternary)",
                  letterSpacing: "0.04em",
                  textAlign: "left",
                }}
              >
                {rank}
              </span>
              {row.cells.map((cell, i) => (
                <span key={i} style={{ textAlign: row.aligns[i] ?? "left" }}>
                  {cell}
                </span>
              ))}
              {hasChevron ? (
                <span
                  className="oli-leaderboard-chevron"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    color: "var(--color-text-quaternary)",
                    textAlign: "right",
                  }}
                  aria-hidden
                >
                  ›
                </span>
              ) : null}
            </motion.div>
          );

          return row.href ? (
            <Link key={row.id} href={row.href} className="oli-leaderboard-link">
              {inner}
            </Link>
          ) : (
            <div key={row.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
