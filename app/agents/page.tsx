"use client";

import { useState } from "react";
import Link from "next/link";
import { PELLET_AGENT_PROMPT } from "@/lib/agent-prompt";

export default function AgentsPage() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(PELLET_AGENT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="page-container">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Agents &amp; API
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-tertiary)",
            maxWidth: 620,
            margin: "12px 0 32px",
            lineHeight: 1.55,
          }}
        >
          AI agents can call the Pellet API directly. Drop the system prompt
          below into your agent&apos;s instructions and it will know about every
          endpoint, pricing, and how to pay HTTP 402 challenges with{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            npx mppx
          </code>
          . The prompt is also served at{" "}
          <Link
            href="/llms.txt"
            style={{ color: "var(--color-text-secondary)", textDecoration: "underline" }}
          >
            pelletfi.com/llms.txt
          </Link>{" "}
          for agent self-discovery.
        </p>

        <section style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Agent system prompt
            </h2>
            <button
              type="button"
              onClick={copyPrompt}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "6px 12px",
                background: copied ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
                color: "var(--color-text-primary)",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              {copied ? "copied" : "copy to LLM"}
            </button>
          </div>

          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.65,
              color: "var(--color-text-secondary)",
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 8,
              padding: 20,
              margin: 0,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {PELLET_AGENT_PROMPT}
          </pre>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 12px",
              letterSpacing: "-0.01em",
            }}
          >
            Setup — npx mppx (Tempo, pathUSD or USDC.e)
          </h2>

          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-tertiary)",
              margin: "0 0 16px",
              lineHeight: 1.55,
            }}
          >
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              npx mppx
            </code>{" "}
            is the CLI for the Merchant Payment Protocol on Tempo. It handles
            the 402 → sign → retry loop automatically using a funded local
            wallet.
          </p>

          <CodeBlock label="Create a local Tempo account">
            npx mppx account create
          </CodeBlock>

          <CodeBlock label="Fund it with pathUSD or USDC.e on Tempo (exchange or bridge), then:">
            {`npx mppx https://pelletfi.com/api/v1/tokens/0x20c000000000000000000000b9537d11c60e8b50/briefing`}
          </CodeBlock>
        </section>

        <section>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 12px",
              letterSpacing: "-0.01em",
            }}
          >
            How the 402 flow works
          </h2>
          <ol
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.7,
              paddingLeft: 20,
              margin: 0,
            }}
          >
            <li>Agent calls the paid endpoint → server returns 402 with a payment challenge</li>
            <li>mppx parses the challenge (amount, recipient, expiry)</li>
            <li>mppx signs the USDC.e payment on Tempo</li>
            <li>
              mppx retries the request with the{" "}
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                Authorization: Payment
              </code>{" "}
              credential
            </li>
            <li>Server verifies the signed transaction → runs the briefing → returns 200</li>
          </ol>
        </section>
      </div>
    </main>
  );
}

function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-tertiary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <pre
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--color-text-primary)",
          background: "var(--color-bg-subtle)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 6,
          padding: 14,
          margin: 0,
          overflowX: "auto",
        }}
      >
        {children}
      </pre>
    </div>
  );
}
