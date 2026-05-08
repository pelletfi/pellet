import { streamText, type ModelMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { buildSystemPrompt } from "@/lib/agent/pellet/system-prompt";
import { buildTools } from "@/lib/agent/pellet/tools";
import { selectModel } from "@/lib/agent/pellet/router";
import { checkAndIncrementQuota } from "@/lib/agent/pellet/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const quota = await checkAndIncrementQuota(user.id);
  if (!quota.allowed) {
    return new Response(
      JSON.stringify({
        error: "quota_exhausted",
        message:
          "Free Pellet Agent quota hit for today. Slash commands still work, or connect your own model via 'pellet mcp' to keep going.",
      }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { messages?: Array<{ role: string; content: string }> }
    | null;
  if (!body?.messages?.length) {
    return new Response(JSON.stringify({ error: "missing messages" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const system = await buildSystemPrompt();
  const tools = buildTools({
    userId: user.id,
    managedAddress: user.managedAddress as `0x${string}`,
  });

  // The CLI sends simple { role, content } messages — that's already the
  // ModelMessage shape streamText wants. No conversion needed.
  const messages: ModelMessage[] = body.messages.map((m) => ({
    role: m.role as ModelMessage["role"],
    content: m.content,
  }));

  const result = streamText({
    model: gateway(selectModel()),
    system,
    messages,
    tools,
    maxOutputTokens: 512,
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral", ttl: "1h" },
      },
    },
  });

  return result.toTextStreamResponse({
    headers: {
      "x-pellet-quota-remaining": String(quota.remaining),
    },
  });
}
