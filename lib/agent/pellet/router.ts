// Currently Haiku-only. Escalation logic intentionally NOT implemented —
// revisit only if measured Haiku quality is insufficient on real traffic.

export const PELLET_MODEL = "anthropic/claude-haiku-4-5";

export function selectModel(): string {
  return PELLET_MODEL;
}
