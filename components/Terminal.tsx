"use client";

import { useState, useEffect, useRef } from "react";

interface TerminalLine {
  type: "prompt" | "output" | "divider" | "header";
  command?: string;
  text?: string;
  color?: "green" | "yellow" | "muted" | "default";
}

interface TerminalProps {
  lines: TerminalLine[];
  interactive?: boolean;
  onCommand?: (cmd: string) => void;
}

export type { TerminalLine };

export function Terminal({ lines, interactive = false, onCommand }: TerminalProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (interactive) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, interactive]);

  const colorMap: Record<string, string> = {
    green: "var(--color-terminal-green)",
    yellow: "var(--color-terminal-yellow)",
    muted: "var(--color-terminal-muted)",
    default: "var(--color-terminal-text)",
  };

  return (
    <div
      style={{
        background: "var(--color-terminal)",
        borderRadius: interactive ? "0" : "0",
        padding: "24px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        lineHeight: 1.8,
        overflow: "auto",
        height: "100%",
        minHeight: interactive ? "100vh" : "auto",
      }}
    >
      {lines.map((line, i) => {
        if (line.type === "divider") {
          return <div key={i} style={{ borderTop: "1px solid #222", margin: "8px 0" }} />;
        }
        if (line.type === "header") {
          return (
            <div key={i} style={{ fontSize: "10px", textTransform: "uppercase" as const, letterSpacing: "1.5px", color: "#444", marginBottom: "4px", marginTop: "8px" }}>
              {line.text}
            </div>
          );
        }
        if (line.type === "prompt") {
          return (
            <div key={i} style={{ color: "var(--color-terminal-text)" }}>
              <span style={{ color: "var(--color-terminal-muted)" }}>$ </span>
              <span>{line.command}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ color: colorMap[line.color || "default"], paddingLeft: "16px" }}>
            {line.text}
          </div>
        );
      })}

      {interactive && (
        <div style={{ display: "flex", marginTop: "4px" }}>
          <span style={{ color: "var(--color-terminal-muted)", marginRight: "8px" }}>$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                onCommand?.(input.trim());
                setInput("");
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--color-terminal-text)",
              fontFamily: "inherit",
              fontSize: "inherit",
              flex: 1,
            }}
            autoFocus
            spellCheck={false}
          />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
