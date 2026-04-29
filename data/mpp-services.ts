// v0 curated MPP services. Settlement addresses are populated by the seed
// script (`scripts/seed-services.ts`) which probes each service's MPP endpoint
// and captures the 402 response's payment address. If a service can't be
// probed (endpoint requires specific request shape, etc.), the address can be
// filled in manually here and the seed script will skip the probe for it.

export type ProbeAttempt = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

export type SeedMppService = {
  id: string;            // slug used as agents.id and address_labels source
  label: string;         // display name
  category: "ai" | "data" | "compute" | "web" | "storage" | "social" | "blockchain" | "media";
  mppEndpoint: string;   // probe URL
  // If known, populate directly; else null and the seed script will probe.
  settlementAddress: string | null;
  // Optional service-specific probe paths. If omitted, seed script falls back to GET /.
  probePaths?: ProbeAttempt[];
  bio: string;
  links: { x?: string; site?: string };
};

export const MPP_SERVICES: SeedMppService[] = [
  {
    id: "anthropic-mpp",
    label: "Anthropic",
    category: "ai",
    mppEndpoint: "https://anthropic.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/messages", body: {} },
      { method: "POST", path: "/v1/chat/completions", body: {} },
    ],
    bio: "Claude chat completions via native and OpenAI-compatible APIs.",
    links: { site: "https://anthropic.com" },
  },
  {
    id: "openai-mpp",
    label: "OpenAI",
    category: "ai",
    mppEndpoint: "https://openai.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/chat/completions", body: {} },
      { method: "POST", path: "/v1/embeddings", body: {} },
    ],
    bio: "Chat, embeddings, image generation, and audio capabilities.",
    links: { site: "https://openai.com" },
  },
  {
    id: "gemini-mpp",
    label: "Google Gemini",
    category: "ai",
    mppEndpoint: "https://gemini.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1beta/models/gemini-pro:generateContent", body: {} },
      { method: "POST", path: "/v1/chat/completions", body: {} },
    ],
    bio: "Gemini text, Veo video, and image generation.",
    links: { site: "https://deepmind.google/technologies/gemini" },
  },
  {
    id: "openrouter-mpp",
    label: "OpenRouter",
    category: "ai",
    mppEndpoint: "https://openrouter.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/api/v1/chat/completions", body: {} },
      { method: "POST", path: "/v1/chat/completions", body: {} },
    ],
    bio: "Unified API access to 100+ language models.",
    links: { site: "https://openrouter.ai" },
  },
  {
    id: "dune-mpp",
    label: "Dune",
    category: "data",
    mppEndpoint: "https://api.dune.com",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/api/v1/query", body: {} },
      { method: "POST", path: "/v1/sql/run", body: {} },
      { method: "GET", path: "/api/v1/query/1", body: null },
    ],
    bio: "Query transaction data, decoded events, DeFi positions, NFT activity.",
    links: { site: "https://dune.com" },
  },
  {
    id: "alchemy-mpp",
    label: "Alchemy",
    category: "blockchain",
    mppEndpoint: "https://mpp.alchemy.com",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v2/eth_blockNumber", body: { jsonrpc: "2.0", method: "eth_blockNumber", id: 1 } },
      { method: "POST", path: "/", body: { jsonrpc: "2.0", method: "eth_blockNumber", id: 1 } },
    ],
    bio: "Blockchain APIs including RPC, prices, portfolios, NFTs across 100+ chains.",
    links: { site: "https://alchemy.com" },
  },
  {
    id: "browserbase-mpp",
    label: "Browserbase",
    category: "compute",
    mppEndpoint: "https://mpp.browserbase.com",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/sessions", body: {} },
    ],
    bio: "Headless browser sessions and web page retrieval for agents.",
    links: { site: "https://browserbase.com" },
  },
  {
    id: "modal-mpp",
    label: "Modal",
    category: "compute",
    mppEndpoint: "https://modal.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/run", body: {} },
      { method: "POST", path: "/api/v1/run", body: {} },
    ],
    bio: "Serverless GPU compute for code execution and AI workloads.",
    links: { site: "https://modal.com" },
  },
  {
    id: "firecrawl-mpp",
    label: "Firecrawl",
    category: "data",
    mppEndpoint: "https://firecrawl.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/scrape", body: { url: "https://example.com" } },
      { method: "POST", path: "/v0/scrape", body: { url: "https://example.com" } },
    ],
    bio: "Web scraping and structured data extraction optimized for LLMs.",
    links: { site: "https://firecrawl.dev" },
  },
  {
    id: "fal-mpp",
    label: "fal.ai",
    category: "media",
    mppEndpoint: "https://fal.mpp.tempo.xyz",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/run", body: {} },
      { method: "POST", path: "/", body: {} },
    ],
    bio: "Image, video, and audio generation with 600+ models.",
    links: { site: "https://fal.ai" },
  },
];
