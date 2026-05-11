"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchSyncEvents,
  bucketIntoCandles,
  pickInterval,
  type Candle,
  type SyncEvent,
} from "@/lib/pltn/candles";

// Lightweight-charts is a CommonJS-friendly ESM module. Dynamic-import keeps it
// out of the SSR bundle entirely.
type LWC = typeof import("lightweight-charts");

const POLL_MS = 30_000;

export function PriceChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    let cancelled = false;
    type Chart = ReturnType<LWC["createChart"]>;
    type Series = ReturnType<Chart["addSeries"]>;
    let chart: Chart | null = null;
    let candleSeries: Series | null = null;
    let lineSeries: Series | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let resizeObs: ResizeObserver | null = null;
    let events: SyncEvent[] = [];
    let intervalSec = 300;

    async function setup() {
      if (!containerRef.current) return;
      const lwc: LWC = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const fg = "#e8e6e1";
      const bg = "#0a0a0c";
      const fg3 = "#7a7872";
      const up = "#e8e6e1"; // bullish candle = paper (light)
      const down = "#5a5a55"; // bearish candle = muted grey

      chart = lwc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { type: lwc.ColorType.Solid, color: "transparent" },
          textColor: fg3,
          fontFamily:
            "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, monospace",
          fontSize: 10,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(232,230,225,0.05)", style: lwc.LineStyle.Dotted },
          horzLines: { color: "rgba(232,230,225,0.05)", style: lwc.LineStyle.Dotted },
        },
        rightPriceScale: {
          borderColor: "rgba(232,230,225,0.16)",
          textColor: fg3,
        },
        timeScale: {
          borderColor: "rgba(232,230,225,0.16)",
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          mode: lwc.CrosshairMode.Magnet,
          vertLine: {
            color: "rgba(232,230,225,0.32)",
            width: 1,
            style: lwc.LineStyle.Solid,
          },
          horzLine: {
            color: "rgba(232,230,225,0.32)",
            width: 1,
            style: lwc.LineStyle.Solid,
            labelBackgroundColor: bg,
          },
        },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
        handleScroll: true,
      });

      candleSeries = chart.addSeries(lwc.CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
        priceLineVisible: true,
        priceLineColor: "rgba(232,230,225,0.28)",
        priceLineStyle: lwc.LineStyle.Dashed,
        priceLineWidth: 1,
        lastValueVisible: true,
        priceFormat: {
          type: "price",
          precision: 8,
          minMove: 0.00000001,
        },
      });

      // Step-line overlay running through the closes — preserves the
      // continuous line aesthetic on top of the candles.
      lineSeries = chart.addSeries(lwc.LineSeries, {
        color: "rgba(232,230,225,0.55)",
        lineWidth: 1,
        lineType: lwc.LineType.WithSteps,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const refresh = async () => {
        try {
          const newEvents = await fetchSyncEvents();
          if (cancelled || !candleSeries) return;
          if (newEvents.length === 0) return;
          events = newEvents;
          const picked = pickInterval(events);
          intervalSec = picked.intervalSec;
          const candles: Candle[] = bucketIntoCandles(events, intervalSec, {
            forwardFill: true,
          });
          candleSeries.setData(
            candles.map((c) => ({
              time: c.time as never,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            })),
          );
          if (lineSeries) {
            lineSeries.setData(
              candles.map((c) => ({ time: c.time as never, value: c.close })),
            );
          }
          chart!.timeScale().fitContent();
          setEmpty(false);
        } catch {
          // Transient network failure — keep last data
        }
      };
      refresh();
      pollId = setInterval(refresh, POLL_MS);

      resizeObs = new ResizeObserver(() => {
        if (!chart || !containerRef.current) return;
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      });
      resizeObs.observe(containerRef.current);
    }

    setup();

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (resizeObs) resizeObs.disconnect();
      if (chart) chart.remove();
    };
  }, []);

  return (
    <div className="pltn-chart">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {empty && <div className="pltn-chart-empty">Awaiting first trade</div>}
    </div>
  );
}
