import type { ReactNode } from "react";
import { LeaderboardClient } from "./LeaderboardClient";

export type LeaderboardCol<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
};

const RANK_WIDTH = "28px";
const CHEVRON_WIDTH = "16px";

export function Leaderboard<T extends { id: string }>({
  title,
  rows,
  cols,
  hrefFor,
}: {
  title: string;
  rows: T[];
  cols: LeaderboardCol<T>[];
  hrefFor?: (row: T) => string;
}) {
  const gridTemplate = [
    RANK_WIDTH,
    ...cols.map((c) => c.width ?? "1fr"),
    hrefFor ? CHEVRON_WIDTH : null,
  ]
    .filter(Boolean)
    .join(" ");

  const headers = cols.map((c) => c.header);
  const aligns = cols.map((c) => c.align ?? "left") as ("left" | "right")[];

  const rowData = rows.map((row) => ({
    id: row.id,
    cells: cols.map((c) => c.cell(row)),
    aligns,
    href: hrefFor ? hrefFor(row) : undefined,
  }));

  return (
    <LeaderboardClient
      title={title}
      rowCount={rows.length}
      headers={headers}
      aligns={aligns}
      gridTemplate={gridTemplate}
      rows={rowData}
      hasChevron={!!hrefFor}
    />
  );
}
