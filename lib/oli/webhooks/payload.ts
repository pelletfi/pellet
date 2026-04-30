import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import type { RecentEventRow } from "@/lib/oli/queries";

// Source of truth for webhook JSON bodies. Mirrors RecentEventRow field-for-
// field with snake_case keys, wrapped in an envelope. Any change here is a
// breaking change for subscribers — bump the type field to "oli.event.v2"
// before touching the inner shape.

export type WebhookEventData = {
  id: number;
  ts: string;
  agent_id: string;
  agent_label: string;
  agent_category: string | null;
  counterparty_address: string | null;
  counterparty_label: string | null;
  counterparty_category: string | null;
  kind: string;
  amount_wei: string | null;
  token_address: string | null;
  tx_hash: string;
  source_block: number;
  methodology_version: string;
  routed_to_address: string | null;
  routed_to_label: string | null;
  routed_fingerprint: string | null;
  explorer_url: string;
};

export type WebhookEnvelope = {
  type: "oli.event.v1";
  id: string;
  delivered_at: string;
  subscription_id: string;
  data: WebhookEventData;
};

export type WebhookVerifyEnvelope = {
  type: "oli.webhook.verify";
  verify_token: string;
  subscription_id: string;
};

export function buildEventData(row: RecentEventRow): WebhookEventData {
  const explorerBase = tempoChainConfig().explorerUrl;
  return {
    id: row.id,
    ts: row.ts.toISOString(),
    agent_id: row.agentId,
    agent_label: row.agentLabel,
    agent_category: row.agentCategory,
    counterparty_address: row.counterpartyAddress,
    counterparty_label: row.counterpartyLabel,
    counterparty_category: row.counterpartyCategory,
    kind: row.kind,
    amount_wei: row.amountWei,
    token_address: row.tokenAddress,
    tx_hash: row.txHash,
    source_block: row.sourceBlock,
    methodology_version: row.methodologyVersion,
    routed_to_address: row.routedToAddress,
    routed_to_label: row.routedToLabel,
    routed_fingerprint: row.routedFingerprint,
    explorer_url: `${explorerBase}/tx/${row.txHash}`,
  };
}

export function buildEnvelope(opts: {
  deliveryId: string;
  subscriptionId: string;
  data: WebhookEventData;
  deliveredAt?: Date;
}): WebhookEnvelope {
  return {
    type: "oli.event.v1",
    id: opts.deliveryId,
    delivered_at: (opts.deliveredAt ?? new Date()).toISOString(),
    subscription_id: opts.subscriptionId,
    data: opts.data,
  };
}

export function buildVerifyEnvelope(opts: {
  subscriptionId: string;
  verifyToken: string;
}): WebhookVerifyEnvelope {
  return {
    type: "oli.webhook.verify",
    verify_token: opts.verifyToken,
    subscription_id: opts.subscriptionId,
  };
}
