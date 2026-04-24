// Default MDX components. Next.js picks this up automatically and passes
// it through to every MDX file. We mostly let MDX render raw HTML (styled
// by .docs-prose in globals.css), but we upgrade external anchors here
// so they open in a new tab with the right rel attrs — matches the same
// behavior as the chapter addr-links on the homepage.

import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, ReactNode } from "react";

function DocsLink({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
        <span className="ext-arrow" aria-hidden>
          {" ↗"}
        </span>
      </a>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: DocsLink,
    ...components,
  };
}
