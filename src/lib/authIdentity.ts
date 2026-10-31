/**
 * JM-PROFILE-AUTH-BOUNDARY-07
 *
 * Stable identity key for temporary profile isolation.
 *
 * `iss` + `sub` is the only accepted stable combination. Email is deliberately
 * NOT used: the same email address is not a unique identity across issuers and
 * must never merge two users' temporary profile contexts.
 *
 * An authenticated session without a verified `sub` gets an explicit
 * `auth:unverified` marker. Callers must treat that as non-persistable and
 * clear temporary profile data on identity transitions.
 */
export const UNVERIFIED_AUTH_KEY = "auth:unverified";

export interface AuthIdentityClaims {
  sub?: unknown;
  iss?: unknown;
  email?: unknown;
}

export function deriveAuthProfileKey(
  isAuthenticated: boolean,
  claims: AuthIdentityClaims | null | undefined
): string | null {
  if (!isAuthenticated) return null;
  const sub = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const iss = typeof claims?.iss === "string" ? claims.iss.trim() : "";
  // Both claims are required. A missing issuer must never produce a key that
  // is treated as verified. The OIDC client validates the token issuer against
  // the configured authority; this function only trusts the validated `iss`
  // claim and does not substitute a configured value.
  if (!sub || !iss) return UNVERIFIED_AUTH_KEY;
  // JSON encoding avoids delimiter ambiguity if either value contains "|".
  return JSON.stringify([iss, sub]);
}

export function isVerifiedAuthProfileKey(key: string | null): boolean {
  return key !== null && key !== UNVERIFIED_AUTH_KEY;
}
