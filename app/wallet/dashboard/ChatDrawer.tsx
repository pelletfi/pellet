"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

export function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const seenIds = useRef(new Set<string>());
  const openRef = useRef(open);
  openRef.current = open;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/wallet/chat/stream");
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg: ChatMessage = JSON.parse(e.data);
        setMessages((prev) => {
          if (seenIds.current.has(msg.id)) return prev;
          seenIds.current.add(msg.id);
          if (!openRef.current && msg.sender === "agent") {
            setUnread((n) => n + 1);
          }
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 30);
      } catch { /* malformed */ }
    };

    es.addEventListener("typing", () => {
      setTyping(true);
      setTimeout(() => setTyping(false), 3000);
    });

    return () => es.close();
  }, [scrollToBottom]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(scrollToBottom, 50);
      inputRef.current?.focus();
    }
  }, [open, scrollToBottom]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      await fetch("/api/wallet/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
    } catch { /* swallow — SSE will show the message if it lands */ }
    setSending(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <style>{`
        .chat-drawer-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 900;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 28px;
          background: var(--color-bg-base);
          box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
          cursor: pointer;
          user-select: none;
          transition: background 0.15s ease;
        }
        .chat-drawer-bar:hover {
          background: var(--color-bg-elevated, var(--color-bg-base));
        }
        .chat-drawer-label {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chat-drawer-badge {
          min-width: 16px;
          height: 16px;
          padding: 0 5px;
          border-radius: 8px;
          background: var(--color-accent);
          color: #fff;

          font-size: 9px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .chat-drawer-toggle {

          font-size: 10px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.04em;
        }

        .chat-drawer-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 901;
          height: 60vh;
          max-height: 600px;
          min-height: 320px;
          display: flex;
          flex-direction: column;
          background: var(--color-bg-base);
          box-shadow: 0 -4px 24px rgba(0,0,0,0.1);
          border-radius: 20px 20px 0 0;
          transform: translateY(100%);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chat-drawer-panel[data-open="true"] {
          transform: translateY(0);
        }

        .chat-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 28px 10px;
          flex-shrink: 0;
        }
        .chat-drawer-title {
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--color-text-primary);
        }
        .chat-drawer-close {
          background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
          border: none;
          border-radius: 16px;
          padding: 6px 14px;
          cursor: pointer;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
          transition: opacity 0.15s ease;
        }
        .chat-drawer-close:hover {
          opacity: 0.7;
        }

        .chat-drawer-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chat-drawer-messages::-webkit-scrollbar { width: 4px; }
        .chat-drawer-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-drawer-messages::-webkit-scrollbar-thumb { background: var(--color-border-subtle); }

        .chat-msg {
          max-width: 80%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .chat-msg-agent { align-self: flex-start; }
        .chat-msg-user { align-self: flex-end; }

        .chat-msg-bubble {
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
          border-radius: 18px;
        }
        .chat-msg-agent .chat-msg-bubble {
          background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
          color: var(--color-text-secondary);
        }
        .chat-msg-user .chat-msg-bubble {
          background: var(--color-text-primary);
          color: var(--color-bg-base);
        }
        .chat-msg-meta {

          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .chat-msg-agent .chat-msg-meta { padding-left: 2px; }
        .chat-msg-user .chat-msg-meta { text-align: right; padding-right: 2px; }

        .chat-typing {

          font-size: 10px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.04em;
          padding: 0 2px;
        }

        .chat-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;

          font-size: 11px;
          color: var(--color-text-quaternary);
          text-align: center;
          padding: 32px;
          line-height: 1.6;
        }

        .chat-drawer-input {
          display: flex;
          align-items: flex-end;
          gap: 0;
          padding: 10px 28px 16px;
          flex-shrink: 0;
        }
        .chat-drawer-input-wrap {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 0;
          padding: 6px 6px 6px 20px;
          background: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent);
          border-radius: 24px;
        }
        .chat-drawer-input-wrap:focus-within {
          border-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-text-primary) 5%, transparent);
        }
        .chat-drawer-input-wrap textarea {
          flex: 1;
          resize: none;
          border: none;
          background: transparent;
          color: var(--color-text-primary);
          font-size: 14px;
          padding: 7px 4px;
          line-height: 1.5;
          outline: none;
          min-height: 24px;
          max-height: 120px;
        }
        .chat-drawer-input-wrap textarea::placeholder {
          color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
        }
        .chat-drawer-send {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-text-primary);
          color: var(--color-bg-base);
          border: none;
          border-radius: 50%;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 120ms ease;
        }
        .chat-drawer-send:hover:not(:disabled) { opacity: 0.85; }
        .chat-drawer-send:active:not(:disabled) { transform: scale(0.9); }
        .chat-drawer-send:disabled { opacity: 0.12; cursor: default; }

        @media (min-width: 901px) {
          .chat-drawer-bar,
          .chat-drawer-panel { display: none; }
        }
        @media (max-width: 700px) {
          .chat-drawer-panel { height: 80vh; max-height: none; }
          .chat-drawer-header { padding: 12px 20px; }
          .chat-drawer-messages { padding: 16px 20px; }
          .chat-drawer-input { padding: 12px 20px; }
          .chat-drawer-bar { padding: 10px 20px; }
          .chat-msg { max-width: 90%; }
        }
      `}</style>

      {/* Collapsed bar */}
      {!open && (
        <div className="chat-drawer-bar" onClick={() => setOpen(true)}>
          <span className="chat-drawer-label">
            agent chat
            {unread > 0 && <span className="chat-drawer-badge">{unread}</span>}
            {typing && !unread && <span style={{ color: "var(--color-accent)", fontSize: 9 }}>typing…</span>}
          </span>
          <span className="chat-drawer-toggle">↑ open</span>
        </div>
      )}

      {/* Expanded panel */}
      <div className="chat-drawer-panel" data-open={open}>
        <div className="chat-drawer-header">
          <span className="chat-drawer-title">Chat</span>
          <button className="chat-drawer-close" onClick={() => setOpen(false)}>
            ↓ close
          </button>
        </div>

        <div className="chat-drawer-messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="chat-empty">
              No messages yet.<br />
              When a connected agent sends updates or asks questions, they appear here.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`chat-msg chat-msg-${m.sender === "user" ? "user" : "agent"}`}>
                <div className="chat-msg-meta">
                  {m.sender === "user" ? "you" : m.clientId ? m.clientId.slice(0, 12) : "agent"}
                  {" · "}
                  {formatTs(m.ts)}
                  {m.kind !== "reply" && m.kind !== "status" && (
                    <> · {m.kind.replace("_", " ")}</>
                  )}
                </div>
                <div className="chat-msg-bubble">{m.content}</div>
              </div>
            ))
          )}
          {typing && <div className="chat-typing">agent is typing…</div>}
        </div>

        <div className="chat-drawer-input">
          <div className="chat-drawer-input-wrap">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Reply to your agent…"
              rows={1}
            />
            <button
              className="chat-drawer-send"
              onClick={send}
              disabled={sending || !draft.trim()}
            >
              {sending ? "…" : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
