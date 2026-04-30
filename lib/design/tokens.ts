// Single source of truth for visual constants.
// Color values are also exported via globals.css @theme so Tailwind picks them up.

export const colors = {
  bg: "#000000",
  fg: "#ffffff",
  muted: "#888888",
  border: "#1a1a1a",
  hover: "#0a0a0a",
  accent: "#7a96b2", // soft Linear blue — used sparingly for highlights
} as const;

export type ColorToken = keyof typeof colors;
