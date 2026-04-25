import { test } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "../src/index.ts");

function createClient(server: ReturnType<typeof spawn>) {
  let buf = "";
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  server.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const res = JSON.parse(line);
        if (res.id && pending.has(res.id)) {
          const { resolve, reject } = pending.get(res.id)!;
          pending.delete(res.id);
          if (res.error) reject(new Error(JSON.stringify(res.error)));
          else resolve(res.result);
        }
      } catch { /* ignore non-json lines */ }
    }
  });

  return (method: string, params: unknown): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      server.stdin.write(msg + "\n");
    });
  };
}

test("@pelletnetwork/hl-mcp — smoke", async () => {
  const server = spawn("node", ["--import", "tsx", serverPath], {
    cwd: join(__dirname, ".."),
    stdio: ["pipe", "pipe", "pipe"],
  });

  const rpc = createClient(server);

  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.1.0" },
  });

  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const listResult = await rpc("tools/list", {}) as { tools: { name: string }[] };
  assert.strictEqual(listResult.tools.length, 6);
  const names = listResult.tools.map((t) => t.name).sort();
  assert.deepStrictEqual(names, [
    "pellet_mint_agent_id",
    "pellet_post_attestation",
    "pellet_post_validation",
    "pellet_read_agent",
    "pellet_read_reputation",
    "pellet_read_validation",
  ]);

  const agentResult = await rpc("tools/call", {
    name: "pellet_read_agent",
    arguments: { agentId: 1 },
  }) as { content: { text: string }[] };
  const agent = JSON.parse(agentResult.content[0].text);
  assert.strictEqual(agent.controller, "0x2cbd7730994D3Ee1aAc4B1d0F409b1b62d7C1834");
  assert.strictEqual(agent.metadataURI, "https://pellet.network/.well-known/agent.json");
  assert.ok(Number(agent.registeredAt) > 0, "registeredAt is non-zero");

  const repResult = await rpc("tools/call", {
    name: "pellet_read_reputation",
    arguments: { agentId: 1 },
  }) as { content: { text: string }[] };
  const reps = JSON.parse(repResult.content[0].text);
  assert.ok(Array.isArray(reps), "returns array");

  const valResult = await rpc("tools/call", {
    name: "pellet_read_validation",
    arguments: { agentId: 1 },
  }) as { content: { text: string }[] };
  const vals = JSON.parse(valResult.content[0].text);
  assert.ok(Array.isArray(vals), "returns array");

  const mintResult = await rpc("tools/call", {
    name: "pellet_mint_agent_id",
    arguments: { metadataURI: "ipfs://test" },
  }) as { content: { text: string }[]; isError?: boolean };
  assert.ok(mintResult.content[0].text.includes("PRIVATE_KEY env var required"), "PRIVATE_KEY error");

  server.kill();
});
