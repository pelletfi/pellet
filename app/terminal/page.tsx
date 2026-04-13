"use client";

import { useState, useCallback } from "react";
import { Terminal, type TerminalLine } from "@/components/Terminal";

function initialLines(): TerminalLine[] {
  return [
    { type: "header", text: "Pellet Terminal — Live on Tempo" },
    { type: "output", text: 'Type "help" for commands.', color: "muted" },
    { type: "divider" },
  ];
}

const HELP_LINES: TerminalLine[] = [
  { type: "header", text: "Available Commands" },
  { type: "output", text: "pellet tokens              List all tokens on Tempo" },
  { type: "output", text: "pellet analyze <address>   Analyze a specific token" },
  { type: "output", text: "pellet stablecoins         List stablecoins" },
  { type: "output", text: "pellet flows [hours]       Stablecoin flow matrix" },
  { type: "output", text: "pellet status              System health check" },
  { type: "output", text: "help                       Show this message" },
  { type: "output", text: "clear                      Clear terminal" },
  { type: "divider" },
];

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number): string {
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

export default function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines);

  const handleCommand = useCallback(async (raw: string) => {
    const input = raw.trim();
    const lower = input.toLowerCase();

    // Add the prompt line
    setLines((prev) => [...prev, { type: "prompt", command: input }]);

    // clear
    if (lower === "clear") {
      setLines(initialLines());
      return;
    }

    // help
    if (lower === "help") {
      setLines((prev) => [...prev, ...HELP_LINES]);
      return;
    }

    // Normalize: strip leading "pellet " prefix
    const cmd = lower.startsWith("pellet ") ? lower.slice(7) : lower;

    // tokens
    if (cmd === "tokens") {
      try {
        const res = await fetch("/api/v1/tokens?page=1");
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const tokens = data.tokens ?? [];
        const out: TerminalLine[] = [
          { type: "output", text: `${tokens.length} tokens found`, color: "green" },
        ];
        for (const t of tokens.slice(0, 10)) {
          const addr = (t.address ?? "").slice(0, 10) + "...";
          const name = (t.name ?? addr).padEnd(24);
          const price = fmtPrice(t.price_usd ?? 0);
          const vol = t.volume_24h != null ? `  vol ${fmt(t.volume_24h)}` : "";
          out.push({ type: "output", text: `${name} ${price}${vol}` });
        }
        out.push({ type: "divider" });
        setLines((prev) => [...prev, ...out]);
      } catch (err) {
        setLines((prev) => [
          ...prev,
          { type: "output", text: `Error: ${err instanceof Error ? err.message : "Failed to fetch tokens"}`, color: "yellow" },
          { type: "divider" },
        ]);
      }
      return;
    }

    // analyze <address>
    if (cmd.startsWith("analyze ")) {
      const address = cmd.slice(8).trim();
      if (!ADDRESS_RE.test(address)) {
        setLines((prev) => [
          ...prev,
          { type: "output", text: "Invalid address. Must be 0x + 40 hex characters.", color: "yellow" },
          { type: "divider" },
        ]);
        return;
      }

      // Add loading line
      setLines((prev) => [
        ...prev,
        { type: "output", text: "Analyzing...", color: "muted" },
      ]);

      try {
        const res = await fetch(`/api/v1/tokens/${address}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const m = data.market ?? {};
        const s = data.safety ?? {};
        const c = data.compliance ?? {};

        const out: TerminalLine[] = [
          { type: "header", text: "Market" },
          { type: "output", text: `Price:      ${fmtPrice(m.price_usd ?? 0)}` },
          { type: "output", text: `Volume 24h: ${fmt(m.volume_24h ?? 0)}` },
          { type: "output", text: `Liquidity:  ${fmt(m.liquidity_usd ?? 0)}` },
          { type: "header", text: "Safety" },
          { type: "output", text: `Verdict: ${s.verdict ?? "unknown"}`, color: s.verdict === "safe" ? "green" : "yellow" },
          { type: "output", text: `Score:   ${s.score ?? "N/A"}` },
          { type: "output", text: `Flags:   ${(s.flags ?? []).length > 0 ? (s.flags ?? []).join(", ") : "none"}` },
          { type: "header", text: "Compliance" },
          { type: "output", text: `Type:   ${data.token_type ?? "unknown"}` },
          { type: "output", text: `Policy: ${c.policy_type ?? "none"}` },
          { type: "divider" },
        ];

        // Replace the "Analyzing..." line with actual results
        setLines((prev) => {
          const copy = [...prev];
          // Find and remove the loading line
          const loadingIdx = copy.findLastIndex(
            (l) => l.type === "output" && l.text === "Analyzing..."
          );
          if (loadingIdx !== -1) copy.splice(loadingIdx, 1);
          return [...copy, ...out];
        });
      } catch (err) {
        setLines((prev) => {
          const copy = [...prev];
          const loadingIdx = copy.findLastIndex(
            (l) => l.type === "output" && l.text === "Analyzing..."
          );
          if (loadingIdx !== -1) copy.splice(loadingIdx, 1);
          return [
            ...copy,
            { type: "output", text: `Error: ${err instanceof Error ? err.message : "Failed to analyze token"}`, color: "yellow" },
            { type: "divider" },
          ];
        });
      }
      return;
    }

    // stablecoins
    if (cmd === "stablecoins") {
      try {
        const res = await fetch("/api/v1/stablecoins");
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const coins = data.stablecoins ?? [];
        const out: TerminalLine[] = [
          { type: "output", text: `${coins.length} stablecoins found`, color: "green" },
        ];
        for (const c of coins) {
          const sym = (c.symbol ?? "???").padEnd(12);
          const peg = fmtPrice(c.price_vs_pathusd ?? 1);
          const supply = c.current_supply
            ? `supply ${fmt(parseFloat(c.current_supply) / 1e18)}`
            : "";
          out.push({ type: "output", text: `${sym} peg ${peg}  ${supply}` });
        }
        out.push({ type: "divider" });
        setLines((prev) => [...prev, ...out]);
      } catch (err) {
        setLines((prev) => [
          ...prev,
          { type: "output", text: `Error: ${err instanceof Error ? err.message : "Failed to fetch stablecoins"}`, color: "yellow" },
          { type: "divider" },
        ]);
      }
      return;
    }

    // flows [hours]
    if (cmd === "flows" || cmd.startsWith("flows ")) {
      const parts = cmd.split(/\s+/);
      const hours = parts[1] ? parseInt(parts[1], 10) || 24 : 24;
      try {
        const res = await fetch(`/api/v1/stablecoins/flows?hours=${hours}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const flows = data.flows ?? [];
        const out: TerminalLine[] = [
          { type: "output", text: `${flows.length} flow pairs (${hours}h window)`, color: "green" },
        ];
        for (const f of flows) {
          const from = (f.from_token ?? "?").padEnd(12);
          const to = (f.to_token ?? "?").padEnd(12);
          const net = fmt(Math.abs(f.net_flow_usd ?? 0));
          const txs = f.tx_count ?? 0;
          out.push({ type: "output", text: `${from} → ${to} ${net}  (${txs} txs)` });
        }
        out.push({ type: "divider" });
        setLines((prev) => [...prev, ...out]);
      } catch (err) {
        setLines((prev) => [
          ...prev,
          { type: "output", text: `Error: ${err instanceof Error ? err.message : "Failed to fetch flows"}`, color: "yellow" },
          { type: "divider" },
        ]);
      }
      return;
    }

    // status
    if (cmd === "status") {
      try {
        const res = await fetch("/api/v1/health");
        const data = await res.json();
        if (data.error) throw new Error(data.error.message ?? data.message);
        const out: TerminalLine[] = [
          { type: "output", text: `Chain:  ${data.chain ?? "tempo"}`, color: "green" },
          { type: "output", text: `Block:  ${data.block ?? "unknown"}`, color: "green" },
          { type: "output", text: `Status: ${data.status ?? "unknown"}`, color: "green" },
          { type: "divider" },
        ];
        setLines((prev) => [...prev, ...out]);
      } catch (err) {
        setLines((prev) => [
          ...prev,
          { type: "output", text: `Error: ${err instanceof Error ? err.message : "Health check failed"}`, color: "yellow" },
          { type: "divider" },
        ]);
      }
      return;
    }

    // Unknown command
    setLines((prev) => [
      ...prev,
      { type: "output", text: `Unknown command: ${input}. Type "help" for commands.`, color: "muted" },
      { type: "divider" },
    ]);
  }, []);

  return (
    <div className="terminal-page">
      <div
        style={{
          background: "var(--color-terminal)",
          borderRadius: "8px",
          height: "calc(100vh - 120px)",
          overflow: "hidden",
        }}
      >
        <Terminal lines={lines} interactive onCommand={handleCommand} />
      </div>
    </div>
  );
}
