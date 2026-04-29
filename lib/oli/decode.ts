import { formatUsdcAmount, shortAddress } from "./format";

// Most TIP-20 stables on Tempo are 6-decimal (USDC.e, USDT0, EURC.e, etc.).
// Future: look up token metadata from chain or address_labels notes.
const DEFAULT_DECIMALS = 6;

export type DecodeInput = {
  agentId: string;
  agentLabel: string;
  agentAddress?: string;
  kind: string;
  counterpartyAddress: string | null;
  amountWei: string | null;
  tokenAddress: string | null;
  ts: Date;
};

export type LabelMap = Record<string, { label: string; category: string }>;

export type DecodedLine = {
  summary: string;
  category: string | null;
  amountDisplay: string;
};

// Produce a human-legible one-liner for the OLI feed. The matched agent is
// always one party in the transfer; the counterparty might be a labeled service
// (Anthropic, Dune, etc.) or an unknown wallet.
//
// v0 contract: ALWAYS renders as "{matchedAgent} paid {counterparty}". The
// queries layer is responsible for selecting which "side" of the transfer to
// call this with (e.g., for Anthropic-receiving rows, the queries layer should
// pre-resolve the payer agent and call decode with that as agentLabel).
export function decodeEventLine(
  input: DecodeInput,
  labels: LabelMap,
): DecodedLine {
  const amountDisplay = formatUsdcAmount(input.amountWei, DEFAULT_DECIMALS);

  if (input.kind !== "transfer" || !input.counterpartyAddress || !input.amountWei) {
    return {
      summary: `${input.agentLabel} · ${input.kind} event`,
      category: null,
      amountDisplay,
    };
  }

  const counterpartyKey = input.counterpartyAddress.toLowerCase();
  const counterparty = labels[counterpartyKey];
  const counterpartyName = counterparty?.label ?? shortAddress(input.counterpartyAddress);

  // Infer category from agent or counterparty label match
  let category: string | null = null;

  // Try to find category from agent address if provided
  if (input.agentAddress) {
    const agentKey = input.agentAddress.toLowerCase();
    const agentInfo = labels[agentKey];
    if (agentInfo?.category) {
      category = agentInfo.category;
    }
  }

  // If not found via address, try reverse-lookup by agentLabel
  if (!category) {
    for (const entry of Object.values(labels)) {
      if (entry.label === input.agentLabel) {
        category = entry.category;
        break;
      }
    }
  }

  // Fall back to counterparty category if agent not found
  if (!category && counterparty?.category) {
    category = counterparty.category;
  }

  return {
    summary: `${input.agentLabel} paid ${counterpartyName} ${amountDisplay}`,
    category,
    amountDisplay,
  };
}
