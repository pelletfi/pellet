import { pgTable, text, serial, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tokens = pgTable("tokens", {
  address: text("address").primaryKey(),
  name: text("name"),
  symbol: text("symbol"),
  tokenType: text("token_type"), // 'tip20' or 'erc20'
  decimals: integer("decimals"),
  marketData: jsonb("market_data"),
  safety: jsonb("safety"),
  holders: jsonb("holders"),
  compliance: jsonb("compliance"),
  identity: jsonb("identity"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stablecoins = pgTable("stablecoins", {
  address: text("address").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  currency: text("currency").notNull(),
  issuerAdmin: text("issuer_admin"),
  policyId: integer("policy_id"),
  policyType: text("policy_type"),
  supplyCap: numeric("supply_cap"),
  currentSupply: numeric("current_supply"),
  headroomPct: numeric("headroom_pct"),
  priceVsPathusd: numeric("price_vs_pathusd"),
  spreadBps: numeric("spread_bps"),
  volume24h: numeric("volume_24h"),
  yieldRate: numeric("yield_rate"),
  optedInSupply: numeric("opted_in_supply"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stablecoinFlows = pgTable("stablecoin_flows", {
  id: serial("id").primaryKey(),
  fromToken: text("from_token").notNull(),
  toToken: text("to_token").notNull(),
  hour: timestamp("hour", { withTimezone: true }).notNull(),
  netFlowUsd: numeric("net_flow_usd").notNull(),
  txCount: integer("tx_count").notNull(),
});

export const briefings = pgTable("briefings", {
  id: serial("id").primaryKey(),
  tokenAddress: text("token_address").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const policies = pgTable("policies", {
  policyId: integer("policy_id").primaryKey(),
  policyType: text("policy_type"),
  admin: text("admin"),
  tokenCount: integer("token_count").default(0),
  tokens: text("tokens").array(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
