import { executePayment, type PaymentUser } from "@/lib/wallet/execute-payment";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import type { walletSessions } from "@/lib/db/schema";

type WalletSessionRow = typeof walletSessions.$inferSelect;

export type MppRequestInput = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  session: WalletSessionRow;
  user: PaymentUser;
};

export type MppRequestResult = {
  status: number;
  headers: Record<string, string>;
  body: string;
  payment?: {
    challengeId: string;
    amountWei: string;
    recipient: string;
    txHash: string;
    explorerUrl: string;
  };
};

type ParsedChallenge = {
  id: string;
  method: string;
  intent: string;
  request: {
    amount: string;
    currency: string;
    recipient: string;
    [key: string]: unknown;
  };
  expires?: string;
};

function parseWwwAuthenticate(header: string): ParsedChallenge | null {
  if (!header.toLowerCase().startsWith("payment ")) return null;

  const params = header.slice("payment ".length);
  const fields: Record<string, string> = {};

  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(params)) !== null) {
    fields[m[1]] = m[2];
  }

  if (!fields.id || !fields.request) return null;

  let request: ParsedChallenge["request"];
  try {
    const decoded = Buffer.from(fields.request, "base64url").toString("utf8");
    request = JSON.parse(decoded);
  } catch {
    try {
      request = JSON.parse(fields.request);
    } catch {
      return null;
    }
  }

  return {
    id: fields.id,
    method: fields.method ?? "tempo",
    intent: fields.intent ?? "charge",
    request,
    expires: fields.expires,
  };
}

function buildPaymentCredential(challengeId: string, txHash: string): string {
  const payload = Buffer.from(
    JSON.stringify({ transaction: txHash }),
  ).toString("base64url");
  return `Payment id="${challengeId}", payload="${payload}"`;
}

function resolveRecipient(
  challenge: ParsedChallenge,
): `0x${string}` | null {
  const r = challenge.request.recipient;
  if (r && /^0x[0-9a-fA-F]{40}$/.test(r)) return r as `0x${string}`;
  return null;
}

function resolveAmount(challenge: ParsedChallenge): bigint | null {
  const a = challenge.request.amount;
  if (!a) return null;
  try {
    return BigInt(a);
  } catch {
    return null;
  }
}

export async function mppRequest(
  input: MppRequestInput,
): Promise<MppRequestResult> {
  const { url, method = "GET", headers = {}, body, session, user } = input;

  const initial = await fetch(url, {
    method,
    headers: { ...headers, Accept: "application/json" },
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  if (initial.status !== 402) {
    const respHeaders: Record<string, string> = {};
    initial.headers.forEach((v, k) => { respHeaders[k] = v; });
    return {
      status: initial.status,
      headers: respHeaders,
      body: await initial.text(),
    };
  }

  const wwwAuth = initial.headers.get("www-authenticate");
  if (!wwwAuth) {
    return {
      status: 402,
      headers: {},
      body: "402 Payment Required but no WWW-Authenticate header",
    };
  }

  const challenge = parseWwwAuthenticate(wwwAuth);
  if (!challenge) {
    return {
      status: 402,
      headers: {},
      body: `402 Payment Required but could not parse challenge: ${wwwAuth}`,
    };
  }

  const recipient = resolveRecipient(challenge);
  const amountWei = resolveAmount(challenge);

  if (!recipient || !amountWei) {
    return {
      status: 402,
      headers: {},
      body: `402 challenge missing recipient or amount: ${JSON.stringify(challenge.request)}`,
    };
  }

  const chain = tempoChainConfig();

  const result = await executePayment({
    session: session as any,
    user,
    to: recipient,
    amountWei,
    memo: challenge.id,
    token: chain.usdcE,
  });

  if (!result.ok) {
    return {
      status: 402,
      headers: {},
      body: `Payment failed: ${result.error}${result.detail ? ` — ${result.detail}` : ""}`,
    };
  }

  const credential = buildPaymentCredential(challenge.id, result.txHash);
  const retry = await fetch(url, {
    method,
    headers: {
      ...headers,
      Accept: "application/json",
      Authorization: credential,
    },
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  const retryHeaders: Record<string, string> = {};
  retry.headers.forEach((v, k) => { retryHeaders[k] = v; });

  return {
    status: retry.status,
    headers: retryHeaders,
    body: await retry.text(),
    payment: {
      challengeId: challenge.id,
      amountWei: amountWei.toString(),
      recipient,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
    },
  };
}
