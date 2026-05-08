import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n+/;
const IMPORT_RE = /^import\s.+?from\s+['"][^'"]+['"];?\s*$/gm;
const JSX_BLOCK_RE = /<([A-Z][A-Za-z0-9]*)[\s\S]*?(?:\/>|>[\s\S]*?<\/\1>)/g;

export function flattenMdx(src: string): string {
  if (!src) return "";
  let out = src.replace(FRONTMATTER_RE, "");
  out = out.replace(IMPORT_RE, "");
  out = out.replace(JSX_BLOCK_RE, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

const DOC_FILES = [
  "index.mdx",
  "wallet.mdx",
  "wallet-cli.mdx",
  "wallet-mcp.mdx",
  "mcp.mdx",
  "webhooks.mdx",
  "methodology.mdx",
  "tempo-primer.mdx",
  "changelog.mdx",
];

let cache: { text: string; loadedAt: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function loadWalletKnowledge(): Promise<string> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.text;

  const root = join(process.cwd(), "content", "docs");
  const parts: string[] = [];

  for (const f of DOC_FILES) {
    try {
      const raw = await readFile(join(root, f), "utf8");
      parts.push(`### ${f}\n\n${flattenMdx(raw)}`);
    } catch {
      // missing file: skip
    }
  }

  // include api/ subdirectory
  try {
    const apiDir = join(root, "api");
    const apiFiles = await readdir(apiDir);
    for (const f of apiFiles.filter((x) => x.endsWith(".mdx"))) {
      const raw = await readFile(join(apiDir, f), "utf8");
      parts.push(`### api/${f}\n\n${flattenMdx(raw)}`);
    }
  } catch {
    // no api dir: skip
  }

  const text = parts.join("\n\n---\n\n");
  cache = { text, loadedAt: Date.now() };
  return text;
}

export function _resetCacheForTests(): void {
  cache = null;
}
