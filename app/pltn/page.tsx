import Link from "next/link";
import { LiveTicker } from "./LiveTicker";
import { PriceChart } from "./PriceChart";
import { BuyWidget } from "./BuyWidget";
import { Socials } from "./Socials";
import { Sphere } from "./Sphere";
import { InfoPanel } from "./InfoPanel";
import { PelletGlobe } from "@/components/pellet-globe";
import { TempoWordmark } from "./TempoWordmark";
import { Reveal } from "./motion";

export default function PLTNPage() {
  const year = new Date().getFullYear();
  return (
    <div className="pltn-shell">
      {/* ── Marque ────────────────────────────────────────────────── */}
      <Reveal as="header" className="pltn-marque" step={0}>
        <Link href="/" className="pltn-marque-left" aria-label="Pellet Network home">
          <span className="pltn-mark"><PelletGlobe size={26} /></span>
          <span>
            Pellet Network<sup className="pltn-marque-c">©</sup>
          </span>
        </Link>
        <a
          href="https://tempo.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="pltn-marque-right"
          aria-label="Built on Tempo"
        >
          <span className="pltn-built-on">built on</span>
          <TempoWordmark height={9} />
        </a>
      </Reveal>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <Reveal className="pltn-hero" step={1}>
        <div className="pltn-hero-text">
          <h1 className="pltn-display-h">
            Agentic by design. Open by default.
          </h1>
          <p className="pltn-display-lede">
            $PLTN is the utility token for payments, coordination, and liquidity
            across the agentic web. Native to Tempo, fixed at 100 million supply,
            fully self-sovereign from genesis.
          </p>
        </div>
        <Sphere />
      </Reveal>

      {/* ── Live ticker ───────────────────────────────────────────── */}
      <Reveal step={3}>
        <LiveTicker />
      </Reveal>

      {/* ── Chart ─────────────────────────────────────────────────── */}
      <Reveal className="pltn-chart-frame" step={4}>
        <div className="pltn-chart-h">
          <span><span className="pltn-chart-h-pair">PLTN / pathUSD</span> · 1H</span>
          <span>Live</span>
        </div>
        <PriceChart />
      </Reveal>

      {/* ── Holders / contracts / trades ──────────────────────────── */}
      <Reveal step={5}>
        <InfoPanel />
      </Reveal>

      {/* ── Buy ───────────────────────────────────────────────────── */}
      <Reveal className="pltn-buy-frame" step={6}>
        <BuyWidget />
      </Reveal>

      {/* ── Colophon ──────────────────────────────────────────────── */}
      <Reveal as="footer" className="pltn-colophon" step={7}>
        <Socials />
        <span>© {year} Pellet Network</span>
      </Reveal>
    </div>
  );
}
