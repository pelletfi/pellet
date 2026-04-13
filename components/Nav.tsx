import Link from "next/link";

export default function Nav() {
  return (
    <nav
      style={{
        borderBottom: "1px solid #1a1a1f",
        background: "#0f0f11",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand lockup — pixel-locked */}
        <a href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <img
            src="/pellet-mark.png"
            width={28}
            height={28}
            style={{ display: "block", marginRight: "4px", marginLeft: "-4px" }}
            alt="Pellet"
          />
          <span className="inline-flex flex-col" style={{ lineHeight: 1, alignItems: "stretch" }}>
            <span
              style={{
                fontFamily: "var(--font-geist-sans), Geist, system-ui, sans-serif",
                fontWeight: 600,
                fontSize: "16px",
                letterSpacing: "-0.025em",
                color: "#f5f5f5",
                lineHeight: 1,
              }}
            >
              Pellet
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-sans), Geist, system-ui, sans-serif",
                fontSize: "6.5px",
                fontWeight: 600,
                letterSpacing: "0.348em",
                color: "#f5f5f5",
                marginTop: "2px",
                textTransform: "uppercase",
                textAlign: "center",
                marginRight: "-0.18em",
                marginLeft: "0.11em",
                display: "block",
              }}
            >
              finance
            </span>
          </span>
        </a>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "#888",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: "6px",
              transition: "color 0.15s, background 0.15s",
            }}
            className="hover:text-[#e8e8e8] hover:bg-[#1a1a1f]"
          >
            Tokens
          </Link>
          <Link
            href="/stablecoins"
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "#888",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: "6px",
              transition: "color 0.15s, background 0.15s",
            }}
            className="hover:text-[#e8e8e8] hover:bg-[#1a1a1f]"
          >
            Stablecoins
          </Link>
        </div>
      </div>
    </nav>
  );
}
