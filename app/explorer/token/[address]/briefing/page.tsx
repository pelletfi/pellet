import { redirect } from "next/navigation";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

export default async function BriefingRedirect({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    redirect("/explorer");
  }

  const lc = address.toLowerCase();
  const isStablecoin = KNOWN_STABLECOINS.some(
    (s) => s.address.toLowerCase() === lc
  );

  if (isStablecoin) {
    redirect(`/explorer/stablecoin/${address}`);
  }

  redirect("/explorer");
}
