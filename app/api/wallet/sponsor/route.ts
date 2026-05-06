import { Handler } from "accounts/server";
import { privateKeyToAccount } from "viem/accounts";
import { tempo, tempoModerato } from "viem/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEE_PAYER_KEY = process.env.SPONSOR_FEE_PAYER_KEY as `0x${string}` | undefined;

const relay = Handler.relay({
  chains: [tempo, tempoModerato],
  ...(FEE_PAYER_KEY && {
    feePayer: {
      account: privateKeyToAccount(FEE_PAYER_KEY),
      name: "Pellet",
      url: "https://pellet.network",
    },
  }),
});

// The Hono handler inside expects requests at `/`, but Next.js passes the
// full path (`/api/wallet/sponsor`). Rewrite the URL so the internal router
// matches.
function rebase(req: Request): Request {
  const url = new URL(req.url);
  url.pathname = "/";
  return new Request(url, req);
}

export const GET = (req: Request) => relay.fetch(rebase(req));
export const POST = (req: Request) => relay.fetch(rebase(req));
