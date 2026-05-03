import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeviceApproval } from "./DeviceApproval";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect agent · Pellet Wallet",
  description: "Approve an agent to spend from your Pellet Wallet on Tempo.",
};

export default async function DeviceApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  redirect("/wallet");
  const { code } = await searchParams;

  return (
    <div
      style={{
        minHeight: "calc(100vh - 48px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <DeviceApproval initialCode={code ?? ""} />
    </div>
  );
}
