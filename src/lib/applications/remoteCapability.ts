import { fetchRisConsent } from "../risConsentApi";

/**
 * Server-derived capability for RIS remote application storage.
 *
 * The browser has no issuer/sub allowlist. `GET /api/ris/consents` succeeds
 * only after the BFF verified the access token, the server-side test-user
 * allowlist and the consent service configuration. Any failure keeps the app
 * in session mode.
 */
export type RisRemoteCapability = {
  /** Verified `iss + sub` profile key this capability was checked for. */
  key: string;
  allowed: boolean;
};

export type ConsentProbe = (token: string) => Promise<unknown>;

export async function checkRisRemoteApplicationAccess(
  token: string | null | undefined,
  fetchConsent: ConsentProbe = fetchRisConsent
): Promise<boolean> {
  const value = typeof token === "string" ? token.trim() : "";
  if (!value) return false;
  try {
    await fetchConsent(value);
    return true;
  } catch {
    // 401/403/503, upstream failure, network error and malformed responses all
    // fail closed to session mode.
    return false;
  }
}

/**
 * A capability is usable only for the exact identity it was checked for.
 * Prevents a previous user's result from enabling remote mode after a switch.
 */
export function isRemoteCapabilityForProfile(
  capability: RisRemoteCapability | null | undefined,
  authProfileKey: string | null | undefined
): boolean {
  if (!capability || capability.allowed !== true) return false;
  if (typeof authProfileKey !== "string" || authProfileKey.length === 0) return false;
  return capability.key === authProfileKey;
}
