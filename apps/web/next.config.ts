import type { NextConfig } from "next";
import createMdx from "@next/mdx";

import pelletHlTheme from "./lib/docs/shiki-theme.json" with { type: "json" };

const prettyCodeOptions = {
  // Custom monochromatic theme — navy for keywords, ink for defaults,
  // muted for comments. Matches Pellet HL brand v2 (no syntax rainbow).
  theme: pelletHlTheme,
  keepBackground: false,
  defaultLang: "plaintext",
};

// Turbopack requires plugins to be referenced by module-specifier string so
// it can serialize them through its loader system. Function references from
// `import rehypeSlug from "..."` trip the "does not have serializable options"
// error on dev start.
const withMdx = createMdx({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [
      ["rehype-slug", {}],
      ["rehype-pretty-code", prettyCodeOptions],
    ],
  },
});

const config: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

export default withMdx(config);
