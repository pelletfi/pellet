import type { MppEndpoint, MppOffer, MppService, MppServiceInfo } from "./types";

interface OpenApiDoc {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  "x-service-info"?: MppServiceInfo;
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  "x-payment-info"?: {
    offers?: MppOffer[];
    amount?: string;
    currency?: string;
    description?: string;
    intent?: string;
    method?: string;
    authMode?: string;
  };
}

function normalizeOffers(info: OpenApiOperation["x-payment-info"]): MppOffer[] {
  if (!info) return [];
  if (info.authMode === "none") return [];

  if (info.offers && Array.isArray(info.offers)) {
    return info.offers;
  }

  if (info.amount && info.currency && info.method) {
    return [
      {
        amount: info.amount,
        currency: info.currency,
        description: info.description,
        intent: (info.intent as MppOffer["intent"]) || "charge",
        method: info.method,
      },
    ];
  }

  return [];
}

export function parseDiscoveryDoc(
  id: string,
  url: string,
  doc: OpenApiDoc,
): MppService {
  const endpoints: MppEndpoint[] = [];

  if (doc.paths) {
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [httpMethod, operation] of Object.entries(methods)) {
        if (httpMethod.startsWith("x-") || httpMethod === "parameters") continue;

        const paymentInfo = operation["x-payment-info"];
        const offers = normalizeOffers(paymentInfo);
        const free = paymentInfo?.authMode === "none";

        endpoints.push({
          path,
          httpMethod: httpMethod.toUpperCase(),
          summary: operation.summary,
          description: operation.description,
          offers,
          free: free || undefined,
        });
      }
    }
  }

  return {
    id,
    name: doc.info?.title || id,
    description: doc.info?.description,
    version: doc.info?.version,
    url,
    serviceInfo: doc["x-service-info"],
    endpoints,
    fetchedAt: new Date().toISOString(),
  };
}
