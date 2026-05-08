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
  const { rst, bold, dim, white } = ANSI;

  return [
    `  ${white}${bold}welcome to pellet.${rst}`,
    "",
    `  ${dim}your wallet is live on tempo. your device is the key —${rst}`,
    `  ${dim}no seed phrase, no private key export.${rst}`,
    "",
    `  ${dim}address:${rst} ${bold}${address}${rst}`,
    "",
    `  ${dim}starting Pellet Agent — ask anything, or type ${rst}${bold}/help${rst}${dim}.${rst}`,
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
  const termRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  function handleClear() {
    const term = termRef.current;
    const ws = wsRef.current;
    if (!term) return;
    // Reset xterm display + scrollback so the only thing on screen is the
    // banner we re-draw next.
    term.reset();
    writeBanner(term, term.cols, address, paired, agents);
    // Ctrl+L (form-feed) tells readline (running inside the agent REPL) to
    // redraw its prompt on the next line — preserves the shell prompt as
    // the user requested.
    if (ws?.readyState === WebSocket.OPEN) ws.send("\x0c");
  }

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

      // xterm samples font metrics at open() time — if JetBrains Mono isn't
      // loaded yet (next/font/google is lazy), it falls back to monospace and
      // the swap-in mid-render produces misaligned columns. Force-load both
      // weights before constructing the terminal.
      try {
        await Promise.all([
          document.fonts.load('13px "JetBrains Mono"'),
          document.fonts.load('700 13px "JetBrains Mono"'),
        ]);
      } catch {
        // Font load failures are non-fatal — xterm will use the fallback.
      }
      if (disposed) return;

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: "'JetBrains Mono', 'Commit Mono', ui-monospace, 'SFMono-Regular', monospace",
        theme: { background: bg, foreground: fg, cursor: fg },
        allowProposedApi: true,
      });
      termRef.current = term;

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
      wsRef.current = ws;

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
                if (!typeAbort.signal.aborted && ws?.readyState === WebSocket.OPEN) {
                  ws.send("pellet\r");
                }
              };
              if (sessions === 0 && agents === 0) {
                // Onboarding path: always launch after the welcome,
                // regardless of whether the PTY is fresh.
                typeLines(term, buildOnboardText(address), typeAbort.signal).then(launchAgent);
              } else if (msg.fresh) {
                // No onboarding, fresh PTY: launch directly.
                // On non-fresh PTY, scrollback restore keeps the prior state.
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
      wsRef.current = null;
      if (ro) ro.disconnect();
      if (term) term.dispose();
      termRef.current = null;
    };
  }, [address, paired, agents, sessions]);

  return (
    <div className="spec-terminal-card">
      <div className="spec-terminal-head">
        <span className="spec-col-head-left">TERMINAL</span>
        <span className="spec-col-head-right">
          <button
            type="button"
            className="spec-terminal-clear"
            onClick={handleClear}
            aria-label="Clear terminal output"
            title="Clear terminal output (keeps banner + prompt)"
          >
            CLEAR
          </button>
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
