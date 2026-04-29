// Single source of truth for visual constants.
// Color values are also exported via globals.css @theme so Tailwind picks them up.

export const colors = {
  bg: "#000000",
  fg: "#ffffff",
  muted: "#888888",
  border: "#1a1a1a",
  hover: "#0a0a0a",
  accent: "#2e5090", // YInMn Blue — used sparingly for highlights
} as const;

export type ColorToken = keyof typeof colors;
