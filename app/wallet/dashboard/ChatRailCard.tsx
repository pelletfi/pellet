"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

type ChatMessage = {
  id: string;
  connectionId: string | null;
  clientId: string | null;
  sessionId: string | null;
  sender: "agent" | "user" | "system";
  kind: string;
  content: string;
  intentId: string | null;
  metadata: unknown;
  ts: string;
};

export function ChatRailCard({
  basePath = "/oli/wallet",
  agentNames = {},
  initialMessages = [],
}: {
  basePath?: string;
  agentNames?: Record<string, string>;
  initialMessages?: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seenIds = useRef(new Set<string>(initialMessages.map((m) => m.id)));
  const lastAgentConnectionId = useRef<string | null>(
    initialMessages.filter((m) => m.sender === "agent" && m.connectionId).at(-1)?.connectionId ?? null,
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let dead = false;

    function connect() {
      if (dead) return;
      es = new EventSource("/api/wallet/chat/stream");

      es.onmessage = (e) => {
        try {
          const msg: ChatMessage = JSON.parse(e.data);
          if (msg.sender === "agent" && msg.connectionId) {
            lastAgentConnectionId.current = msg.connectionId;
          }
          setMessages((prev) => {
            if (seenIds.current.has(msg.id)) return prev;
            seenIds.current.add(msg.id);
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 30);
        } catch { /* malformed */ }
      };

      es.addEventListener("typing", () => {
        setTyping(true);
        setTimeout(() => setTyping(false), 3000);
      });

      es.onerror = () => {
        es?.close();
        if (!dead) setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { dead = true; es?.close(); };
  }, [scrollToBottom]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");

    const optimisticId = `local-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      connectionId: null,
      clientId: null,
      sessionId: null,
      sender: "user",
      kind: "reply",
      content: text,
      intentId: null,
      metadata: null,
      ts: new Date().toISOString(),
    };
    seenIds.current.add(optimisticId);
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 30);

    try {
      await fetch("/api/wallet/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, agentId: lastAgentConnectionId.current }),
      });
    } catch { /* SSE will show it if it lands */ }
    setSending(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const recent = messages.slice(-8);

  return (
    <div className="chat-rail-card">
      <style>{`
        .chat-rail-card {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-height: 400px;
        }

        .chat-rail-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px 10px;
        }
        .chat-rail-head-left {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.55;
        }
        .chat-rail-head-right {
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.45;
        }
        .chat-rail-head-right a {
          opacity: 1;
          text-decoration: none;
          color: inherit;
          transition: opacity 0.15s ease;
        }
        .chat-rail-head-right a:hover { opacity: 0.8; }

        .chat-rail-messages {
          flex: 1;
          overflow-y: auto;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .chat-rail-messages::-webkit-scrollbar { width: 3px; }
        .chat-rail-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-rail-messages::-webkit-scrollbar-thumb { background: var(--line-thin, var(--color-border-subtle)); }

        .chat-rail-msg {
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-width: 92%;
        }
        .chat-rail-msg-agent { align-self: flex-start; }
        .chat-rail-msg-user { align-self: flex-end; }

        .chat-rail-msg-meta {
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.4;
        }
        .chat-rail-msg-user .chat-rail-msg-meta { text-align: right; }

        .chat-rail-msg-bubble {
          padding: 8px 12px;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
          border-radius: 14px;
        }
        .chat-rail-msg-agent .chat-rail-msg-bubble {
          background: color-mix(in oklch, var(--fg, #bcbcbc) 10%, var(--bg, #111));
        }
        .chat-rail-msg-user .chat-rail-msg-bubble {
          background: var(--fg, #bcbcbc);
          color: var(--bg, #111);
        }

        .chat-rail-typing {
          font-size: 10px;
          opacity: 0.4;
          padding: 0 2px;
        }

        .chat-rail-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          opacity: 0.4;
          text-align: center;
          padding: 24px 16px;
          line-height: 1.6;
        }

        .chat-rail-input {
          display: flex;
          align-items: flex-end;
          gap: 0;
          padding: 8px 14px 12px;
        }
        .chat-rail-input-wrap {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 0;
          padding: 4px 4px 4px 14px;
          background: color-mix(in oklch, var(--fg, #bcbcbc) 4%, var(--bg, #111));
          border: 1px solid color-mix(in oklch, var(--fg, #bcbcbc) 10%, var(--bg, #111));
          border-radius: 20px;
        }
        .chat-rail-input-wrap:focus-within {
          border-color: color-mix(in oklch, var(--fg, #bcbcbc) 20%, var(--bg, #111));
        }
        .chat-rail-input-wrap textarea {
          flex: 1;
          resize: none;
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 12px;
          padding: 5px 4px;
          line-height: 1.4;
          outline: none;
          min-height: 20px;
          max-height: 80px;
        }
        .chat-rail-input-wrap textarea::placeholder {
          color: color-mix(in oklch, var(--fg, #bcbcbc) 30%, var(--bg, #111));
        }
        .chat-rail-send {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--fg, #bcbcbc);
          color: var(--bg, #111);
          border: none;
          border-radius: 50%;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 120ms ease;
        }
        .chat-rail-send:hover:not(:disabled) { opacity: 0.85; }
        .chat-rail-send:active:not(:disabled) { transform: scale(0.9); }
        .chat-rail-send:disabled { opacity: 0.12; cursor: default; }

        @media (max-width: 900px) {
          .chat-rail-card { display: none; }
        }
      `}</style>

      <div className="chat-rail-head" onClick={() => setCollapsed((c) => !c)} style={{ cursor: "pointer" }}>
        <span className="chat-rail-head-left">
          Agent chat
          {collapsed && messages.length > 0 && (
            <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 9 }}>{messages.length}</span>
          )}
        </span>
        <span className="chat-rail-head-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`${basePath}/chat`} onClick={(e) => e.stopPropagation()}>open full →</Link>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            aria-hidden="true"
            style={{
              transition: "transform 150ms ease",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              opacity: 0.55,
            }}
          >
            <path d="M2.5 3.5L5 6.5L7.5 3.5" />
          </svg>
        </span>
      </div>

      {!collapsed && (
        <>
          <div className="chat-rail-messages" ref={scrollRef}>
            {recent.length === 0 ? (
              <div className="chat-rail-empty">
                No messages yet.<br />
                Agent updates and questions appear here.
              </div>
            ) : (
              recent.map((m) => (
                <div
                  key={m.id}
                  className={`chat-rail-msg chat-rail-msg-${m.sender === "user" ? "user" : "agent"}`}
                >
                  <div className="chat-rail-msg-meta">
                    {m.sender === "user" ? "you" : (m.connectionId && agentNames[m.connectionId]) || "agent"}
                    {" · "}
                    {formatTs(m.ts)}
                  </div>
                  <div className="chat-rail-msg-bubble">{m.content}</div>
                </div>
              ))
            )}
            {typing && <div className="chat-rail-typing">agent is typing…</div>}
          </div>

          <div className="chat-rail-input">
            <div className="chat-rail-input-wrap">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Reply…"
                rows={1}
              />
              <button
                className="chat-rail-send"
                onClick={send}
                disabled={sending || !draft.trim()}
              >
                {sending ? "…" : "↑"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
