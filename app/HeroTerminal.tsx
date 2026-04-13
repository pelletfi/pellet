"use client";

import { useState, useEffect } from "react";
import { Terminal } from "@/components/Terminal";
import type { TerminalLine } from "@/components/Terminal";

interface Token {
  address: string;
  price_usd: number;
  liquidity_usd: number;
  volume_24h: number;
  name?: string;
  symbol?: string;
}

interface Stablecoin {
  name: string;
  symbol: string;
  price_vs_pathusd: number;
  current_supply: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function HeroTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "output", text: "Loading Tempo data...", color: "muted" },
  ]);

  useEffect(() => {
    async function load() {
      const result: TerminalLine[] = [];

      try {
        const base = process.env.NEXT_PUBLIC_BASE_URL || "";

        // Fetch tokens and stablecoins in parallel
        const [tokensRes, stablecoinsRes] = await Promise.all([
          fetch(`${base}/api/v1/tokens`).then((r) => r.json()),
          fetch(`${base}/api/v1/stablecoins`).then((r) => r.json()),
        ]);

        const tokens: Token[] = tokensRes.tokens ?? [];
        const stablecoins: Stablecoin[] = stablecoinsRes.stablecoins ?? [];

        // Command 1: top 3 tokens
        result.push({ type: "prompt", command: "pellet tokens --top 3" });
        result.push({ type: "header", text: "Top tokens by 24h volume" });

        const top3 = tokens.slice(0, 3);
        if (top3.length === 0) {
          result.push({ type: "output", text: "No token data available", color: "muted" });
        } else {
          for (const t of top3) {
            const label = (t.name || t.symbol || `${t.address.slice(0, 6)}…${t.address.slice(-4)}`).padEnd(14);
            result.push({
              type: "output",
              text: `${label} ${fmt(t.price_usd).padEnd(12)} vol ${fmt(t.volume_24h)}`,
            });
          }
        }

        result.push({ type: "divider" });

        // Command 2: stablecoins summary
        result.push({ type: "prompt", command: "pellet stablecoins --summary" });
        result.push({
          type: "output",
          text: `${stablecoins.length} stablecoins tracked on Tempo`,
          color: "default",
        });

        const top2 = stablecoins.slice(0, 2);
        for (const s of top2) {
          result.push({
            type: "output",
            text: `${(s.symbol || "???").padEnd(14)} peg $${(s.price_vs_pathusd ?? 1).toFixed(4)}`,
            color: "green",
          });
        }

        result.push({ type: "divider" });

        // Command 3: status
        result.push({ type: "prompt", command: "pellet status" });
        result.push({ type: "output", text: "All systems operational", color: "green" });
      } catch {
        result.push({ type: "prompt", command: "pellet status" });
        result.push({
          type: "output",
          text: "Could not reach Tempo APIs — check connection",
          color: "yellow",
        });
      }

      setLines(result);
    }

    load();
  }, []);

  return <Terminal lines={lines} />;
}
