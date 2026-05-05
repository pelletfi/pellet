"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { WalletTabs } from "@/components/oli/WalletTabs";

type ChatMessage = {
  id: string;
  connectionId: string | null;
  clientId: string | null;
  sessionId: string | null;
  sender: "agent" | "user" | "system";
  kind: "status" | "question" | "approval_request" | "reply" | "report";
  content: string;
  intentId: string | null;
  ts: string;
};

type ChatAgent = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: "cimd" | "pre" | "dynamic";
  tokenState: "active" | "expired" | "revoked" | "missing";
  webhookEnabled: boolean;
  lastSeenAt: string;
};

const MAX_MESSAGES = 500;
const MAX_INPUT = 8_000;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - msgDay.getTime();
  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function isDayBoundary(prevIso: string, currIso: string): boolean {
  const a = new Date(prevIso);
  const b = new Date(currIso);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

function shortSession(id: string | null): string {
  if (!id) return "system";
  return id.slice(0, 8);
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── Markdown bubble ─────────────────────────────────────────────────────

function ChatBubble({
  content,
  isUser,
  isStreaming,
  streamDelta,
}: {
  content: string;
  isUser: boolean;
  isStreaming: boolean;
  streamDelta?: string;
}) {
  const full = streamDelta ? content + streamDelta : content;

  // User messages are short and rarely contain markdown — render plain.
  // Agent messages get full markdown rendering.
  if (isUser) {
    return (
      <span className="spec-chat-content">
        {full}
        {isStreaming && <span className="spec-chat-cursor" aria-hidden="true" />}
      </span>
    );
  }

  return (
    <div className="spec-chat-content spec-chat-md">
      <Markdown
        components={{
          a: ({ children, href, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
        }}
      >
        {full}
      </Markdown>
      {isStreaming && <span className="spec-chat-cursor" aria-hidden="true" />}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function SpecimenWalletChat({
  basePath,
  agents,
  selectedAgentId,
  initialMessages,
}: {
  basePath: string;
  agents: ChatAgent[];
  selectedAgentId: string | null;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<Map<string, string>>(new Map());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const seen = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const tailRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  // Scroll-pause: true when user is near the bottom (within 80px).
  const isNearBottom = useRef(true);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const agentNameByConnection = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent) => map.set(agent.id, agent.clientName));
    return map;
  }, [agents]);

  // ── Scroll-pause: track whether user has scrolled away from bottom ────
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = pane;
      const near = scrollHeight - scrollTop - clientHeight < 80;
      isNearBottom.current = near;
      setShowScrollBtn(!near);
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => pane.removeEventListener("scroll", onScroll);
  }, []);

  // ── Reset on agent switch ─────────────────────────────────────────────
  useEffect(() => {
    setMessages(initialMessages);
    seen.current = new Set(initialMessages.map((m) => m.id));
    setTypingAgent(null);
    setSendError(null);
    setInput("");
    setStreaming(new Map());
    isNearBottom.current = true;
    if (selectedAgentId) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [initialMessages, selectedAgentId]);

  // ── SSE connection ────────────────────────────────────────────────────
  useEffect(() => {
    const query = selectedAgentId
      ? `?agent=${encodeURIComponent(selectedAgentId)}`
      : "";
    const es = new EventSource(`/api/wallet/chat/stream${query}`);
    es.onopen = () => setConnected(true);
    es.onmessage = (msg) => {
      try {
        const wire = JSON.parse(msg.data) as ChatMessage;
        if (seen.current.has(wire.id)) return;
        seen.current.add(wire.id);
        setMessages((prev) => {
          // Replace optimistic message if it matches content+sender.
          const optimisticIdx = prev.findIndex(
            (m) =>
              m.id.startsWith("optimistic-") &&
              m.sender === wire.sender &&
              m.content === wire.content,
          );
          if (optimisticIdx !== -1) {
            const next = [...prev];
            next[optimisticIdx] = wire;
            return next;
          }
          const next = [...prev, wire];
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
        });
        setTypingAgent((prev) =>
          prev && (prev === wire.connectionId || prev === wire.sessionId)
            ? null
            : prev,
        );
      } catch {
        /* malformed */
      }
    };

    // Streaming chunks
    es.addEventListener("chunk", (msg) => {
      try {
        const evt = msg as MessageEvent;
        const wire = JSON.parse(evt.data) as {
          messageId: string;
          delta: string;
          done: boolean;
        };
        if (wire.done) {
          setStreaming((prev) => {
            const buffered = (prev.get(wire.messageId) ?? "") + wire.delta;
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === wire.messageId
                  ? { ...m, content: m.content + buffered }
                  : m,
              ),
            );
            const next = new Map(prev);
            next.delete(wire.messageId);
            return next;
          });
          setTypingAgent(null);
        } else {
          setStreaming((prev) => {
            const next = new Map(prev);
            next.set(
              wire.messageId,
              (prev.get(wire.messageId) ?? "") + wire.delta,
            );
            return next;
          });
          setTypingAgent(null);
        }
      } catch {
        /* skip */
      }
    });

    // Typing pings
    es.addEventListener("typing", (msg) => {
      try {
        const evt = msg as MessageEvent;
        const wire = JSON.parse(evt.data) as {
          connectionId: string | null;
          sessionId: string;
          ts: string;
        };
        setTypingAgent(wire.connectionId ?? wire.sessionId);
      } catch {
        /* skip */
      }
    });
    es.onerror = () => setConnected(false);
    return () => {
      es.close();
      setConnected(false);
    };
  }, [selectedAgentId]);

  // Auto-clear stale typing indicator after 8s.
  useEffect(() => {
    if (!typingAgent) return;
    const t = setTimeout(() => setTypingAgent(null), 8_000);
    return () => clearTimeout(t);
  }, [typingAgent]);

  // Auto-scroll — only when user is near the bottom (scroll-pause).
  useEffect(() => {
    if (isNearBottom.current) {
      tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, typingAgent, streaming.size]);

  // ── Auto-resize textarea ──────────────────────────────────────────────
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  // ── Optimistic send ───────────────────────────────────────────────────
  async function sendReply() {
    const content = input.trim();
    if (!content || sending) return;

    // Optimistic: show the message immediately.
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      connectionId: selectedAgentId,
      clientId: null,
      sessionId: null,
      sender: "user",
      kind: "reply",
      content,
      intentId: null,
      ts: new Date().toISOString(),
    };
    seen.current.add(optimisticId);
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    isNearBottom.current = true;

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/wallet/chat/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, agentId: selectedAgentId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      inputRef.current?.focus();
    } catch (err) {
      // Remove the optimistic message on failure.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      seen.current.delete(optimisticId);
      setSendError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) ||
      (e.key === "Enter" && (e.metaKey || e.ctrlKey))
    ) {
      e.preventDefault();
      void sendReply();
    }
  }

  function senderLabel(m: ChatMessage): string {
    if (m.sender === "user") return "you";
    if (m.sender === "system") return "system";
    if (m.connectionId) {
      return (
        agentNameByConnection.get(m.connectionId) ??
        `agent:${m.connectionId.slice(0, 8)}`
      );
    }
    return `agent:${shortSession(m.sessionId)}`;
  }

  const canReply = Boolean(selectedAgent);

  function isNewSender(idx: number): boolean {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    return (
      prev.sender !== curr.sender ||
      prev.connectionId !== curr.connectionId
    );
  }

  function isTimeGap(idx: number): boolean {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].ts).getTime();
    const curr = new Date(messages[idx].ts).getTime();
    return curr - prev > 15 * 60_000;
  }

  function bubblePosition(idx: number): "solo" | "first" | "mid" | "last" {
    const curr = messages[idx];
    const samePrev =
      idx > 0 &&
      messages[idx - 1].sender === curr.sender &&
      messages[idx - 1].connectionId === curr.connectionId &&
      !isTimeGap(idx);
    const sameNext =
      idx < messages.length - 1 &&
      messages[idx + 1].sender === curr.sender &&
      messages[idx + 1].connectionId === curr.connectionId &&
      !isTimeGap(idx + 1);
    if (samePrev && sameNext) return "mid";
    if (!samePrev && sameNext) return "first";
    if (samePrev && !sameNext) return "last";
    return "solo";
  }

  function isDayBound(idx: number): boolean {
    if (idx === 0) return true;
    return isDayBoundary(messages[idx - 1].ts, messages[idx].ts);
  }

  return (
    <div className="spec-wallet-float spec-chat-fullpage">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Chat</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">
            {connected ? "LIVE" : "CONNECTING"}
          </span>
          <span>{selectedAgent?.clientName ?? "all threads"}</span>
          {messages.length > 0 && (
            <>
              <span className="spec-page-subhead-dot">·</span>
              <span>{messages.length} messages</span>
            </>
          )}
        </div>
      </section>

      {/* Reconnection banner */}
      {!connected && messages.length > 0 && (
        <div className="spec-chat-reconnect" role="alert">
          Connection lost — reconnecting…
        </div>
      )}

      <div className="spec-chat-container">
        <aside className="spec-chat-agents" aria-label="Agent threads">
          <div className="spec-chat-agents-head">
            <span>THREADS</span>
            <Link href={`${basePath}/dashboard/pair`}>+</Link>
          </div>
          {agents.length === 0 ? (
            <div className="spec-chat-agents-empty">
              No agents connected yet.
              <Link
                href={`${basePath}/dashboard/pair`}
                style={{ display: "block", marginTop: 12 }}
              >
                Connect an agent
              </Link>
            </div>
          ) : (
            <ol className="spec-chat-agent-list">
              {agents.map((agent) => {
                const isActive = agent.tokenState === "active";
                return (
                  <li key={agent.id}>
                    <Link
                      className={`spec-chat-agent-link${
                        agent.id === selectedAgentId
                          ? " spec-chat-agent-link-active"
                          : ""
                      }`}
                      href={`${basePath}/chat?agent=${agent.id}`}
                    >
                      <span className="spec-chat-agent-name">
                        <span
                          className="spec-chat-agent-dot"
                          data-active={isActive}
                        />
                        {agent.clientName}
                      </span>
                      <span className="spec-chat-agent-seen">
                        {fmtAgo(agent.lastSeenAt)} ago
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>

        <div className="spec-chat-main">
          <section
            className="spec-chat-pane"
            ref={paneRef}
            aria-label="Agent chat thread"
          >
            {messages.length === 0 ? (
              <div className="spec-chat-empty">
                <span className="spec-chat-empty-icon">
                  {selectedAgent ? "—" : "○"}
                </span>
                <span className="spec-chat-empty-label">
                  {selectedAgent
                    ? "No messages yet"
                    : agents.length === 0
                      ? "Connect your first agent"
                      : "Select a thread"}
                </span>
                <span className="spec-chat-empty-hint">
                  {selectedAgent
                    ? `When ${selectedAgent.clientName} sends updates, questions, or approval requests, they appear here.`
                    : agents.length === 0
                      ? "Pair an AI agent with your wallet and it will appear in the sidebar. Agents can send messages, ask questions, and request transaction approvals."
                      : "Pick an agent thread from the sidebar to view its conversation."}
                </span>
                {agents.length === 0 && (
                  <Link
                    href={`${basePath}/dashboard/pair`}
                    className="spec-chat-empty-cta"
                  >
                    Connect an agent
                  </Link>
                )}
              </div>
            ) : (
              <ol className="spec-chat-list" role="log" aria-live="polite">
                {messages.map((m, i) => {
                  const dayBound = isDayBound(i);
                  const showTime = isTimeGap(i);
                  const showMeta = isNewSender(i) || showTime;
                  const isStreamingMsg = streaming.has(m.id);
                  const pos = bubblePosition(i);
                  return (
                    <li
                      key={m.id}
                      className={`spec-chat-row spec-chat-row-${m.sender}${
                        showMeta ? "" : " spec-chat-row-continued"
                      }`}
                      data-kind={m.kind}
                      data-pos={pos}
                    >
                      {dayBound && (
                        <span className="spec-chat-datesep">
                          {formatDateLabel(m.ts)}
                        </span>
                      )}
                      {showTime && !dayBound && (
                        <span className="spec-chat-timestamp">
                          {formatTime(m.ts)}
                        </span>
                      )}
                      {showMeta && (
                        <span className="spec-chat-meta">
                          <span className="spec-chat-sender">
                            {senderLabel(m)}
                          </span>
                          {m.kind === "approval_request" && (
                            <span className="spec-chat-badge-approval">
                              approval needed
                            </span>
                          )}
                        </span>
                      )}
                      <div className="spec-chat-bubble-wrap">
                        <ChatBubble
                          content={m.content}
                          isUser={m.sender === "user"}
                          isStreaming={isStreamingMsg}
                          streamDelta={
                            isStreamingMsg
                              ? streaming.get(m.id)
                              : undefined
                          }
                        />
                        <span className="spec-chat-hover-time">
                          {formatTime(m.ts)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {typingAgent && (
              <div
                className="spec-chat-typing"
                role="status"
                aria-label={`${
                  selectedAgent?.clientName ?? shortSession(typingAgent)
                } is composing`}
              >
                <span className="spec-chat-typing-dot" />
                <span className="spec-chat-typing-dot" />
                <span className="spec-chat-typing-dot" />
              </div>
            )}
            <div ref={tailRef} />
          </section>

          {showScrollBtn && (
            <button
              type="button"
              className="spec-chat-scroll-btn"
              aria-label="Scroll to latest"
              onClick={() => {
                tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                isNearBottom.current = true;
                setShowScrollBtn(false);
              }}
            >
              ↓
            </button>
          )}

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
                placeholder={
                  canReply
                    ? `Message ${selectedAgent?.clientName ?? "agent"}…`
                    : "Select an agent to start chatting"
                }
                rows={1}
                maxLength={MAX_INPUT}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={sending || !canReply}
                aria-label="Type a reply"
              />
              <button
                type="submit"
                className="spec-chat-send"
                disabled={
                  sending || !canReply || input.trim().length === 0
                }
                title="Send (Enter)"
              >
                {sending ? "…" : "↑"}
              </button>
            </div>
            {sendError && (
              <span className="spec-chat-send-err" role="alert">
                {sendError}
              </span>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
