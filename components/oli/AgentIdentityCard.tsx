"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type AgentIdentity = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: string;
  scopes: string[];
  tokenState: string;
  lastSeenAt: string;
  webhookEnabled: boolean;
};

function shortId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 10)}...${id.slice(-5)}` : id;
}

function timeAgo(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ago / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function providerLabel(agent: AgentIdentity): string {
  const raw = `${agent.clientName} ${agent.clientId}`.toLowerCase();
  if (raw.includes("claude")) return "Claude";
  if (raw.includes("chatgpt") || raw.includes("openai") || raw.includes("gpt")) {
    return "GPT";
  }
  if (raw.includes("cursor")) return "Cursor";
  if (raw.includes("codex") || raw.includes("opencode")) return "Codex";
  if (raw.includes("gemini")) return "Gemini";
  return "Custom";
}

function transportLabel(agent: AgentIdentity): string {
  const auth = agent.clientType === "dynamic" ? "DCR" : agent.clientType.toUpperCase();
  const push = agent.webhookEnabled ? "webhook" : "poll";
  return `${auth} / OAuth 2.1 / ${push}`;
}

function scopeLabel(scopes: string[]): string {
  if (scopes.length === 0) return "no scopes";
  return scopes
    .slice(0, 3)
    .map((scope) => scope.replace(/^wallet:/, "").replace(/:/g, "."))
    .join(" · ");
}

function hash(seed: string): number {
  let out = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    out ^= seed.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

function seeded(seed: number, n: number): number {
  const x = Math.sin(seed * 0.000001 + n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

type AgentAsciiPreset = "dense-field" | "dense-field-alt" | "cloud-field";

const AGENT_ASCII_PRESET: AgentAsciiPreset = "dense-field";

function denseAsciiFrame(seed: string, frame: number): string[] {
  const cols = 104;
  const rows = 23;
  const ramp = ".::--==++**##%%@@00112233445566778899";
  const h = hash(seed);
  const t = frame * 0.115;
  const p1 = seeded(h, 1) * Math.PI * 2;
  const p2 = seeded(h, 2) * Math.PI * 2;
  const p3 = seeded(h, 3) * Math.PI * 2;
  const p4 = seeded(h, 4) * Math.PI * 2;
  const blobs = [
    {
      x: 0.5 + 0.28 * Math.sin(t * 0.72 + p1),
      y: 0.45 + 0.24 * Math.cos(t * 0.58 + p2),
      r: 7.5 + seeded(h, 5) * 2.5,
      w: 1.25,
    },
    {
      x: 0.45 + 0.34 * Math.cos(t * 0.44 + p3),
      y: 0.56 + 0.22 * Math.sin(t * 0.66 + p4),
      r: 6.2 + seeded(h, 6) * 2.2,
      w: 1.05,
    },
    {
      x: 0.52 + 0.18 * Math.sin(t * 1.04 + p2),
      y: 0.5 + 0.36 * Math.cos(t * 0.35 + p1),
      r: 5.3 + seeded(h, 7) * 2.8,
      w: 0.9,
    },
  ];

  return Array.from({ length: rows }, (_, row) => {
    let line = "";
    const yn = row / Math.max(1, rows - 1);
    for (let col = 0; col < cols; col += 1) {
      const xn = col / Math.max(1, cols - 1);
      let v = 0;
      for (const blob of blobs) {
        const dx = (xn - blob.x) * cols;
        const dy = (yn - blob.y) * rows * 1.8;
        v += Math.exp(-(dx * dx + dy * dy) / blob.r) * blob.w;
      }
      v += 0.24 * Math.sin(col * 0.48 + row * 0.32 + t * 1.2 + p1);
      v += 0.2 * Math.cos(col * 0.19 - row * 0.58 + t * 0.86 + p3);
      v += 0.14 * Math.sin((col + row) * 0.22 - t * 1.8 + p4);
      v += 0.16 * Math.sin((col - rows + row) * 0.14 + t * 0.52 + p2);

      const edgeFade =
        0.62 + 0.38 * Math.sin(Math.PI * xn) ** 0.3 * Math.sin(Math.PI * yn) ** 0.26;
      const normalized = Math.max(0, Math.min(1, (v * edgeFade + 0.22) / 1.28));
      const shimmer = seeded(h, frame + row * 31 + col * 17) * 0.05;
      const idx = Math.max(
        0,
        Math.min(ramp.length - 1, Math.floor((normalized + shimmer) * ramp.length)),
      );
      line += ramp[idx];
    }
    return line;
  });
}

function denseAltAsciiFrame(seed: string, frame: number): string[] {
  const cols = 104;
  const rows = 23;
  const ramp = "   ..:::---===+++***###%%%@@99887766554433221100";
  const h = hash(`${seed}:alt`);
  const t = frame * 0.086;
  const p1 = seeded(h, 13) * Math.PI * 2;
  const p2 = seeded(h, 14) * Math.PI * 2;
  const p3 = seeded(h, 15) * Math.PI * 2;
  const p4 = seeded(h, 16) * Math.PI * 2;
  const lobes = [
    {
      x: 0.18 + 0.035 * Math.sin(t * 0.48 + p1),
      y: 0.56 + 0.045 * Math.cos(t * 0.54 + p2),
      rx: 0.18,
      ry: 0.22,
      w: 0.78,
    },
    {
      x: 0.34 + 0.04 * Math.cos(t * 0.42 + p3),
      y: 0.46 + 0.045 * Math.sin(t * 0.5 + p4),
      rx: 0.22,
      ry: 0.29,
      w: 1.02,
    },
    {
      x: 0.54 + 0.038 * Math.sin(t * 0.36 + p2),
      y: 0.43 + 0.05 * Math.cos(t * 0.46 + p1),
      rx: 0.25,
      ry: 0.32,
      w: 1.18,
    },
    {
      x: 0.75 + 0.045 * Math.cos(t * 0.44 + p4),
      y: 0.54 + 0.04 * Math.sin(t * 0.52 + p3),
      rx: 0.2,
      ry: 0.25,
      w: 0.92,
    },
    {
      x: 0.46 + 0.05 * Math.sin(t * 0.58 + p4),
      y: 0.68 + 0.03 * Math.cos(t * 0.4 + p2),
      rx: 0.36,
      ry: 0.18,
      w: 0.74,
    },
  ];

  return Array.from({ length: rows }, (_, row) => {
    let line = "";
    const yn = row / Math.max(1, rows - 1);
    for (let col = 0; col < cols; col += 1) {
      const xn = col / Math.max(1, cols - 1);
      let mask = 0;
      for (const lobe of lobes) {
        const dx = (xn - lobe.x) / lobe.rx;
        const dy = (yn - lobe.y) / lobe.ry;
        mask += Math.exp(-(dx * dx + dy * dy) * 1.9) * lobe.w;
      }
      const scallop =
        0.1 * Math.sin(xn * Math.PI * 8 + t * 1.6 + p1) +
        0.07 * Math.cos(xn * Math.PI * 13 - t * 1.1 + p3);
      const shape = Math.max(0, Math.min(1, mask + scallop));
      if (shape < 0.26) {
        line += " ";
        continue;
      }
      let v = shape;
      v += 0.24 * Math.sin(col * 0.33 - row * 0.44 + t * 1.4 + p1);
      v += 0.2 * Math.cos(col * 0.22 + row * 0.36 - t * 0.92 + p3);
      v += 0.13 * Math.sin((col - row) * 0.18 - t * 1.48 + p4);
      v += 0.12 * Math.cos((col + rows - row) * 0.14 + t * 0.7 + p2);

      const edgeFade =
        0.78 + 0.22 * Math.sin(Math.PI * xn) ** 0.28 * Math.sin(Math.PI * yn) ** 0.24;
      const normalized = Math.max(0, Math.min(1, (v * edgeFade - 0.22) / 1.44));
      const shimmer = seeded(h, Math.floor(frame / 2) + row * 43 + col * 19) * 0.06;
      if (normalized + shimmer < 0.1) {
        line += " ";
        continue;
      }
      const idx = Math.max(
        0,
        Math.min(ramp.length - 1, Math.floor((normalized + shimmer) * ramp.length)),
      );
      line += ramp[idx];
    }
    return line;
  });
}

function cloudAsciiFrame(seed: string, frame: number): string[] {
  const cols = 104;
  const rows = 23;
  const ramp = "   ....::::---===+++***###%%%@@0123456789";
  const h = hash(seed);
  const t = frame * 0.072;
  const p1 = seeded(h, 1) * Math.PI * 2;
  const p2 = seeded(h, 2) * Math.PI * 2;
  const p3 = seeded(h, 3) * Math.PI * 2;
  const p4 = seeded(h, 4) * Math.PI * 2;
  const puffs = Array.from({ length: 19 }, (_, i) => {
    const band = i % 3;
    return {
      x:
        (seeded(h, i + 11) +
          t * (0.055 + band * 0.016) +
          0.035 * Math.sin(t * 0.7 + i + p1)) %
        1,
      y:
        0.34 +
        band * 0.16 +
        0.08 * Math.sin(seeded(h, i + 40) * Math.PI * 2 + t * 0.45 + p2),
      rx: 0.15 + seeded(h, i + 70) * 0.12,
      ry: 0.1 + seeded(h, i + 100) * 0.09,
      w: 0.58 + seeded(h, i + 130) * 0.44,
    };
  });

  return Array.from({ length: rows }, (_, row) => {
    let line = "";
    const yn = row / Math.max(1, rows - 1);
    for (let col = 0; col < cols; col += 1) {
      const xn = col / Math.max(1, cols - 1);
      let v = 0;
      for (const puff of puffs) {
        const rawDx = Math.abs(xn - puff.x);
        const wrappedDx = Math.min(rawDx, 1 - rawDx);
        const dx = wrappedDx / puff.rx;
        const dy = (yn - puff.y) / puff.ry;
        v += Math.exp(-(dx * dx + dy * dy) * 1.85) * puff.w;
      }
      v += 0.18 * Math.sin(col * 0.18 + row * 0.42 + t * 1.1 + p1);
      v += 0.14 * Math.cos(col * 0.08 - row * 0.72 + t * 0.82 + p3);
      v += 0.1 * Math.sin((col + row) * 0.16 - t * 1.38 + p4);
      v += 0.08 * Math.cos((col - row) * 0.27 + t * 0.52 + p2);

      const edgeFade =
        0.72 + 0.28 * Math.sin(Math.PI * xn) ** 0.22 * Math.sin(Math.PI * yn) ** 0.22;
      const normalized = Math.max(0, Math.min(1, (v * edgeFade - 0.42) / 1.42));
      const grain = seeded(h, frame + row * 31 + col * 17) * 0.06;
      if (normalized + grain < 0.1) {
        line += " ";
        continue;
      }
      const idx = Math.max(
        0,
        Math.min(ramp.length - 1, Math.floor((normalized + grain) * ramp.length)),
      );
      line += ramp[idx];
    }
    return line;
  });
}

function agentAsciiPreset(agent: AgentIdentity): AgentAsciiPreset {
  const raw = `${agent.clientName} ${agent.clientId}`.toLowerCase();
  if (raw.includes("gpt-5.5") || raw.includes("gpt-5-5")) {
    return "dense-field-alt";
  }
  return AGENT_ASCII_PRESET;
}

function asciiFrame(agent: AgentIdentity, frame: number): string[] {
  switch (agentAsciiPreset(agent)) {
    case "dense-field-alt":
      return denseAltAsciiFrame(agent.clientId, frame);
    case "cloud-field":
      return cloudAsciiFrame(agent.clientId, frame);
    case "dense-field":
    default:
      return denseAsciiFrame(agent.clientId, frame);
  }
}

export function AgentIdentityCard({
  agent,
  basePath,
}: {
  agent: AgentIdentity | null;
  basePath: string;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setFrame((value) => (value + 1) % 10_000);
    }, 85);
    return () => window.clearInterval(timer);
  }, []);

  const art = useMemo(
    () => (agent ? asciiFrame(agent, frame) : []),
    [agent, frame],
  );

  if (!agent) {
    return (
      <section className="spec-agent-id-card spec-agent-id-card-empty" aria-label="Agent identity">
        <div className="spec-agent-id-top">
          <span className="spec-agent-id-kicker">PELLET AGENT ID</span>
          <span className="spec-pill">[ EMPTY ]</span>
        </div>
        <div className="spec-agent-id-empty-mark" aria-hidden="true">
          <span>-- -- -- -- -- --</span>
          <span>-- -- -- -- -- --</span>
          <span>-- -- -- -- -- --</span>
        </div>
        <p className="spec-agent-id-empty-copy">
          No agent credential is living in this wallet yet.
        </p>
        <Link href={`${basePath}/onboard`} className="spec-agent-id-action">
          CONNECT AGENT
        </Link>
      </section>
    );
  }

  return (
    <section className="spec-agent-id-card" aria-label={`${agent.clientName} identity`}>
      <div className="spec-agent-id-top">
        <span className="spec-agent-id-kicker">PELLET AGENT ID</span>
        <span className="spec-pill">{agent.tokenState}</span>
      </div>
      <div className="spec-agent-id-name-row">
        <span className="spec-agent-id-provider">{providerLabel(agent)}</span>
        <span className="spec-agent-id-name">{agent.clientName}</span>
      </div>
      <pre className="spec-agent-id-ascii" aria-hidden="true">{art.map((line, index) => (
        <span key={index}>{line}</span>
      ))}</pre>
      <div className="spec-agent-id-meta">
        <span>type</span>
        <span>{transportLabel(agent)}</span>
        <span>scopes</span>
        <span>{scopeLabel(agent.scopes)}</span>
        <span>seen</span>
        <span>{timeAgo(agent.lastSeenAt)}</span>
        <span>client</span>
        <span>{shortId(agent.clientId)}</span>
      </div>
      <div className="spec-agent-id-actions">
        <Link href={`${basePath}/chat?agent=${agent.id}`}>CHAT</Link>
        <Link href={`${basePath}/dashboard/agents`}>MANAGE</Link>
      </div>
    </section>
  );
}
