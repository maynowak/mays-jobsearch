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
  if (!sub) return UNVERIFIED_AUTH_KEY;
  const iss = typeof claims?.iss === "string" ? claims.iss.trim() : "";
  return `iss:${iss}|sub:${sub}`;
}

export function isVerifiedAuthProfileKey(key: string | null): boolean {
  return key !== null && key !== UNVERIFIED_AUTH_KEY;
}
