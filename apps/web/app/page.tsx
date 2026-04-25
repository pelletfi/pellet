import { Architecture } from "./(components)/Architecture";
import { Chapter } from "./(components)/Chapter";
import { ContractRegistry } from "./(components)/ContractRegistry";
import { Footer } from "./(components)/Footer";
import { Hero } from "./(components)/Hero";
import { LiveFeed } from "./(components)/LiveFeed";
import { PullQuote } from "./(components)/PullQuote";
import { SiteHeader } from "./(components)/SiteHeader";
import { StatsStrip } from "./(components)/StatsStrip";
import { HL_REGISTRY_ADDRESSES } from "@/lib/hl/addresses";

const MAINNET = HL_REGISTRY_ADDRESSES.mainnet;

export default function Home() {
  return (
    <div className="page">
      <SiteHeader />

      {/* ── hero ── */}
      <Hero />

      {/* ── stats ── */}
      <StatsStrip />

      {/* ── chapter 01 — Anchor (Identity) ── */}
      <Chapter
        id="identity"
        sectionId="§ 01"
        title="Anchor"
        subtitle="Identity Registry · ERC-8004"
        addr={MAINNET.identity}
        imageSrc="/images/identity.png"
        imageAlt="Anchor — cliffside architecture"
        body={
          <>
            <strong>Anchor</strong>
            {" "}is Pellet&apos;s identity registry — it issues ERC-8004 compliant agent
            IDs to autonomous systems interacting with on-chain markets. Each anchor is a
            cryptographic handle: permissionless to mint, impossible to forge, trivially
            resolvable.
          </>
        }
        linkLabel="Anchor registry →"
        linkHref="/hl"
      />

      {/* ── chapter 02 — Mesh (Reputation) ── */}
      <Chapter
        id="reputation"
        sectionId="§ 02"
        title="Mesh"
        subtitle="Reputation Registry · ERC-8004"
        addr={MAINNET.reputation}
        imageSrc="/images/reputation.png"
        imageAlt="Mesh"
        body={
          <>
            <strong>Mesh</strong>
            {" "}is Pellet&apos;s reputation registry — it indexes attestations emitted by
            agents and counterparties. Every interaction leaves a verifiable trace. No
            off-chain scoring, no opaque ranking — the registry stores facts, consumers
            compose judgement. Attestations compose: an agent&apos;s reputation is the
            closure of its neighborhood, not a number a third party hands down.
          </>
        }
        linkLabel="Mesh registry →"
        linkHref="/hl"
      />

      {/* ── pull quote ── */}
      <PullQuote />

      {/* ── chapter 03 — Cipher (Validation) ── */}
      <Chapter
        id="validation"
        sectionId="§ 03"
        title="Cipher"
        subtitle="Validation Registry · ERC-8004"
        addr={MAINNET.validation}
        imageSrc="/images/validation.png"
        imageAlt="Cipher — glass house in forest"
        body={
          <>
            <strong>Cipher</strong>
            {" "}is Pellet&apos;s validation registry — proofs that substantiate agent
            claims. An agent submits a hashed assertion, references an off-chain
            verification artifact, and settles trust on-chain. Anyone can dispute;
            disputes are themselves ciphers. The registry is a substrate for
            truth-maintenance, not a judge.
          </>
        }
        linkLabel="Cipher registry →"
        linkHref="/hl"
      />

      {/* ── architecture ── */}
      <Architecture />

      {/* ── contract registry ── */}
      <ContractRegistry />

      {/* ── live feed ── */}
      <LiveFeed />

      {/* ── chapter 04 — Commitment ── */}
      <Chapter
        sectionId="§ 04"
        title="Commitment"
        addr="open infrastructure"
        statusLabel="Open"
        imageSrc="/images/commitment.png"
        imageAlt="Commitment — solar station in mountains"
        body={
          <>
            Pellet is the agentic infrastructure layer on Hyperliquid. We provide the
            modular, intelligent, and scalable foundation for the next generation of
            on-chain systems — public registries, open contracts, verifiable state. No
            proprietary runtime, no gated APIs, no extractive rent.
          </>
        }
      />

      {/* ── footer ── */}
      <Footer />
    </div>
  );
}
