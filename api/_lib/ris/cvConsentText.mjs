// Server-side binding for the separate cv-storage consent text.
//
// The browser never chooses the text version or hash. The operator must
// configure exactly these values and explicitly approve the text before a
// grant is allowed; every mismatch or missing value fails closed.

export const CV_CONSENT_TEXT_VERSION = "cv-storage-consent-2026-11-08-v1";
export const CV_CONSENT_TEXT_SHA256 =
  "2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036";

export const CV_CONSENT_TEXT_STATE_APPROVED = "APPROVED";
export const CV_CONSENT_TEXT_STATE_DRAFT = "DRAFT";

function normalizeHash(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeState(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function cvConsentTextMapping(env = process.env) {
  const version = String(env.RIS_CV_CONSENT_TEXT_VERSION ?? "").trim();
  const hash = normalizeHash(env.RIS_CV_CONSENT_TEXT_SHA256);
  const state = normalizeState(env.RIS_CV_CONSENT_TEXT_STATE);

  const configured = version !== "" && hash !== "" && state !== "";
  const mapped = configured &&
    version === CV_CONSENT_TEXT_VERSION &&
    hash === CV_CONSENT_TEXT_SHA256;
  const approved = mapped && state === CV_CONSENT_TEXT_STATE_APPROVED;

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
