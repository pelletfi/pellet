export interface MppOffer {
  amount: string | null;
  currency: string;
  description?: string;
  intent: "charge" | "session";
  method: string;
}

export interface MppEndpoint {
  path: string;
  httpMethod: string;
  summary?: string;
  description?: string;
  offers: MppOffer[];
  free?: boolean;
}

export interface MppServiceInfo {
  categories?: string[];
  docs?: {
    homepage?: string;
    apiReference?: string;
    llms?: string;
  };
}

export interface MppService {
  id: string;
  name: string;
  description?: string;
  version?: string;
  url: string;
  serviceInfo?: MppServiceInfo;
  endpoints: MppEndpoint[];
  fetchedAt?: string;
}

export interface MppDirectoryEntry {
  id: string;
  name: string;
  serviceUrl: string;
  description: string;
  categories: string[];
}

export interface MppPreset {
  id: string;
  name: string;
  description: string;
  serviceIds: string[];
  defaultBudget: string;
}
