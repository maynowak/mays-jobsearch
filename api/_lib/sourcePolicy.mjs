/**
 * JM-COOKIELESS-GUEST-MODEL-A-CUTOVER-01
 * JM-GUEST-MODEL-A-APIFY-EXCEPTION-REPAIR-01
 *
 * Server-side source access policy. Model A: guests may use free sources and
 * the explicitly approved Arbeitsagentur Apify adapter. TheirStack and JobsPipe
 * remain blocked for public guest requests.
 */
export const GUEST_FREE_SOURCE_IDS = new Set(["arbeitnow", "greenhouse", "adzuna"]);
/** Explicit product exception: Arbeitsagentur via the existing Apify adapter. */
export const GUEST_APIFY_SOURCE_IDS = new Set(["arbeitsagentur"]);

export function isGuestAllowedSource(source) {
  if (!source) return false;
  if (GUEST_FREE_SOURCE_IDS.has(source.id)) return true;
  if (GUEST_APIFY_SOURCE_IDS.has(source.id)) return true;
  // Public ATS feeds (Greenhouse/Lever/Personio/... via factory) and the
  // direct Arbeitnow API are free. Adzuna is explicitly listed above.
  return source.provider === "ats" || source.provider === "direct-api";
}

export function guestAllowedSources(sources) {
  return sources.filter(isGuestAllowedSource);
}

/**
 * Paid-source access for public guests. The only approved paid path is the
 * Arbeitsagentur Apify adapter; TheirStack/JobsPipe and unknown paid sources
 * stay blocked. No request-controlled field may override this.
 */
export function guestPaidSourceAllowed(sourceId) {
  return GUEST_APIFY_SOURCE_IDS.has(sourceId);
}
