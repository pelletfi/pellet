/**
 * Token icon resolver for Tempo.
 * Uses the official Tempo token list registry for icons.
 */

const TOKENLIST_ICON_URL = "https://tokenlist.tempo.xyz/icon/4217";

/** Get the icon URL for a token on Tempo by address. */
export function getTokenIconUrl(address: string): string {
  return `${TOKENLIST_ICON_URL}/${address.toLowerCase()}`;
}
