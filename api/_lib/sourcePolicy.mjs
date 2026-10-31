/**
 * JM-COOKIELESS-GUEST-MODEL-A-CUTOVER-01
 * JM-GUEST-MODEL-A-APIFY-EXCEPTION-REPAIR-01
 * JM-GUEST-MODEL-A-RELEASE-GATE-FIX-01
 *
 * Server-side source access policy for public guest requests. A source is only
 * allowed when BOTH its approved identity and its expected adapter/provider
 * type match. Model A free sources and the explicitly approved Arbeitsagentur
 * Apify adapter are allowed; TheirStack, JobsPipe and every other paid source
 * stay blocked.
 */

/** Approved free source IDs with their required provider type. */
export const GUEST_FREE_SOURCE_PROVIDERS = new Map([
  ["arbeitnow", "direct-api"],
  ["greenhouse", "ats"],
  ["adzuna", "job-api"],
]);

/** Backward-compatible ID list (identity only; provider is enforced below). */
export const GUEST_FREE_SOURCE_IDS = new Set(GUEST_FREE_SOURCE_PROVIDERS.keys());

/**
 * Explicit product exception: Arbeitsagentur via the existing Apify adapter.
 * The provider assertion prevents an identically named source with a different
 * billing class from being treated as the approved actor.
 */
export const GUEST_APIFY_SOURCE_PROVIDERS = new Map([["arbeitsagentur", "apify"]]);

/** Backward-compatible ID list (identity only; provider is enforced below). */
export const GUEST_APIFY_SOURCE_IDS = new Set(GUEST_APIFY_SOURCE_PROVIDERS.keys());

// Explicit free public-ATS adapter prefixes. These are only accepted together
// with provider === "ats"; do not allow arbitrary future `provider === "ats"`
// or `provider === "direct-api"` sources implicitly.
const GUEST_PUBLIC_ATS_PREFIXES = [
  "greenhouse:",
  "lever:",
  "ashby:",
  "workable:",
  "recruitee:",
  "personio:",
];

export function isGuestAllowedSource(source) {
  if (!source || typeof source.id !== "string" || typeof source.provider !== "string") {
    return false;
  }

  const freeProvider = GUEST_FREE_SOURCE_PROVIDERS.get(source.id);
  if (freeProvider !== undefined) return source.provider === freeProvider;

  const apifyProvider = GUEST_APIFY_SOURCE_PROVIDERS.get(source.id);
  if (apifyProvider !== undefined) return source.provider === apifyProvider;

  if (source.provider !== "ats") return false;
  return GUEST_PUBLIC_ATS_PREFIXES.some((prefix) => source.id.startsWith(prefix));
}

export function guestAllowedSources(sources) {
  return sources.filter(isGuestAllowedSource);
}
