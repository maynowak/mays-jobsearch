// Server-side binding between the Jobsearch consent text and the BFF gate.
//
// The version and SHA-256 below are the canonical identity of
// `src/lib/applicationStorageConsent.ts`. The browser cannot choose them and
// the operator must configure exactly these values through environment
// variables before a grant is allowed:
//
//   RIS_CONSENT_TEXT_VERSION = application-storage-consent-2026-11-07-v3
//   RIS_CONSENT_TEXT_SHA256  = <canonical SHA-256>
//   RIS_CONSENT_TEXT_STATE   = APPROVED  (only after operator/legal approval)
//
// `DRAFT`, an absent mapping or a mismatching version/hash all fail closed.
// `src/lib/storageConsent.test.ts` asserts that this module and the client
// module agree.

export const CONSENT_TEXT_VERSION = "application-storage-consent-2026-11-07-v3";
export const CONSENT_TEXT_SHA256 =
  "696f9e66d8098b2dce56a93418ba598145b669934662e2b52d9a332731517668";

/** Server-owned Art. 9 category list sent to RIS with an explicit consent. */
export const CONSENT_SPECIAL_CATEGORIES = Object.freeze([
  "health",
  "religious_or_philosophical_beliefs",
  "trade_union_membership",
  "political_opinions",
  "sexual_orientation",
  "biometric_data",
  "genetic_data",
  "racial_or_ethnic_origin",
]);

export const CONSENT_TEXT_STATE_APPROVED = "APPROVED";
export const CONSENT_TEXT_STATE_DRAFT = "DRAFT";

function normalizeHash(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeState(value) {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * Evaluates the configured text mapping. Pure and fail-closed: the mapping is
 * approved only when the version and hash match the canonical identity and the
 * operator explicitly set the state to APPROVED.
 */
export function consentTextMapping(env = process.env) {
  const version = String(env.RIS_CONSENT_TEXT_VERSION ?? "").trim();
  const hash = normalizeHash(env.RIS_CONSENT_TEXT_SHA256);
  const state = normalizeState(env.RIS_CONSENT_TEXT_STATE);

  const configured = version !== "" && hash !== "" && state !== "";
  const mapped = configured && version === CONSENT_TEXT_VERSION && hash === CONSENT_TEXT_SHA256;
  const approved = mapped && state === CONSENT_TEXT_STATE_APPROVED;

  let reason = null;
  if (!configured) reason = "consent_text_not_configured";
  else if (!mapped) reason = "consent_text_mismatch";
  else if (!approved) reason = "consent_text_not_approved";

  return {
    version: version || null,
    hash: hash || null,
    state: state || null,
    configured,
    mapped,
    approved,
    reason,
  };
}

export function textRejectionStatus(reason) {
  if (reason === "consent_text_not_approved") return 409;
  return 503;
}

export function textMessage(reason) {
  if (reason === "consent_text_not_configured") {
    return "The consent text mapping is not configured for this app yet";
  }
  if (reason === "consent_text_mismatch") {
    return "The configured consent text version or hash does not match this app's canonical text";
  }
  if (reason === "consent_text_not_approved") {
    return "The consent text is not approved for new grants yet";
  }
  return "The consent text mapping could not be verified";
}
