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
  // ── Aggregators (multi-service settlement addresses) ──────────────────
  {
    id: "tempo-gateway-mpp",
    label: "Tempo MPP Gateway",
    category: "ai",
    mppEndpoint: "https://anthropic.mpp.tempo.xyz",
    settlementAddress: "0xca4e835f803cb0b7c428222b3a3b98518d4779fe",
    bio: "Tempo's MPP aggregator. Routes payments for ~17 services including Anthropic, OpenAI, Gemini, OpenRouter, Modal, fal.ai, Firecrawl, Exa, and tempo-proxied infra (Object Storage, Tempo RPC, AviationStack, FlightAPI, Oxylabs, SerpApi, Google Maps, KicksDB, 2Captcha).",
    links: { site: "https://tempo.xyz/mpp" },
  },
  {
    id: "locus-gateway-mpp",
    label: "Locus MPP Gateway",
    category: "ai",
    // Probe via Mistral (a typical paywithlocus-routed service) to discover the gateway address.
    mppEndpoint: "https://mistral.mpp.paywithlocus.com",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/chat/completions", body: {} },
    ],
    bio: "Pay-with-Locus MPP aggregator. Routes payments for ~30 services including Mistral, Grok, Groq, Perplexity, DeepSeek, DeepL, Diffbot, Replicate, Stability AI, Suno, Tavily, Brave Search, Apollo, BuiltWith, Hunter, EDGAR, Wolfram, Mapbox, OpenWeather, RentCast, and more.",
    links: { site: "https://paywithlocus.com" },
  },
  // ── Direct settlement services ────────────────────────────────────────
  {
    id: "allium-mpp",
    label: "Allium",
    category: "data",
    mppEndpoint: "https://agents.allium.so",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/query", body: {} },
      { method: "POST", path: "/api/v1/query", body: {} },
      { method: "GET", path: "/v1", body: null },
    ],
    bio: "Real-time blockchain analytics including token prices and wallet data.",
    links: { site: "https://allium.so" },
  },
  {
    id: "dune-mpp",
    label: "Dune",
    category: "data",
    mppEndpoint: "https://api.dune.com",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/api/v1/sql/run", body: {} },
      { method: "POST", path: "/v1/sql/run", body: {} },
    ],
    bio: "Query transaction data, decoded events, DeFi positions, NFT activity.",
    links: { site: "https://dune.com" },
  },
  {
    id: "browserbase-mpp",
    label: "Browserbase",
    category: "compute",
    mppEndpoint: "https://mpp.browserbase.com",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/sessions", body: {} },
      { method: "POST", path: "/v1/sessions", body: {} },
    ],
    bio: "Headless browser sessions and web page retrieval for agents.",
    links: { site: "https://browserbase.com" },
  },
  {
    id: "pinata-mpp",
    label: "Pinata IPFS",
    category: "storage",
    mppEndpoint: "https://mpp.pinata.cloud",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/pinning/pinFileToIPFS", body: {} },
      { method: "POST", path: "/v1/pinning", body: {} },
    ],
    bio: "Upload and download public files via IPFS.",
    links: { site: "https://pinata.cloud" },
  },
  {
    id: "agentmail-mpp",
    label: "AgentMail",
    category: "social",
    mppEndpoint: "https://mpp.api.agentmail.to",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/messages", body: {} },
      { method: "POST", path: "/inboxes", body: {} },
    ],
    bio: "Email infrastructure for autonomous agents.",
    links: { site: "https://agentmail.to" },
  },
  {
    id: "codex-mpp",
    label: "Codex",
    category: "blockchain",
    mppEndpoint: "https://graph.codex.io",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/graphql", body: { query: "{ __typename }" } },
    ],
    bio: "Onchain token and prediction market data via GraphQL across 80+ networks.",
    links: { site: "https://codex.io" },
  },
  {
    id: "nansen-mpp",
    label: "Nansen",
    category: "blockchain",
    mppEndpoint: "https://api.nansen.ai",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/query", body: {} },
      { method: "POST", path: "/api/v1/query", body: {} },
    ],
    bio: "Blockchain analytics and smart money intelligence across multiple chains.",
    links: { site: "https://nansen.ai" },
  },
  {
    id: "stableenrich-mpp",
    label: "StableEnrich",
    category: "data",
    mppEndpoint: "https://stableenrich.dev",
    settlementAddress: null,
    probePaths: [
      { method: "POST", path: "/v1/people", body: {} },
      { method: "POST", path: "/people", body: {} },
      { method: "POST", path: "/", body: {} },
    ],
    bio: "People, company, web search, and contact enrichment APIs.",
    links: { site: "https://stableenrich.dev" },
  },
];
