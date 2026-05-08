export const TIME_WINDOWS = [
  { label: "24h", value: 24 },
  { label: "7d", value: 168 },
  { label: "30d", value: 720 },
  { label: "all", value: 8760 },
] as const;

export type WindowLabel = (typeof TIME_WINDOWS)[number]["label"];

export function windowHoursFromParam(param: string | undefined): number {
  const opt = TIME_WINDOWS.find((w) => w.label === param);
  return opt?.value ?? 24;
}
