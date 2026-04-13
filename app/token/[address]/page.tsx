import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  redirect(`/explorer/token/${address}`);
}
