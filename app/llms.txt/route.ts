import { PELLET_AGENT_PROMPT } from "@/lib/agent-prompt";

// Serve the agent system prompt as plain text at https://pelletfi.com/llms.txt
// so LLM-powered agents and agent-builders can self-discover how to call
// Pellet's API. Matches the emerging llms.txt convention for agent discovery.
export async function GET() {
  return new Response(PELLET_AGENT_PROMPT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
