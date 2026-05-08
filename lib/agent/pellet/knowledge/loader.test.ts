import { describe, it, expect } from "vitest";
import { flattenMdx } from "./loader";

describe("flattenMdx", () => {
  it("strips frontmatter, imports, and JSX components, keeps prose + headings + code blocks", () => {
    const src = `---
title: Wallet
description: How it works
---

import { Card } from "fumadocs-ui/components/card";

# Wallet

The wallet supports passkey auth.

<Card title="Note">Some note</Card>

\`\`\`ts
const x = 1;
\`\`\`
`;
    const out = flattenMdx(src);
    expect(out).not.toContain("---");
    expect(out).not.toContain("import");
    expect(out).not.toContain("<Card");
    expect(out).toContain("# Wallet");
    expect(out).toContain("The wallet supports passkey auth.");
    expect(out).toContain("```ts");
    expect(out).toContain("const x = 1;");
  });

  it("returns empty string for empty input", () => {
    expect(flattenMdx("")).toBe("");
  });
});
