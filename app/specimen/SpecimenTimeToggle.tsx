"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TIME_WINDOWS } from "@/lib/wallet/timeWindow";

export function SpecimenTimeToggle({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setWindow = (hours: number, label: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (hours === 24) {
      params.delete("w");
    } else {
      params.set("w", label);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="spec-switch" role="group" aria-label="Time window">
      {TIME_WINDOWS.map((w) => {
        const active = current === w.value;
        return (
          <button
            key={w.value}
            type="button"
            onClick={() => setWindow(w.value, w.label)}
            aria-pressed={active}
            className={`spec-switch-seg${active ? " spec-switch-seg-active" : ""}`}
          >
            {w.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
