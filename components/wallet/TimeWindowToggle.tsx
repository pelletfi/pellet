"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TIME_WINDOWS } from "@/lib/wallet/timeWindow";

const WINDOWS = TIME_WINDOWS;

export function TimeWindowToggle({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setWindow = (hours: number) => {
    const params = new URLSearchParams(searchParams);
    if (hours === 24) {
      params.delete("w");
    } else {
      const opt = WINDOWS.find((w) => w.value === hours);
      if (opt) params.set("w", opt.label);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="wallet-time-toggle">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          onClick={() => setWindow(w.value)}
          className={`wallet-time-toggle-btn${current === w.value ? " wallet-time-toggle-btn-active" : ""}`}
          aria-pressed={current === w.value}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

// Re-export for convenience (server components should import from @/lib/wallet/timeWindow directly).
export { windowHoursFromParam } from "@/lib/wallet/timeWindow";
