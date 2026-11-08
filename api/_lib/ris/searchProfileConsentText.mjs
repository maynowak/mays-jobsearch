// Server-side binding for the separate search-profile-storage consent text.
//
// The browser never chooses the text version or hash. The operator must
// configure exactly these values and approve the text before a real grant is
// allowed. A DRAFT may only be used by the explicit local synthetic test hook
// below; it never activates storage for real users.

export const SEARCH_PROFILE_CONSENT_TEXT_VERSION =
  "search-profile-storage-consent-2026-11-08-v2";
export const SEARCH_PROFILE_CONSENT_TEXT_SHA256 =
  "75919c8bc219c938bdd2452a8bf02955997d1336ba2ca716bc691dd54eaa7ef6";

export const SEARCH_PROFILE_CONSENT_TEXT_STATE_APPROVED = "APPROVED";
export const SEARCH_PROFILE_CONSENT_TEXT_STATE_DRAFT = "DRAFT";

function normalizeHash(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeState(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function searchProfileConsentTextMapping(env = process.env) {
  const version = String(env.RIS_SEARCH_PROFILE_CONSENT_TEXT_VERSION ?? "").trim();
  const hash = normalizeHash(env.RIS_SEARCH_PROFILE_CONSENT_TEXT_SHA256);
  const state = normalizeState(env.RIS_SEARCH_PROFILE_CONSENT_TEXT_STATE);

  const configured = version !== "" && hash !== "" && state !== "";
  const mapped = configured &&
    version === SEARCH_PROFILE_CONSENT_TEXT_VERSION &&
    hash === SEARCH_PROFILE_CONSENT_TEXT_SHA256;
  const approved = mapped && state === SEARCH_PROFILE_CONSENT_TEXT_STATE_APPROVED;
  const synthetic = String(env.RIS_SEARCH_PROFILE_CONSENT_SYNTHETIC ?? "")
    .toLowerCase() === "true";
  const syntheticDraft = synthetic && mapped &&
    state === SEARCH_PROFILE_CONSENT_TEXT_STATE_DRAFT;

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
    syntheticDraft,
    reason,
  };
}
