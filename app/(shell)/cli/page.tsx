import { source } from "@/lib/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Embeds the canonical /docs/wallet-cli MDX inside the Wallet shell so users
// reading Wallet can pull up the CLI reference without leaving the sidebar
// context. Same source file, different shell. We render the MDX directly
// rather than via fumadocs DocsPage primitives because those require a
// DocsLayout ancestor that the specimen shell doesn't provide.
export default async function OliEmbeddedCliPage() {
  const page = source.getPage(["wallet-cli"]);
  if (!page) notFound();
  const MDXContent = page.data.body;
  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>07</span>
            <span>CLI</span>
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
  const page = source.getPage(["wallet-cli"]);
  if (!page) return { title: "CLI" };
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
