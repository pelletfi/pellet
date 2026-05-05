import { Handler } from "accounts/server";
import { privateKeyToAccount } from "viem/accounts";
import { tempo, tempoModerato } from "viem/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEE_PAYER_KEY = process.env.SPONSOR_FEE_PAYER_KEY as `0x${string}` | undefined;

const handler = Handler.relay({
  chains: [tempo, tempoModerato],
  ...(FEE_PAYER_KEY && {
    feePayer: {
      account: privateKeyToAccount(FEE_PAYER_KEY),
      name: "Pellet",
      url: "https://pellet.network",
    },
  }),
});

export const GET = handler.fetch;
export const POST = handler.fetch;
