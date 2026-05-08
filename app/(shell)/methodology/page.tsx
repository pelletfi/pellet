import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Pellet Wallet decodes autonomous economic activity on Tempo — event ingestion, agent matching, gateway attribution.",
};

export default function MethodologyPage() {
  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>05</span>
            <span>Methodology</span>
          </h1>
        </div>
        <div className="spec-page-subhead">
          <span>
            How Wallet decodes autonomous economic activity on Tempo. Every datapoint here comes from on-chain state — no off-chain sources, no self-reporting. The pipeline is open and reproducible.
          </span>
        </div>
      </section>

      <article className="spec-prose">
        <Section n="01" title="Event ingestion" version="cron @ :00 hourly">
          <p>
            A Vercel cron at <Mono>/api/cron/ingest</Mono> sweeps Tempo for new logs from watched contracts (TIP-20 stables) using viem against{" "}
            <Mono>rpc.tempo.xyz</Mono>. Logs are stored raw in the <Mono>events</Mono> table, keyed by <Mono>(tx_hash, log_index)</Mono> for idempotency.
          </p>
          <p>
            We watch the <Mono>Transfer</Mono> event (topic <Mono>0xddf252ad…</Mono>) plus a few admin events (Approval, Role*, SupplyCapUpdated). Tempo&apos;s stable-native AA tx envelope (type{" "}
            <Mono>0x76</Mono>) is parsed by reading <Mono>tx.calls[]</Mono> rather than the standard <Mono>tx.input</Mono> field.
          </p>
        </Section>

        <Section n="02" title="Agent matching" version="methodology v0.2">
          <p>
            A second cron at <Mono>/api/cron/match</Mono> joins ingested events to <Mono>agents</Mono> rows by walking the event&apos;s indexed topics and looking for a wallet hit. One agent_event row is written per <Mono>(event, matched agent)</Mono> pair — the same event can match multiple agents (e.g. both sides of a Transfer if both are watched).
          </p>
          <p>
            Each match captures the economic primitive: <Mono>amount_wei</Mono> from the Transfer&apos;s data field, <Mono>token_address</Mono> from the contract, and <Mono>counterparty_address</Mono> from whichever indexed topic isn&apos;t the matched agent.
          </p>
        </Section>

        <Section n="03" title="Gateway attribution" version="cron @ :10 hourly">
          <p>
            The Tempo MPP Gateway settles to a single address (<Mono>0xca4e835f…4779Fe</Mono>) for many underlying providers, so per-service attribution requires extra decoding. A third cron at <Mono>/api/cron/attribute</Mono> walks unprocessed gateway txs and tries two paths.
          </p>

          <SubSection title="Pattern A · Settlement event">
            <p>
              When the gateway routes funds onward to a provider, its escrow contract <Mono>0x33b9…4f25</Mono> emits a custom event keyed at topic <Mono>0x92ed5fe0…</Mono>. The provider address sits at <Mono>topic[2]</Mono>. We read the tx receipt, find the matching log, and persist <Mono>routed_to_address</Mono>.
            </p>
            <p className="spec-prose-faint">
              Coverage: ~9% of gateway txs. The rest don&apos;t go through the settlement path because the user paid the gateway directly and the gateway batches settlement off-cycle.
            </p>
          </SubSection>

          <SubSection title="Pattern B · Calldata fingerprint">
            <p>
              User→gateway txs use the USDC.e <Mono>0x95777d59</Mono> selector with args <Mono>(address recipient, uint256 amount, bytes32 ref)</Mono>. The <Mono>bytes32 ref</Mono> has stable structure:
            </p>
            <pre className="spec-prose-pre">
              0xef1ed71201 + {"<10-byte service fingerprint>"} +
              {"\n             "}
              0000000000000000 + {"<7-byte per-call nonce>"}
            </pre>
            <p>
              Bytes 5–14 are a deterministic per-service fingerprint set by Tempo&apos;s MPP client. We persist them as <Mono>routed_fingerprint</Mono> so all gateway txs cluster by service even when the provider address can&apos;t be recovered.
            </p>
            <p className="spec-prose-faint">
              Coverage: ~91% of gateway txs (combined with Pattern A: essentially 100%). Fingerprints aren&apos;t human-readable until a row is added to <Mono>address_labels</Mono> mapping the fingerprint to a model name; the UI lights up automatically once it&apos;s there.
            </p>
          </SubSection>
        </Section>

        <Section n="04" title="Provenance">
          <p>
            Every row in Wallet carries a <Mono>methodology_version</Mono> tag plus a <Mono>source_block</Mono> reference. The ringed ◍ badge throughout the UI exposes both. Re-deriving any number is a matter of running the matcher against the raw <Mono>events</Mono> table — no opaque steps, no off-chain inputs.
          </p>
          <p>
            Time windows on the dashboard (<Mono>?w=24h|7d|30d|all</Mono>) are also surfaced; every leaderboard, chart, and aggregate is derived from the same SQL filter.
          </p>
        </Section>

        <Section n="05" title="What's not yet decoded">
          <ul className="spec-prose-list">
            <li>
              Provider identities for the 2 attributed addresses (<Mono>0xc95c4f0d…</Mono>, <Mono>0x3fee0b02…</Mono>) and 7 fingerprint groups. These are stable on-chain — only labels are missing.
            </li>
            <li>Non-MPP services (the long tail we couldn&apos;t probe at seed time).</li>
            <li>Cross-tx flow tracing (e.g., a payer&apos;s fund-out path through multiple hops).</li>
          </ul>
        </Section>

        <p className="spec-prose-foot">
          Source: the{" "}
          <a href="https://github.com/pelletnetwork/pellet" className="spec-prose-link">
            pelletnetwork/pellet
          </a>{" "}
          repo on GitHub. SQL lives in <Mono>lib/wallet/queries.ts</Mono>; attribution lives in <Mono>lib/ingest/gateway-attribution.ts</Mono>.
        </p>
      </article>
    </>
  );
}

function Section({
  n,
  title,
  version,
  children,
}: {
  n: string;
  title: string;
  version?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="spec-prose-section">
      <header className="spec-prose-section-head">
        <span className="spec-prose-section-n">{n}</span>
        <h2 className="spec-prose-section-h2">{title}</h2>
        {version && <span className="spec-prose-section-version">{version}</span>}
      </header>
      <div className="spec-prose-body">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="spec-prose-sub">
      <h3 className="spec-prose-sub-h3">{title}</h3>
      {children}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="spec-prose-mono">{children}</code>;
}
