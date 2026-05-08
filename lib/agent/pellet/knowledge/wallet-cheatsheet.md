# Pellet Wallet Cheatsheet

High-confidence answers for common questions. Always prefer this over speculation.

## Auth

**Passkey (owner-direct):** the wallet's master key is a passkey on the user's device. Used for owner-only actions (revoking sessions, changing settings, owner-direct send/swap when no paired session exists).

**Session keys (paired sessions):** scoped, time-limited keys minted via `pellet auth start`. Used by external agents (BYOA) and standalone CLI. Have per-call and per-session spending caps. Can be revoked from the wallet dashboard.

**BYOA flow:** external agent → `pellet auth start` (device-code style) → user approves in wallet → agent receives bearer token → agent calls Pellet API with that token → all actions gated by session caps.

## 402 / x402 protocol

When a paid endpoint returns HTTP 402, the response includes a payment offer (amount, currency, intent: `charge` | `session`, method). Pellet auto-signs payment for the offer if it's within the session's per-call cap and the call is within the session's spend cap. Result is captured by the proxy / MCP client and the original request is retried with the payment receipt.

## MPP catalog

The catalog is the registry of x402-aware services Pellet knows about. Each service has endpoints with offers and an OpenAPI-style schema. Discovery happens at indexing time, not at call time. To call: `/call <service-id>` or via natural language ("scrape this URL").

## Swaps

In-wallet swap routing goes through Tempo's native AMM. `quoteSwap` returns expected output and slippage. Execution always requires user confirmation.

## Send

Sends require user confirmation. Owner-direct send (no paired session) routes via the passkey path. Paired-session send routes via the session key.

## Supported assets

- `USDC.e` (bridged USDC on Tempo)
- `pathUSD` (Moderato demo stable)

## Common error codes

- `401 missing bearer token` — no `Authorization: Bearer ...` header
- `403 session revoked` — session has been revoked from the dashboard
- `403 spend cap exceeded` — session's total spend cap reached
- `402 payment required` — paid endpoint requires x402 payment

## What the agent will NOT do

- Move funds without user confirmation. Ever.
- Reveal private keys, passkey credentials, or recovery phrases.
- Execute trades or sends from natural language alone — always renders a confirmation step.
