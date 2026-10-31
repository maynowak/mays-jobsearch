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

// Explicit free public-ATS adapter prefixes. Do not allow arbitrary future
// `provider === "ats"` / `provider === "direct-api"` sources implicitly.
const GUEST_PUBLIC_ATS_PREFIXES = [
  "greenhouse:",
  "lever:",
  "ashby:",
  "workable:",
  "recruitee:",
  "personio:",
];

export function isGuestAllowedSource(source) {
  if (!source) return false;
  if (GUEST_FREE_SOURCE_IDS.has(source.id)) return true;
  if (GUEST_APIFY_SOURCE_IDS.has(source.id)) return true;
  return GUEST_PUBLIC_ATS_PREFIXES.some((prefix) => String(source.id).startsWith(prefix));
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
