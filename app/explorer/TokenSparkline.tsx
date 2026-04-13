"use client";

import { useState, useEffect } from "react";

interface TokenSparklineProps {
  poolAddress: string;
}

export default function TokenSparkline({ poolAddress }: TokenSparklineProps) {
  const [path, setPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(
      `https://api.geckoterminal.com/api/v2/networks/tempo/pools/${poolAddress}/ohlcv/day?limit=7`,
      { headers: { Accept: "application/json" } }
    )
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const bars = res.data?.attributes?.ohlcv_list as
          | [number, number, number, number, number, number][]
          | undefined;
        if (!bars || bars.length < 2) {
          setLoading(false);
          return;
        }

        // Extract close prices (index 4), bars come newest-first so reverse
        const closes = bars.map((b) => b[4]).reverse();
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const range = max - min || 1;

        const points = closes.map((c, i) => {
          const x = (i / (closes.length - 1)) * 60;
          const y = 20 - ((c - min) / range) * 20;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });

        setPath(`M${points.join("L")}`);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [poolAddress]);

  if (loading) {
    return (
      <div
        style={{
          width: 60,
          height: 20,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: 1,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 1,
          }}
        />
      </div>
    );
  }

  if (!path) return null;

  return (
    <svg
      width={60}
      height={20}
      viewBox="0 0 60 20"
      fill="none"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d={path}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
