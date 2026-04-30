import type { SubscriptionStatus, DeliveryStatus } from "@/lib/oli/webhooks-types";

type Tone = "active" | "muted" | "danger";

const ACTIVE = "#6080c0";
const MUTED = "var(--color-text-quaternary)";
const DANGER = "var(--color-error)";

function toneFor(status: SubscriptionStatus | DeliveryStatus): Tone {
  switch (status) {
    case "active":
    case "success":
      return "active";
    case "disabled_by_failures":
    case "dead":
      return "danger";
    default:
      return "muted";
  }
}

function toneColor(t: Tone): string {
  if (t === "active") return ACTIVE;
  if (t === "danger") return DANGER;
  return MUTED;
}

export function WebhookStatusPill({
  status,
}: {
  status: SubscriptionStatus | DeliveryStatus;
}) {
  const tone = toneFor(status);
  const color = toneColor(tone);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        border: `1px solid ${color}`,
        color,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        background: "transparent",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
