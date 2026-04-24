// Sidebar nav config. Edit this to add/remove/reorder docs pages.
// `soon: true` renders a non-clickable entry with a "Soon" chip, mirroring
// the primary-nav convention on the homepage.

export interface DocsNavItem {
  title: string;
  href?: string;
  soon?: boolean;
  children?: DocsNavItem[];
}

export const docsNav: DocsNavItem[] = [
  {
    title: "Start here",
    children: [
      { title: "Overview", href: "/docs" },
      { title: "Architecture", href: "/docs/architecture" },
      { title: "ERC-8004 primer", href: "/docs/erc-8004" },
    ],
  },
  {
    title: "Registries",
    children: [
      { title: "Anchor · Identity", href: "/docs/registries/identity" },
      { title: "Mesh · Reputation", href: "/docs/registries/reputation" },
      { title: "Cipher · Validation", href: "/docs/registries/validation" },
    ],
  },
  {
    title: "Reference",
    children: [
      { title: "Contracts", href: "/docs/contracts" },
      { title: "Agent metadata", href: "/docs/agent-metadata" },
    ],
  },
  {
    title: "Tooling",
    children: [
      { title: "SDK", href: "/docs/sdk", soon: true },
      { title: "CLI", href: "/docs/cli", soon: true },
      { title: "Indexer", href: "/docs/indexer", soon: true },
    ],
  },
];

/** Flatten the nav into a single ordered list for prev/next navigation. */
export function flattenDocsNav(nav: DocsNavItem[] = docsNav): DocsNavItem[] {
  const out: DocsNavItem[] = [];
  for (const section of nav) {
    if (section.href) out.push(section);
    if (section.children) out.push(...section.children);
  }
  return out.filter((i) => i.href && !i.soon);
}
