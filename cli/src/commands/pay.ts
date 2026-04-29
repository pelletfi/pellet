import { defaultBaseUrl, readSession } from "../config.js";

type PayResponse = {
  ok: boolean;
  tx_hash?: string;
  explorer_url?: string;
  from?: string;
  to?: string;
  amount_wei?: string;
  memo?: string;
  token?: string;
  spend_used_wei_after?: string;
  spend_cap_wei?: string;
  error?: string;
  detail?: string;
};

export type PayArgs = {
  to?: string;
  amountUsdc?: string;
  amountWei?: string;
  memo?: string;
  token?: string;
};

export async function pay(args: PayArgs): Promise<number> {
  const session = await readSession();
  if (!session) {
    console.error("no active session — run `pellet auth start` first");
    return 1;
  }

  if (!args.to) {
    console.error("--to <address> is required");
    return 2;
  }
  if (!args.amountUsdc && !args.amountWei) {
    console.error("--amount <usdc> or --amount-wei <wei> is required");
    return 2;
  }

  const amountWei = args.amountWei
    ? args.amountWei
    : String(BigInt(Math.round(Number(args.amountUsdc) * 1_000_000)));

  process.stdout.write(`\n  ${dim("signing payment…")}\n`);

  // env override beats saved baseUrl — easier to point a CLI session at
  // a different host without re-pairing.
  const baseUrl = process.env.PELLET_BASE_URL ?? session.baseUrl ?? defaultBaseUrl();
  const data = (await postWithAuth(
    `${baseUrl}/api/wallet/pay`,
    session.bearer,
    {
      to: args.to,
      amount_wei: amountWei,
      memo: args.memo ?? null,
      token: args.token,
    },
  )) as { res: Response; body: PayResponse };
  const res = data.res;
  const responseBody = data.body;

  if (!res.ok || !responseBody.ok) {
    console.error(`  ${err("✗")} ${responseBody.error ?? "payment failed"}`);
    if (responseBody.detail) console.error(`  ${dim(responseBody.detail)}`);
    return 1;
  }

  process.stdout.write(`  ${ok("✓")} payment confirmed.\n\n`);
  process.stdout.write(`  ${dim("from:        ")} ${responseBody.from}\n`);
  process.stdout.write(`  ${dim("to:          ")} ${responseBody.to}\n`);
  process.stdout.write(`  ${dim("amount:      ")} $${formatUsd(responseBody.amount_wei!)}\n`);
  process.stdout.write(`  ${dim("memo:        ")} ${responseBody.memo}\n`);
  process.stdout.write(`  ${dim("tx:          ")} ${accent(responseBody.tx_hash!)}\n`);
  process.stdout.write(`  ${dim("explorer:    ")} ${accent(responseBody.explorer_url!)}\n\n`);
  process.stdout.write(
    `  ${dim("session:")} $${formatUsd(responseBody.spend_used_wei_after!)} of $${formatUsd(responseBody.spend_cap_wei!)} used\n`,
  );
  return 0;
}

/**
 * POST that follows redirects manually, preserving the Authorization
 * header. Node's fetch (and most browsers) drops auth headers across
 * cross-origin redirects per the Fetch spec — pellet.network →
 * www.pellet.network is a different origin. We re-issue the POST at
 * each Location with the same headers and body, max 5 hops.
 */
async function postWithAuth(
  url: string,
  bearer: string,
  body: unknown,
): Promise<{ res: Response; body: PayResponse }> {
  let target = url;
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${bearer}`,
  };
  const serialized = JSON.stringify(body);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(target, {
      method: "POST",
      headers,
      body: serialized,
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return {
          res,
          body: { ok: false, error: `redirect ${res.status} with no Location` },
        };
      }
      target = new URL(loc, target).toString();
      continue;
    }
    const data = (await res.json()) as PayResponse;
    return { res, body: data };
  }
  return { res: new Response(null, { status: 599 }), body: { ok: false, error: "too many redirects" } };
}

function formatUsd(wei: string): string {
  return (Number(wei) / 1_000_000).toFixed(4);
}

function dim(s: string): string {
  return process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s;
}
function accent(s: string): string {
  return process.stdout.isTTY ? `\x1b[36m${s}\x1b[0m` : s;
}
function ok(s: string): string {
  return process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s;
}
function err(s: string): string {
  return process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s;
}
