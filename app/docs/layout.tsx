import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/source";
import type { ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: "Pellet Docs",
          url: "/docs",
        }}
        sidebar={{
          defaultOpenLevel: 1,
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
