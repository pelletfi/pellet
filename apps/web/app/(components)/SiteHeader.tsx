import { Nav } from "./Nav";
import { PelletMark } from "./PelletMark";

export function SiteHeader() {
  return (
    <div className="site-header">
      <div className="header">
        <div className="brand">
          <PelletMark />
          <span>Pellet</span>
        </div>
        <div className="tag">
          <span>ERC-8004</span>
          <span className="tag-sep">/</span>
          <span>HyperEVM</span>
          <span className="tag-sep">/</span>
          <span className="hl-mark" role="img" aria-label="Hyperliquid" />
        </div>
      </div>
      <Nav />
      <hr className="dashed-rule" />
    </div>
  );
}
