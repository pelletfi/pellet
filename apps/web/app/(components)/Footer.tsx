export function Footer() {
  return (
    <>
      <footer className="main-footer">
        <div className="mf-col">
          <h4>Resources</h4>
          <a href="#">
            ERC-8004 Spec <span className="arrow">↗</span>
          </a>
          <a href="#">
            Audit Reports <span className="arrow">↗</span>
          </a>
          <a href="#">
            Brand Kit <span className="arrow">↗</span>
          </a>
        </div>
        <div className="mf-col">
          <h4>Developers</h4>
          <a href="#">
            Docs <span className="arrow">↗</span>
          </a>
          <a href="#">
            SDK <span className="arrow">↗</span>
          </a>
          <a href="#">
            GitHub <span className="arrow">↗</span>
          </a>
        </div>
        <div className="mf-col">
          <h4>Company</h4>
          <a href="#">Research</a>
          <a href="#">Blog</a>
          <a href="#">About</a>
        </div>
        <div />
        <div className="mf-terminal">
          <div className="mf-term-head">
            <span>$ pellet status</span>
            <span className="pellet-dot pellet-dot-lg" />
          </div>
          <pre>
            <span className="k">network  </span>HyperEVM
            {"\n"}
            <span className="k">protocol </span>ERC-8004
            {"\n"}
            <span className="k">registry </span>Live
            {"\n"}
            <span className="k">seed     </span>8004·0001
            {"\n"}
            <span className="k">output   </span>01
            {"\n"}
            <span className="k">status   </span>operational
          </pre>
        </div>
      </footer>

      <footer className="foot">
        <span>© 2026 pellet.network</span>
      </footer>
    </>
  );
}
