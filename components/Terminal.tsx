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
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (hasInteracted.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const colorMap: Record<string, string> = {
    green: "var(--color-success)",
    yellow: "var(--color-warning)",
    muted: "var(--color-text-quaternary)",
    default: "var(--color-text-secondary)",
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: "var(--color-bg-subtle)",
        padding: "24px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        lineHeight: 1.8,
        overflowY: "auto",
        height: "100%",
      }}
    >
      {lines.map((line, i) => {
        if (line.type === "divider") {
          return <div key={i} style={{ borderTop: "1px solid var(--color-border-subtle)", margin: "8px 0" }} />;
        }
        if (line.type === "header") {
          return (
            <div key={i} style={{ fontSize: "10px", textTransform: "uppercase" as const, letterSpacing: "1.5px", color: "var(--color-text-quaternary)", marginBottom: "4px", marginTop: "8px" }}>
              {line.text}
            </div>
          );
        }
        if (line.type === "prompt") {
          return (
            <div key={i} style={{ color: "var(--color-text-primary)" }}>
              <span style={{ color: "var(--color-text-quaternary)" }}>$ </span>
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
          <span style={{ color: "var(--color-text-quaternary)", marginRight: "8px" }}>$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                hasInteracted.current = true;
                onCommand?.(input.trim());
                setInput("");
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--color-text-primary)",
              fontFamily: "inherit",
              fontSize: "inherit",
              flex: 1,
            }}
            autoFocus
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
