/**
 * JM-COOKIELESS-GUEST-MODEL-A-CUTOVER-01
 *
 * Server-side source access policy. Model A: guests may only use sources that
 * are free to operate. Paid sources stay in the registry for a future verified
 * registered-user path, but are never selected by a public guest request.
 */
export const GUEST_FREE_SOURCE_IDS = new Set(["arbeitnow", "greenhouse", "adzuna"]);

export function isGuestAllowedSource(source) {
  if (!source) return false;
  if (GUEST_FREE_SOURCE_IDS.has(source.id)) return true;
  // Public ATS feeds (Greenhouse/Lever/Personio/... via factory) and the
  // direct Arbeitnow API are free. Adzuna is explicitly listed above.
  return source.provider === "ats" || source.provider === "direct-api";
}

export function guestAllowedSources(sources) {
  return sources.filter(isGuestAllowedSource);
}

/** Paid sources are always blocked for public guest requests in Model A. */
export function paidSourcesAllowedForGuest() {
  return false;
}
