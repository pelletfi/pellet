"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Link = { label: string; href: string; active?: boolean; soon?: boolean };

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isDocs = pathname.startsWith("/docs");
  const isRegistry = pathname.startsWith("/hl");

  // Anchor-based hrefs use absolute paths so they work from any route
  // (clicking `Identity` from /docs/* jumps back to /#identity).
  const LINKS: Array<Link> = [
    { label: "Home", href: "/", active: !isDocs && !isRegistry },
    { label: "Identity", href: "/#identity" },
    { label: "Reputation", href: "/#reputation" },
    { label: "Validation", href: "/#validation" },
    { label: "Registry", href: "/hl", active: isRegistry },
    { label: "Docs", href: "/docs", active: isDocs },
    { label: "Research", href: "#", soon: true },
    { label: "Blog", href: "#", soon: true },
  ];

  // close drawer on escape, restore body scroll on close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <nav className="primary">
        {LINKS.map((l) =>
          l.soon ? (
            <span
              key={l.label}
              className="soon"
              aria-disabled="true"
              title="Coming soon"
            >
              {l.label}
              <span className="soon-chip">Soon</span>
            </span>
          ) : (
            <a
              key={l.label}
              href={l.href}
              className={l.active ? "active" : undefined}
            >
              {l.label}
            </a>
          ),
        )}
      </nav>

      {/* mobile: minimal 2-line cabinet toggle (hidden on desktop via CSS) */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`nav-toggle ${open ? "open" : ""}`}
      >
        <svg
          className="nav-toggle-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden
        >
          {/* two equal horizontal lines — rotate into × when open */}
          <line
            x1="6" y1="10" x2="18" y2="10"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="square"
            className="bar bar-1"
          />
          <line
            x1="6" y1="14" x2="18" y2="14"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="square"
            className="bar bar-2"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="nav-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="nav-drawer-panel"
              initial={{ y: -12 }}
              animate={{ y: 0 }}
              exit={{ y: -12 }}
              transition={{ duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] }}
              onClick={(e) => e.stopPropagation()}
            >
              {LINKS.map((l, i) =>
                l.soon ? (
                  <motion.span
                    key={l.label}
                    className="soon"
                    aria-disabled="true"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: 0.08 + i * 0.04,
                      ease: [0.2, 0.65, 0.3, 0.9],
                    }}
                  >
                    {l.label}
                    <span className="soon-chip">Soon</span>
                  </motion.span>
                ) : (
                  <motion.a
                    key={l.label}
                    href={l.href}
                    className={l.active ? "active" : undefined}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: 0.08 + i * 0.04,
                      ease: [0.2, 0.65, 0.3, 0.9],
                    }}
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </motion.a>
                ),
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
