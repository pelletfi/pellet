import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllStablecoins,
  KNOWN_STABLECOINS,
} from "@/lib/pipeline/stablecoins";
import { getEditorial } from "@/lib/stablecoin-editorial";
import { getTokenIconUrl } from "@/lib/token-icons";
import StablecoinDetail from "./StablecoinDetail";

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { address } = await params;
  const lower = address.toLowerCase();
  const known = KNOWN_STABLECOINS.find(
    (s) => s.address.toLowerCase() === lower
  );
  if (!known) return { title: "Stablecoin — Pellet" };
  const editorial = getEditorial(lower);
  return {
    title: `${known.symbol} — ${known.name} · Pellet`,
    description:
      editorial?.tagline ??
      `${known.name} stablecoin on Tempo — peg stability, supply dynamics, compliance, and backing.`,
  };
}

export default async function StablecoinPage({ params }: PageProps) {
  const { address } = await params;
  const lower = address.toLowerCase();

  // Validate that this address is a known stablecoin
  const known = KNOWN_STABLECOINS.find(
    (s) => s.address.toLowerCase() === lower
  );
  if (!known) notFound();

  // Pull data in parallel
  const [all, iconUrl] = await Promise.all([
    getAllStablecoins().catch(() => []),
    getTokenIconUrl(known.address).catch(() => null),
  ]);

  const token = all.find((s) => s.address.toLowerCase() === lower);
  if (!token) notFound();

  const editorial = getEditorial(lower);

  // Peers for the CTA — all other stablecoins with editorial context
  const peers = KNOWN_STABLECOINS.filter(
    (s) => s.address.toLowerCase() !== lower
  ).map((s) => ({
    address: s.address,
    name: s.name,
    symbol: s.symbol,
    tagline: getEditorial(s.address.toLowerCase())?.tagline ?? null,
  }));

  return (
    <StablecoinDetail
      token={token}
      editorial={editorial}
      iconUrl={iconUrl}
      peers={peers}
    />
  );
}
