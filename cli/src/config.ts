// Local config — bearer token + session metadata persist to ~/.pellet/config.json.
// Permissions are forced to 0600 so the bearer isn't world-readable.

import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type StoredSession = {
  bearer: string;
  baseUrl: string;
  label: string | null;
  spendCapWei: string;
  perCallCapWei: string;
  expiresAt: string;
  pairedAt: string;
};

const CONFIG_DIR = join(homedir(), ".pellet");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function defaultBaseUrl(): string {
  // Note: must be `www.` apex. The bare apex 307s to www, and Node's
  // fetch (and most clients) strip the Authorization header across the
  // redirect — every chat / balance / pay call would 401. Pin to www.
  return process.env.PELLET_BASE_URL ?? "https://www.pellet.network";
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function writeSession(s: StoredSession): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(s, null, 2), "utf8");
  await chmod(CONFIG_PATH, 0o600);
}

export async function clearSession(): Promise<void> {
  await writeFile(CONFIG_PATH, "", "utf8").catch(() => {});
}
