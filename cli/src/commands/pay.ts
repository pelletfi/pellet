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

  const res = await fetch(`${session.baseUrl ?? defaultBaseUrl()}/api/wallet/pay`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.bearer}`,
    },
    body: JSON.stringify({
      to: args.to,
      amount_wei: amountWei,
      memo: args.memo ?? null,
      token: args.token,
    }),
  });
  const data = (await res.json()) as PayResponse;

  if (!res.ok || !data.ok) {
    console.error(`  ${err("✗")} ${data.error ?? "payment failed"}`);
    if (data.detail) console.error(`  ${dim(data.detail)}`);
    return 1;
  }

  process.stdout.write(`  ${ok("✓")} payment confirmed.\n\n`);
  process.stdout.write(`  ${dim("from:        ")} ${data.from}\n`);
  process.stdout.write(`  ${dim("to:          ")} ${data.to}\n`);
  process.stdout.write(`  ${dim("amount:      ")} $${formatUsd(data.amount_wei!)}\n`);
  process.stdout.write(`  ${dim("memo:        ")} ${data.memo}\n`);
  process.stdout.write(`  ${dim("tx:          ")} ${accent(data.tx_hash!)}\n`);
  process.stdout.write(`  ${dim("explorer:    ")} ${accent(data.explorer_url!)}\n\n`);
  process.stdout.write(
    `  ${dim("session:")} $${formatUsd(data.spend_used_wei_after!)} of $${formatUsd(data.spend_cap_wei!)} used\n`,
  );
  return 0;
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
