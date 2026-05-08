"use client";

import { useEffect, useRef } from "react";

function truncAddr(addr: string) {
  return addr.length <= 14 ? addr : addr.slice(0, 6) + "···" + addr.slice(-4);
}

const ANSI = {
  rst: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[38;5;67m",
  cyan: "\x1b[38;5;109m",
  white: "\x1b[97m",
} as const;

function writeBanner(
  term: any,
  cols: number,
  address: string,
  paired: number,
  agents: number,
) {
  const { rst, bold, dim, blue } = ANSI;

  const W = 50;
  const pad = (s: string, vis: number) =>
    s + " ".repeat(Math.max(0, W - vis));

  const top = dim + "┌" + "─".repeat(W + 2) + "┐" + rst;
  const bot = dim + "└" + "─".repeat(W + 2) + "┘" + rst;
  const row = (content: string, vis: number) =>
    dim + "│ " + rst + pad(content, vis) + dim + " │" + rst;
  const empty = row("", 0);

  const title = `${blue}${bold}>_${rst} ${bold}Pellet Agent${rst}`;
  const titleVis = ">_ Pellet Agent".length;

  const addrStr = truncAddr(address);
  const pairedStr = `${paired} device${paired !== 1 ? "s" : ""}`;
  const agentStr = agents > 0 ? `${agents} connected` : "none";

  const label = (l: string, w = 12) => `${dim}${l.padEnd(w)}${rst}`;
  const val = (v: string) => v;

  const col2 = 28;
  const pair = (l1: string, v1: string, v1len: number, l2: string, v2: string, v2len: number) => {
    const left = label(l1) + val(v1);
    const leftVis = 12 + v1len;
    const gap = " ".repeat(Math.max(2, col2 - leftVis));
    const right = label(l2, 10) + val(v2);
    const totalVis = leftVis + gap.length + 10 + v2len;
    return row(left + gap + right, totalVis);
  };

  const lines = [
    "",
    top,
    row(title, titleVis),
    empty,
    pair("network:", "tempo", 5, "paired:", pairedStr, pairedStr.length),
    pair("wallet:", addrStr, addrStr.length, "agents:", agentStr, agentStr.length),
    bot,
  ];

  for (const line of lines) {
    term.writeln(line);
  }
}

function buildOnboardText(address: string): string[] {
  const { rst, bold, dim, blue, cyan, white } = ANSI;

  return [
    `  ${white}${bold}welcome to pellet.${rst}`,
    "",
    `  ${dim}your wallet is live on tempo. here's what just happened:${rst}`,
    "",
    `  ${cyan}1.${rst} ${dim}your passkey generated a P-256 key pair on this device${rst}`,
    `  ${cyan}2.${rst} ${dim}we derived your tempo address from that public key${rst}`,
    `  ${cyan}3.${rst} ${dim}no seed phrase, no private key export — your device IS the key${rst}`,
    "",
    `  ${dim}your address:${rst} ${bold}${address}${rst}`,
    "",
    `  ${dim}─────────────────────────────────────────${rst}`,
    "",
    `  ${white}${bold}next: connect an agent.${rst}`,
    "",
    `  ${dim}pellet turns your wallet into something your AI can use.${rst}`,
    `  ${dim}any agent that speaks MCP can connect — claude code, chatgpt,${rst}`,
    `  ${dim}cursor, gemini, or anything custom.${rst}`,
    "",
    `  ${dim}for ${rst}${bold}claude code${rst}${dim}, run this in a separate terminal:${rst}`,
    "",
    `  ${cyan}  $ claude mcp add pellet --transport http ${blue}https://pellet.network/mcp${rst}`,
    "",
    `  ${dim}for ${rst}${bold}claude.ai${rst}${dim} or ${rst}${bold}chatgpt${rst}${dim}:${rst}`,
    "",
    `  ${dim}  settings → connectors → add → paste the URL:${rst}`,
    `  ${cyan}  https://pellet.network/mcp${rst}`,
    "",
    `  ${dim}when your agent first connects, an OAuth popup will ask you to${rst}`,
    `  ${dim}approve its permissions. you choose what it can do:${rst}`,
    "",
    `  ${cyan}•${rst} ${dim}read${rst}       ${dim}— check balances and transaction history${rst}`,
    `  ${cyan}•${rst} ${dim}chat${rst}       ${dim}— send messages through the wallet${rst}`,
    `  ${cyan}•${rst} ${dim}spend${rst}      ${dim}— pay for APIs and services (with limits you set)${rst}`,
    "",
    `  ${dim}─────────────────────────────────────────${rst}`,
    "",
    `  ${white}${bold}what happens after you connect:${rst}`,
    "",
    `  ${cyan}1.${rst} ${dim}your agent gets a session token scoped to your wallet${rst}`,
    `  ${cyan}2.${rst} ${dim}you set a spend budget — per-session or per-service${rst}`,
    `  ${cyan}3.${rst} ${dim}the agent can discover and pay for APIs as it works${rst}`,
    `  ${cyan}4.${rst} ${dim}every transaction is logged here in your dashboard${rst}`,
    "",
    `  ${dim}your agent never sees your private key. it gets a scoped${rst}`,
    `  ${dim}session that you can revoke at any time.${rst}`,
    "",
    `  ${dim}─────────────────────────────────────────${rst}`,
    "",
    `  ${white}${bold}this terminal is yours.${rst}`,
    "",
    `  ${dim}this is a fully functional shell running on your machine.${rst}`,
    `  ${dim}you can use it the same way you'd use any terminal —${rst}`,
    `  ${dim}run commands, launch claude code, codex, hermes, or any${rst}`,
    `  ${dim}CLI agent directly from here.${rst}`,
    "",
    `  ${dim}everything your agent does through this wallet is visible${rst}`,
    `  ${dim}in the dashboard to your right.${rst}`,
    "",
    `  ${dim}─────────────────────────────────────────${rst}`,
    "",
    `  ${dim}visit${rst} ${cyan}/wallet/onboard${rst} ${dim}for agent-specific setup guides${rst}`,
    `  ${dim}or connect your first agent and come back here.${rst}`,
    "",
  ];
}

async function typeLines(
  term: any,
  lines: string[],
  signal: AbortSignal,
) {
  const delay = (ms: number) =>
    new Promise<void>((r) => {
      const id = setTimeout(r, ms);
      signal.addEventListener("abort", () => { clearTimeout(id); r(); }, { once: true });
    });

  for (const line of lines) {
    if (signal.aborted) return;

    if (line === "") {
      term.writeln("");
      await delay(80);
      continue;
    }

    // Split ANSI sequences from visible characters so we can type
    // visible chars one at a time while writing escape codes instantly.
    const parts = line.split(/(\x1b\[[^m]*m)/);
    for (const part of parts) {
      if (signal.aborted) return;
      if (part.startsWith("\x1b[")) {
        term.write(part);
      } else {
        for (const ch of part) {
          if (signal.aborted) return;
          term.write(ch);
          await delay(12);
        }
      }
    }
    term.writeln("");
    await delay(40);
  }
}

interface TerminalCardProps {
  address?: string;
  paired?: number;
  agents?: number;
  sessions?: number;
}

export function TerminalCard({ address = "", paired = 0, agents = 0, sessions = 0 }: TerminalCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let disposed = false;
    let term: any;
    let ws: WebSocket | null = null;
    let fit: any;
    let ro: ResizeObserver | null = null;
    const typeAbort = new AbortController();

    function setStatus(s: string) {
      const el = statusRef.current;
      if (!el) return;
      el.dataset.status = s;
      if (s === "connected") {
        el.innerHTML = '<span class="spec-terminal-pulse"></span>LIVE';
      } else {
        el.textContent = s === "connecting" ? "CONNECTING" : "OFFLINE";
      }
    }

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (disposed) return;

      const styles = getComputedStyle(root);
      const bg = styles.getPropertyValue("--term-bg").trim() || "#ffffff";
      const fg = styles.getPropertyValue("--term-fg").trim() || "#1a1a1a";

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: "'Commit Mono', ui-monospace, 'SFMono-Regular', monospace",
        theme: { background: bg, foreground: fg, cursor: fg },
        allowProposedApi: true,
      });

      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(root);
      fit.fit();

      try {
        const { WebglAddon } = await import("@xterm/addon-webgl");
        term.loadAddon(new WebglAddon());
      } catch {}

      ro = new ResizeObserver(() => fit?.fit());
      ro.observe(root);

      term.onData((data: string) => {
        typeAbort.abort();
        if (ws?.readyState === WebSocket.OPEN) ws.send(data);
      });

      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      const shell = document.querySelector(".specimen-shell");
      if (shell) {
        new MutationObserver(() => {
          if (!root) return;
          const s = getComputedStyle(root);
          const newBg = s.getPropertyValue("--term-bg").trim() || "#ffffff";
          const newFg = s.getPropertyValue("--term-fg").trim() || "#1a1a1a";
          term.options.theme = { background: newBg, foreground: newFg, cursor: newFg };
        }).observe(shell, { attributes: true, attributeFilter: ["class"] });
      }

      setStatus("connecting");

      ws = new WebSocket("ws://localhost:7778/");

      ws.onopen = () => {
        setStatus("connected");
        ws!.send(JSON.stringify({ type: "session", address }));
        fit.fit();
        ws!.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      };

      let bannerDone = false;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "init") {
            if (!bannerDone) {
              writeBanner(term, term.cols, address, paired, agents);
              bannerDone = true;
              const launchAgent = () => {
                if (
                  msg.fresh &&
                  !typeAbort.signal.aborted &&
                  ws?.readyState === WebSocket.OPEN
                ) {
                  ws.send("pellet\r");
                }
              };
              if (sessions === 0 && agents === 0) {
                typeLines(term, buildOnboardText(address), typeAbort.signal).then(launchAgent);
              } else {
                launchAgent();
              }
            }
            return;
          }
        } catch {}
        term.write(e.data);
      };

      ws.onclose = () => setStatus("disconnected");
      ws.onerror = () => ws?.close();

      term.focus();
    })();

    return () => {
      disposed = true;
      typeAbort.abort();
      if (ws) { ws.onclose = null; ws.close(); ws = null; }
      if (ro) ro.disconnect();
      if (term) term.dispose();
    };
  }, [address, paired, agents, sessions]);

  return (
    <div className="spec-terminal-card">
      <div className="spec-terminal-head">
        <span className="spec-col-head-left">TERMINAL</span>
        <span className="spec-col-head-right">
          <span ref={statusRef} className="spec-terminal-status" data-status="connecting">
            CONNECTING
          </span>
        </span>
      </div>
      <div
        className="spec-terminal-body"
        ref={containerRef}
      />
    </div>
  );
}
