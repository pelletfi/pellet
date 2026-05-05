"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WalletTabs } from "@/components/oli/WalletTabs";
import { LiquidGlass } from "@/components/oli/LiquidGlass";

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

function shortClient(id: string): string {
  return id.length > 14 ? `${id.slice(0, 14)}…` : id;
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
  // typing — connectionId/sessionId of the agent currently composing, or null.
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const tailRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const agentNameByConnection = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent) => map.set(agent.id, agent.clientName));
    return map;
  }, [agents]);

  useEffect(() => {
    setMessages(initialMessages);
    seen.current = new Set(initialMessages.map((m) => m.id));
    setTypingAgent(null);
    setSendError(null);
    setInput("");
  }, [initialMessages, selectedAgentId]);

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
          const next = [...prev, wire];
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
        });
        // A new message from this agent ends its "typing" state.
        setTypingAgent((prev) =>
          prev && (prev === wire.connectionId || prev === wire.sessionId)
            ? null
            : prev,
        );
      } catch {
        // malformed payload — skip
      }
    };
    // Named event: 'typing' — agent signaled it's composing. Auto-clears
    // after 8s in case no message follows (e.g., agent crashed mid-task).
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
    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects on transient errors.
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, [selectedAgentId]);

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
        body: JSON.stringify({ content, agentId: selectedAgentId }),
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

  function senderLabel(m: ChatMessage): string {
    if (m.sender === "user") return "you";
    if (m.sender === "system") return "system";
    if (m.connectionId) {
      return agentNameByConnection.get(m.connectionId) ?? `agent:${m.connectionId.slice(0, 8)}`;
    }
    return `agent:${shortSession(m.sessionId)}`;
  }

  const canReply = Boolean(selectedAgent);

  return (
    <div className="spec-wallet-float" style={{ position: "relative", isolation: "isolate" }}>
      <LiquidGlass
        style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}
      />
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Wallet · Chat</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">STATUS</span>
          <span>{connected ? "live · streaming" : "connecting…"}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">THREAD</span>
          <span>{selectedAgent?.clientName ?? "no agent selected"}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">MESSAGES</span>
          <span>{messages.length}</span>
        </div>
      </section>

      <div className="spec-chat-container">
        <aside className="spec-chat-agents" aria-label="Agent threads">
          <div className="spec-chat-agents-head">
            <span>AGENT THREADS</span>
            <Link href={`${basePath}/onboard`}>CONNECT</Link>
          </div>
          {agents.length === 0 ? (
            <div className="spec-chat-agents-empty">no connected agents</div>
          ) : (
            <ol className="spec-chat-agent-list">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <Link
                    className={`spec-chat-agent-link${
                      agent.id === selectedAgentId ? " spec-chat-agent-link-active" : ""
                    }`}
                    href={`${basePath}/chat?agent=${agent.id}`}
                  >
                    <span className="spec-chat-agent-name">{agent.clientName}</span>
                    <span className="spec-chat-agent-meta">
                      <span>{shortClient(agent.clientId)}</span>
                      <span>·</span>
                      <span>{agent.tokenState}</span>
                      {agent.webhookEnabled && (
                        <>
                          <span>·</span>
                          <span>webhook</span>
                        </>
                      )}
                    </span>
                    <span className="spec-chat-agent-seen">
                      last seen {fmtAgo(agent.lastSeenAt)} ago
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>

        <div className="spec-chat-main">
        <section className="spec-chat-pane" aria-label="Agent chat thread">
          {messages.length === 0 ? (
            <div className="spec-chat-empty">
              <span className="spec-chat-empty-label">
                {selectedAgent ? "no messages yet" : "no agent connected"}
              </span>
              <span className="spec-chat-empty-hint">
                {selectedAgent
                  ? `${selectedAgent.clientName} can post status updates, approval requests, and reports here in real time.`
                  : "connect an AI client to start a wallet-native chat thread."}
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
                      {senderLabel(m)}
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
              aria-label={`${selectedAgent?.clientName ?? shortSession(typingAgent)} is composing`}
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
              disabled={sending || !canReply}
              aria-label="Type a reply"
            />
            <button
              type="submit"
              className="spec-chat-send"
              disabled={sending || !canReply || input.trim().length === 0}
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
      </div>
    </div>
  );
}
