import { source } from "@/lib/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Embeds the canonical /docs/wallet-mcp MDX inside the Wallet shell. Same
// content as /docs/wallet-mcp, kept in lockstep because both pages read
// from the same MDX source. We render the MDX directly rather than via
// fumadocs DocsPage primitives because those require a DocsLayout ancestor
// that the specimen shell doesn't provide.
export default async function OliEmbeddedMcpPage() {
  const page = source.getPage(["wallet-mcp"]);
  if (!page) notFound();
  const MDXContent = page.data.body;
  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>08</span>
            <span>MCP</span>
          </h1>
        </div>
        <div className="spec-page-subhead">
          <span>{page.data.description}</span>
        </div>
      </section>
      <article className="spec-prose">
        <MDXContent components={defaultMdxComponents} />
      </article>
    </>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const page = source.getPage(["wallet-mcp"]);
  if (!page) return { title: "MCP" };
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
