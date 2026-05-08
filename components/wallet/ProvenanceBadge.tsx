import { formatBlockNumber } from "@/lib/wallet/format";

export function ProvenanceBadge({
  sourceBlock,
  methodologyVersion,
}: {
  sourceBlock: number;
  methodologyVersion: string;
}) {
  return (
    <span
      title={`block ${formatBlockNumber(sourceBlock)} · methodology ${methodologyVersion}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--color-text-quaternary)",
        cursor: "help",
      }}
    >
      ◍ {methodologyVersion}
    </span>
  );
}
