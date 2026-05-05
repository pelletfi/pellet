import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { buildPelletMcpServer } from "@/lib/mcp/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// /mcp — the Pellet wallet's MCP server endpoint.
//
// Streamable HTTP transport (Web-standard variant) so we can use the
// fetch-style Request/Response API directly in Next.js route handlers
// without bridging to node:http.
//
// Auth: every request needs a valid OAuth bearer audience-bound to this
// resource URL. On 401 we return WWW-Authenticate with the resource
// metadata URL so MCP clients can discover the auth server (RFC 9728).
//
// Stateless mode (sessionIdGenerator: undefined): each request is
// self-contained. We don't carry MCP session state across HTTP requests
// because Vercel functions don't share memory. Clients send initialize
// as needed; tools/list and tools/call work without prior initialize in
// stateless mode. Saves us from needing an external session store.
//
// Per-request McpServer instance because the auth context (token + user)
// is per-request — tools read it via closure inside their handlers.

async function handle(req: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(req);
  if (auth instanceof Response) return auth;

  const rl = rateLimit(`mcp:${auth.token.userId}`, { max: 120, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  const server = buildPelletMcpServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Return JSON-RPC responses inline (application/json) instead of always
    // wrapping in SSE. SSE is only used when the server needs to push
    // notifications during a long-running tool call. For simple request/
    // response (tools/list, tools/call) this lets curl-style clients see
    // the response without holding open an SSE stream.
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Close server promptly so we don't leak per-request state. Safe to
    // run after handleRequest returns because the response is fully
    // formed (JSON inline mode) — no streaming continues post-return.
    await server.close().catch(() => {});
  }
}

// MCP supports POST (JSON-RPC requests), GET (SSE for server→client
// notifications), and DELETE (session teardown). We handle them all the
// same way — the transport routes internally.
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
