"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = {
  id: string;
  sessionId: string | null;
  sender: "agent" | "user" | "system";
  kind: "status" | "question" | "approval_request" | "reply" | "report";
  content: string;
  intentId: string | null;
  ts: string;
};

const MAX_MESSAGES = 500;
const MAX_INPUT = 8_000;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function shortSession(id: string | null): string {
  if (!id) return "system";
  return id.slice(0, 8);
}

export function SpecimenWalletChat({
  basePath,
  initialMessages,
}: {
  basePath: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // typing — sessionId of the agent currently composing, or null. Wired to
  // a server signal in a follow-up commit; for now stays null.
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const tailRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/wallet/chat/stream");
    es.onopen = () => setConnected(true);
    es.onmessage = (msg) => {
      try {
        const wire = JSON.parse(msg.data) as ChatMessage;
        if (seen.current.has(wire.id)) return;
        seen.current.add(wire.id);
        setMessages((prev) => {
          const next = [...prev, wire];
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
        });
        // A new message from this agent ends its "typing" state.
        setTypingAgent((prev) => (prev === wire.sessionId ? null : prev));
      } catch {
        // malformed payload — skip
      }
    };
    // Named event: 'typing' — agent signaled it's composing. Auto-clears
    // after 8s in case no message follows (e.g., agent crashed mid-task).
    es.addEventListener("typing", (msg) => {
      try {
        const evt = msg as MessageEvent;
        const wire = JSON.parse(evt.data) as { sessionId: string; ts: string };
        setTypingAgent(wire.sessionId);
      } catch {
        /* skip */
      }
    });
    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects on transient errors.
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  // Auto-clear stale typing indicator. Each typing signal resets the
  // timer; if no new signal or message arrives within 8s, hide it.
  useEffect(() => {
    if (!typingAgent) return;
    const t = setTimeout(() => setTypingAgent(null), 8_000);
    return () => clearTimeout(t);
  }, [typingAgent]);

  // Auto-scroll to latest on new message OR when the typing indicator
  // appears/disappears (so the indicator stays visible during long
  // agent responses).
  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typingAgent]);

  async function sendReply() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/wallet/chat/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      setInput("");
      // The SSE stream will deliver our own message back via the bus, so
      // we don't optimistically render — keeps the message ordering canonical.
      inputRef.current?.focus();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift-Enter for newline. Mirrors iMessage / Claude Code.
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      void sendReply();
    }
  }

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>02</span>
            <span>Wallet · Chat</span>
          </h1>
          <div className="spec-switch" role="group" aria-label="Wallet sections">
            <Link className="spec-switch-seg" href={`${basePath}/dashboard`}>
              DASHBOARD
            </Link>
            <Link
              className="spec-switch-seg"
              href={`${basePath}/dashboard/pair`}
              title="Pair an agent so it can post here"
            >
              PAIR AGENT
            </Link>
            <span className="spec-switch-seg spec-switch-seg-active">CHAT</span>
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">STATUS</span>
          <span>{connected ? "live · streaming" : "connecting…"}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">MESSAGES</span>
          <span>{messages.length}</span>
        </div>
      </section>

      <div className="spec-chat-container">
        <section className="spec-chat-pane" aria-label="Agent chat thread">
          {messages.length === 0 ? (
            <div className="spec-chat-empty">
              <span className="spec-chat-empty-label">no messages yet</span>
              <span className="spec-chat-empty-hint">
                pair an agent to start a thread. agents post status updates,
                approval requests, and reports here in real time.
              </span>
            </div>
          ) : (
            <ol className="spec-chat-list" role="log" aria-live="polite">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`spec-chat-row spec-chat-row-${m.sender}`}
                  data-kind={m.kind}
                >
                  <span className="spec-chat-meta">
                    <span className="spec-chat-time">{formatTime(m.ts)}</span>
                    <span className="spec-chat-sep">·</span>
                    <span className="spec-chat-sender">
                      {m.sender === "agent"
                        ? `agent:${shortSession(m.sessionId)}`
                        : m.sender === "user"
                          ? "you"
                          : m.sender}
                    </span>
                    <span className="spec-chat-sep">·</span>
                    <span className={`spec-chat-kind spec-chat-kind-${m.kind}`}>
                      [{m.kind.replace("_", " ")}]
                    </span>
                  </span>
                  <span className="spec-chat-content">{m.content}</span>
                </li>
              ))}
            </ol>
          )}
          {typingAgent && (
            <div
              className="spec-chat-typing"
              role="status"
              aria-label={`agent ${shortSession(typingAgent)} is composing`}
            >
              <span className="spec-chat-typing-dot" />
              <span className="spec-chat-typing-dot" />
              <span className="spec-chat-typing-dot" />
            </div>
          )}
          <div ref={tailRef} />
        </section>

        <form
          className="spec-chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void sendReply();
          }}
        >
          <div className="spec-chat-input-wrap">
            <textarea
              ref={inputRef}
              className="spec-chat-input"
              placeholder="reply to your agents…"
              rows={1}
              maxLength={MAX_INPUT}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
              aria-label="Type a reply"
            />
            <button
              type="submit"
              className="spec-chat-send"
              disabled={sending || input.trim().length === 0}
              title="Send (Enter)"
            >
              {sending ? "…" : "SEND"}
            </button>
          </div>
          {sendError && (
            <span className="spec-chat-send-err" role="alert">
              {sendError}
            </span>
          )}
        </form>
      </div>
    </>
  );
}
