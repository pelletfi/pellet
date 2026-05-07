"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = `ws://localhost:${typeof window !== "undefined" ? (window as any).__PELLET_TERMINAL_PORT || 7778 : 7778}/`;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000];

type Status = "connecting" | "connected" | "disconnected";

function truncAddr(addr: string) {
  return addr.length <= 14 ? addr : addr.slice(0, 6) + "···" + addr.slice(-4);
}

const ANSI = {
  rst: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[38;5;67m",
} as const;

function writeBanner(
  term: any,
  cols: number,
  address: string,
  paired: number,
  agents: number,
  sessions: number,
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

  const title = `${blue}${bold}>_${rst} ${bold}Pellet Wallet${rst} ${dim}(v0.1.0)${rst}`;
  const titleVis = ">_ Pellet Wallet (v0.1.0)".length;

  const label = (l: string, w = 12) => `${dim}${l.padEnd(w)}${rst}`;
  const val = (v: string) => v;

  const addrStr = truncAddr(address);
  const pairedStr = `${paired} device${paired !== 1 ? "s" : ""}`;
  const agentStr = agents > 0 ? `${agents} connected` : "none";

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
    pair("address:", addrStr, addrStr.length, "agent:", agentStr, agentStr.length),
    bot,
    "",
  ];

  for (const line of lines) {
    term.writeln(line);
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
  const termRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<any>(null);
  const retryRef = useRef(0);
  const addressRef = useRef(address);
  addressRef.current = address;
  const [status, setStatus] = useState<Status>("connecting");

  const bannerClearedRef = useRef(false);
  const showBannerRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      retryRef.current = 0;
      ws.send(JSON.stringify({ type: "session", address: addressRef.current }));
      if (fitRef.current) {
        fitRef.current.fit();
        const term = termRef.current;
        if (term) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      }
    };

    ws.onmessage = (e) => {
      const term = termRef.current;
      if (!term) return;

      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "init") {
          if (!msg.fresh) {
            showBannerRef.current = false;
            bannerClearedRef.current = true;

            term.write("\x1b[2J\x1b[H");
            term.clear();
          }
          return;
        }
      } catch {}

      term.write(e.data);
    };

    ws.onclose = () => {
      setStatus("disconnected");
      const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
      retryRef.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (disposed) return;

      const root = containerRef.current;
      if (!root) return;

      const styles = getComputedStyle(root);
      const bg = styles.getPropertyValue("--term-bg").trim() || "#ffffff";
      const fg = styles.getPropertyValue("--term-fg").trim() || "#1a1a1a";

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: "'Commit Mono', ui-monospace, 'SFMono-Regular', monospace",
        theme: { background: bg, foreground: fg, cursor: fg },
        allowProposedApi: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);

      try {
        const { WebglAddon } = await import("@xterm/addon-webgl");
        term.loadAddon(new WebglAddon());
      } catch {}

      term.open(root);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;

      if (address) writeBanner(term, term.cols, address, paired, agents, sessions);

      term.onData((data) => {
        if (!bannerClearedRef.current && data.includes("\r")) {
          bannerClearedRef.current = true;
          term.write("\x1b[2J\x1b[H");
          term.clear();
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(data);
        }
      });

      term.onResize(({ cols, rows }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      const ro = new ResizeObserver(() => fit.fit());
      ro.observe(root);

      function syncTheme() {
        if (!root) return;
        const s = getComputedStyle(root);
        const newBg = s.getPropertyValue("--term-bg").trim() || "#ffffff";
        const newFg = s.getPropertyValue("--term-fg").trim() || "#1a1a1a";
        term.options.theme = { background: newBg, foreground: newFg, cursor: newFg };
      }

      const shell = document.querySelector(".specimen-shell");
      const mo = shell ? new MutationObserver(() => syncTheme()) : null;
      if (shell) mo?.observe(shell, { attributes: true, attributeFilter: ["class"] });

      connect();

      return () => {
        ro.disconnect();
        mo?.disconnect();
        term.dispose();
      };
    }

    const cleanup = init();
    return () => {
      disposed = true;
      cleanup.then((fn) => fn?.());
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      bannerClearedRef.current = false;
      showBannerRef.current = true;
    };
  }, [connect]);

  return (
    <div className="spec-terminal-card">
      <div className="spec-terminal-head">
        <span className="spec-col-head-left">TERMINAL</span>
        <span className="spec-col-head-right">
          <span className="spec-terminal-status" data-status={status}>
            {status === "connected" ? "LIVE" : status === "connecting" ? "CONNECTING" : "OFFLINE"}
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
