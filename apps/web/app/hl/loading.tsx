import { Footer } from "../(components)/Footer";
import { SiteHeader } from "../(components)/SiteHeader";

export default function Loading() {
  return (
    <div className="page">
      <SiteHeader />

      <section className="hl-header">
        <div className="hl-section-label">§ Registry</div>
        <h1 className="hl-title hl-skel-title">Loading registry…</h1>
        <p className="hl-lead">
          Reading directly from HyperEVM. First load may take a few seconds while the RPC
          scan completes; subsequent visits are cached.
        </p>
      </section>

      <section className="hl-stats">
        <SkelStat />
        <SkelStat />
        <SkelStat />
        <SkelStat />
      </section>

      <section className="hl-section">
        <div className="hl-table-head">
          <h3>Agents</h3>
          <span className="hl-meta">Reading registries…</span>
        </div>
        <div className="hl-empty">
          <span className="hl-skel-bar" /> <span className="hl-skel-bar hl-skel-bar-sm" />
        </div>
      </section>

      <Footer />
    </div>
  );
}

function SkelStat() {
  return (
    <div className="hl-stat">
      <span className="hl-stat-value hl-skel-num">—</span>
      <span className="hl-stat-label">Loading</span>
    </div>
  );
}
