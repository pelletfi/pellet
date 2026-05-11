"use client";

import { useEffect, useState } from "react";
import {
  readPair,
  type PairReserves,
} from "@/lib/pltn/pair";
import { TOTAL_SUPPLY } from "@/lib/pltn/constants";
import { Ticker } from "./motion";

type Snapshot = PairReserves & { fdvRaw: bigint };

export function LiveTicker() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const r = await readPair();
        if (cancelled) return;
        const fdvRaw = (TOTAL_SUPPLY * r.priceScaled12) / 10n ** 12n;
        setSnap({ ...r, fdvRaw });
      } catch {
        // keep last snapshot
      }
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Convert bigints to numbers for the animated ticker. Within our value
  // ranges (USD prices, sub-billion FDV) precision loss is irrelevant.
  const price = snap ? Number(snap.priceScaled12) / 1e12 : 0;
  const fdv = snap ? Number(snap.fdvRaw) / 1e6 : 0;
  const liquidity = snap ? Number(snap.liquidityQuoteRaw) / 1e6 : 0;

  return (
    <div className="pltn-quotes" role="group" aria-label="Token quotations">
      <Cell
        label="Price"
        loading={!snap}
        step={5}
        value={price}
        format={(n) => (n === 0 ? "—" : `$${formatPrice(n)}`)}
      />
      <Cell
        label="FDV"
        loading={!snap}
        step={5.4}
        value={fdv}
        format={(n) => (n === 0 ? "—" : formatCompactUSD(n))}
      />
      <Cell label="Supply" step={5.8} value={100_000_000} format={() => "100M"} />
      <Cell
        label="Liq"
        loading={!snap}
        step={6.2}
        value={liquidity}
        format={(n) => (n === 0 ? "—" : formatCompactUSD(n))}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  format,
  step,
  loading,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  step: number;
  loading?: boolean;
}) {
  return (
    <div className="pltn-quote">
      <div className="pltn-quote-k">{label}</div>
      <div className="pltn-quote-v" data-loading={loading ? 1 : 0}>
        <Ticker value={value} format={format} step={step} />
      </div>
    </div>
  );
}

function formatPrice(n: number): string {
  if (n >= 1) return n.toFixed(2);
  // Show enough sig figs for sub-dollar prices, trim trailing zeros
  const s = n.toFixed(10);
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

function formatCompactUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n >= 1e4 ? 1 : 2)}K`;
  return `$${n.toFixed(2)}`;
}
