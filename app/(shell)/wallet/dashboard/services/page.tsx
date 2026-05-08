import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { WalletTabs } from "@/components/wallet/WalletTabs";
import { fetchDirectory } from "@/lib/mpp";
import { ServiceCatalog } from "./ServiceCatalog";

export const metadata: Metadata = {
  title: "Services — Pellet Wallet",
  description: "MPP-enabled services your agent can access and pay for.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ServicesPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/wallet/sign-in");

  const services = await fetchDirectory();

  return (
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Services</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath="/wallet" />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-subhead-pair">
            <span className="spec-page-subhead-label">MPP DIRECTORY</span>
            <span>{services.length} services</span>
          </span>
          <span className="spec-subhead-pair">
            <span className="spec-page-subhead-label">PROTOCOL</span>
            <span>HTTP 402 · Tempo</span>
          </span>
        </div>
      </section>

      <ServiceCatalog services={services} />
    </div>
  );
}
