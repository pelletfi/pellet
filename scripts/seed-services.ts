import { MPP_SERVICES, SeedMppService, ProbeAttempt } from "@/data/mpp-services";
import { db } from "@/lib/db/client";
import { agents, addressLabels } from "@/lib/db/schema";

const HEX_ADDR = /0x[a-fA-F0-9]{40}/;
const PROBE_TIMEOUT_MS = 5000;

// Extract the settlement (recipient) address from a string.
// MPP's WWW-Authenticate header encodes the payment intent as base64 JSON in
// a `request="<base64>"` attribute. That JSON contains a `recipient` field
// which is the actual settlement address. We prefer that over other hex
// addresses (e.g. the currency token address that appears earlier in the JSON).
function extractAddress(s: string): string | null {
  // Try to decode base64 blobs embedded in quoted attributes first.
  // This covers the MPP `request="..."` pattern which is the authoritative source.
  const b64Matches = s.matchAll(/(?:request|token|payload|data)="([A-Za-z0-9+/=_-]{20,})"/g);
  for (const bm of b64Matches) {
    try {
      const decoded = Buffer.from(bm[1], "base64").toString("utf8");
      // Prefer the `recipient` field if present.
      const recipientMatch = decoded.match(/"recipient"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
      if (recipientMatch) return recipientMatch[1].toLowerCase();
      // Fall back to any hex address in the decoded blob.
      const anyMatch = decoded.match(HEX_ADDR);
      if (anyMatch) return anyMatch[0].toLowerCase();
    } catch {
      // not valid base64, skip
    }
  }

  // Direct match in the raw string (covers body JSON or plain-text headers).
  // Prefer `recipient` key if present.
  const recipientDirect = s.match(/"recipient"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
  if (recipientDirect) return recipientDirect[1].toLowerCase();

  const direct = s.match(HEX_ADDR);
  return direct ? direct[0].toLowerCase() : null;
}

// Try a single probe attempt. Returns [statusCode, address | null].
async function tryProbe(
  base: string,
  attempt: ProbeAttempt,
): Promise<[number | null, string | null]> {
  const url = `${base}${attempt.path}`;
  const isPost = attempt.method === "POST";
  const opts: RequestInit = {
    method: attempt.method,
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    ...(isPost && attempt.body != null
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt.body),
        }
      : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`    ${attempt.method} ${url} → ERROR (${msg})`);
    return [null, null];
  }

  // Search WWW-Authenticate, Payment-Receipt headers, then response body.
  const wwwAuth = res.headers.get("www-authenticate") ?? "";
  const payReceipt = res.headers.get("payment-receipt") ?? "";
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    // body read failed; ignore
  }

  const address =
    extractAddress(wwwAuth) ??
    extractAddress(payReceipt) ??
    extractAddress(bodyText);

  console.log(
    `    ${attempt.method} ${url} → ${res.status}` +
      (address ? ` ✓ addr=${address}` : ""),
  );

  return [res.status, address];
}

// Probe an MPP service. Iterates through probePaths (if defined) stopping at
// the first 402 with an address. Falls back to GET / if no probePaths.
async function probeSettlementAddress(svc: SeedMppService): Promise<string | null> {
  const paths: ProbeAttempt[] =
    svc.probePaths && svc.probePaths.length > 0
      ? svc.probePaths
      : [{ method: "GET", path: "/" }];

  for (const attempt of paths) {
    const [status, address] = await tryProbe(svc.mppEndpoint, attempt);
    if (status === 402 && address) {
      return address;
    }
    // If we got a 402 without an address, keep trying other paths.
    // For non-402 responses, keep trying too — some gateways vary by path.
  }
  return null;
}

async function main() {
  let probed = 0;
  let known = 0;
  let skipped = 0;

  for (const svc of MPP_SERVICES) {
    let address = svc.settlementAddress;
    if (!address) {
      console.log(`→ probing ${svc.id} (${svc.mppEndpoint})`);
      address = await probeSettlementAddress(svc);
      if (address) probed += 1;
    } else {
      known += 1;
    }

    if (!address) {
      console.warn(`✗ ${svc.id} — no settlement address found (probe failed; manually populate data/mpp-services.ts)`);
      skipped += 1;
      continue;
    }

    // Write to agents (so matcher catches Transfers involving this address).
    await db
      .insert(agents)
      .values({
        id: svc.id,
        label: svc.label,
        source: "curated",
        wallets: [address],
        bio: svc.bio,
        links: { ...svc.links, mpp: svc.mppEndpoint, category: svc.category },
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          label: svc.label,
          wallets: [address],
          bio: svc.bio,
          links: { ...svc.links, mpp: svc.mppEndpoint, category: svc.category },
        },
      });

    // Write to address_labels (so OLI decode layer can name this address).
    await db
      .insert(addressLabels)
      .values({
        address: address.toLowerCase(),
        label: svc.label,
        category: "mpp_service",
        source: "pellet_curated",
        notes: {
          service_id: svc.id,
          mpp_endpoint: svc.mppEndpoint,
          mpp_category: svc.category,
          probed_at: new Date().toISOString(),
        },
      })
      .onConflictDoUpdate({
        target: addressLabels.address,
        set: {
          label: svc.label,
          category: "mpp_service",
          source: "pellet_curated",
          notes: {
            service_id: svc.id,
            mpp_endpoint: svc.mppEndpoint,
            mpp_category: svc.category,
            probed_at: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
      });

    console.log(`✓ ${svc.id} → ${address}`);
  }

  console.log(`\nseeded: ${MPP_SERVICES.length - skipped} of ${MPP_SERVICES.length}`);
  console.log(`  ${probed} via probe, ${known} pre-known, ${skipped} skipped`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
