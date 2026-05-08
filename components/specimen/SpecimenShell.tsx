"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Footer from "@/components/Footer";

const STORAGE_KEY = "specimen-theme";

const NAV_LINKS: { label: string; href: string }[] = [];

function TopBar({
  pathname,
  dark,
  onToggleTheme,
}: {
  pathname: string;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isSignIn = pathname === "/wallet/sign-in" || pathname === "/wallet";
  const isWalletApp = pathname.startsWith("/wallet/dashboard");

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <header className="spec-topbar">
      <Link href="/" className="spec-brand" aria-label="Pellet Network — home">
        <svg
          className="spec-brand-mark"
          viewBox="0 0 1024 1024"
          aria-hidden="true"
        >
          <g transform="translate(112 112) scale(1.6)">
            <path
              fill="var(--fg)"
              fillRule="evenodd"
              d="M397.75,106.78h-56.39c-11.07,0-20.04-8.97-20.04-20.04V33.24c0-11.07-8.97-20.04-20.04-20.04H196.68c-11.07,0-20.04,8.97-20.04,20.04v53.51c0,11.07-8.97,20.04-20.04,20.04H103.1c-11.07,0-20.04,8.97-20.04,20.04v105.33c0,11.07,8.97,20.04,20.04,20.04h57.35c11.07,0,20.04,8.97,20.04,20.04v47.75c0,11.07-8.97,20.04-20.04,20.04H103.1c-11.07,0-20.04,8.97-20.04,20.04v106.08c0,11.07,8.97,20.04,20.04,20.04h65.02c11.07,0,20.04-8.97,20.04-20.04v-98.4c0-11.07,8.97-20.04,20.04-20.04h96.94c11.07,0,20.04-8.97,20.04-20.04v-55.43c0-11.07,8.97-20.04,20.04-20.04h52.55c11.07,0,20.04-8.97,20.04-20.04V126.81C417.79,115.75,408.82,106.78,397.75,106.78z M292.66,242.58H208.2c-11.07,0-20.04-8.97-20.04-20.04v-84.22c0-11.07,8.97-20.04,20.04-20.04h84.46c11.07,0,20.04,8.97,20.04,20.04v84.22C312.69,233.61,303.72,242.58,292.66,242.58z"
            />
          </g>
        </svg>
        <span className="spec-brand-name">Pellet Network</span>
      </Link>
      <nav
        className={`spec-nav${mobileNavOpen ? " spec-nav-open" : ""}`}
        aria-label="Pellet sections"
      />
      <div className="spec-topbar-actions">
        {!isSignIn && NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`spec-nav-link${pathname.startsWith(link.href) ? " spec-nav-link-active" : ""}${isWalletApp ? " spec-hide-mobile" : ""}`}
            onClick={() => setMobileNavOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <ThemeToggleButton dark={dark} onToggle={onToggleTheme} />
        {!isSignIn && (
          <button
            type="button"
            className={`spec-mobile-nav-toggle${isWalletApp ? " spec-hide-mobile" : ""}`}
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        )}
      </div>
    </header>
  );
}

function ThemeToggleButton({
  dark,
  onToggle,
}: {
  dark: boolean;
  onToggle: () => void;
}) {
  // Show the icon for the *target* mode (sun in dark, moon in light) so the
  // affordance answers "click here to go to ___."
  return (
    <button
      type="button"
      onClick={onToggle}
      className="spec-theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode (M)" : "Switch to dark mode (M)"}
    >
      {dark ? (
        // Sun
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="square"
        >
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1 V3 M8 13 V15 M1 8 H3 M13 8 H15 M3 3 L4.5 4.5 M11.5 11.5 L13 13 M3 13 L4.5 11.5 M11.5 4.5 L13 3" />
        </svg>
      ) : (
        // Moon
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="square"
        >
          <path d="M13 9.5 A6 6 0 1 1 6.5 3 A4.5 4.5 0 0 0 13 9.5 Z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Specimen shell — top nav, content slot, live status strip. Dark is
 * default; pressing `M` (or clicking the theme button) flips a `dark`
 * class on the root div and persists to localStorage. We intentionally do
 * NOT honor prefers-color-scheme — first-load is always ink unless the
 * user has explicitly chosen light before.
 *
 * Bottom strip used to be a static keymap legend; replaced by a live Wallet
 * stat strip (24h MPP txs + sparkline, volume, agents, last activity).
 */
export function SpecimenShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const [dark, setDark] = useState(true);

  // Hydrate from storage; URL `?theme=dark|light` overrides for screenshots.
  // Default is dark — only an explicit stored "light" flips it.
  useEffect(() => {
    let initial = true;
    try {
      initial = window.localStorage.getItem(STORAGE_KEY) !== "light";
      const url = new URL(window.location.href);
      const q = url.searchParams.get("theme");
      if (q === "dark") initial = true;
      if (q === "light") initial = false;
    } catch {
      /* noop */
    }
    setDark(initial);
  }, []);

  // M key — toggle theme. Skip when focus is in form controls.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((ev.target as HTMLElement | null)?.isContentEditable) return;
      if (ev.key === "m" || ev.key === "M") {
        ev.preventDefault();
        setDark((prev) => {
          const next = !prev;
          try {
            window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
          } catch {
            /* noop */
          }
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch {
        /* noop */
      }
      return next;
    });
  }

  return (
    <div className={`specimen-shell${dark ? " dark" : ""}`}>
      <TopBar pathname={pathname} dark={dark} onToggleTheme={toggleTheme} />
      <div className="spec-main">{children}</div>
      <Footer />
    </div>
  );
}
