import { consentTextMapping } from "./consentText.mjs";
import { cvConsentTextMapping } from "./cvConsentText.mjs";
import { searchProfileConsentTextMapping } from "./searchProfileConsentText.mjs";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PATH = "/v1/partner/me/applications";
const CONSENT_PATH = "/v1/partner/me/consents";
const CONSENT_PURPOSE = "application-storage";
const CV_PATH = "/v1/partner/me/cvs";
const CV_CONSENT_PURPOSE = "cv-storage";
const SEARCH_PROFILE_PATH = "/v1/partner/me";
const SEARCH_PROFILE_CONSENT_PURPOSE = "search-profile-storage";

function httpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function parseTestUserAllowlist(value) {
  const allowed = new Set();
  for (const raw of String(value ?? "").split(/[\n,]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const separator = entry.indexOf("|");
    if (separator <= 0) continue;
    const issuer = entry.slice(0, separator).trim().replace(/\/+$/, "");
    const subject = entry.slice(separator + 1).trim();
    if (!issuer || !subject) continue;
    allowed.add(`${issuer}|${subject}`);
  }
  return allowed;
}

export function isAllowedTestUser(identity, cfg) {
  if (!cfg?.testUserAllowlist || cfg.testUserAllowlist.size === 0) return false;
  const issuer = String(identity?.issuer ?? "").trim().replace(/\/+$/, "");
  const subject = String(identity?.sub ?? "").trim();
  if (!issuer || !subject) return false;
  return cfg.testUserAllowlist.has(`${issuer}|${subject}`);
}

/**
 * Shared server-only connection data for the RIS partner surface. Both the
 * application-storage BFF and the consent BFF reuse exactly these values.
 */
function sharedRisConfig(env) {
  const base = httpsUrl(env.RIS_API_BASE_URL);
  const issuer = httpsUrl(env.RIS_COGNITO_ISSUER);
  const credential = String(
    env.RIS_PARTNER_CREDENTIAL ?? env.RIS_API_KEY ?? env.RIS_API_CREDENTIAL ?? ""
  ).trim();
  const clientId = String(env.RIS_COGNITO_CLIENT_ID ?? "").trim();

  if (!base || !issuer || !credential || !clientId) return null;

  return {
    baseUrl: base.toString().replace(/\/+$/, ""),
    issuer: issuer.toString().replace(/\/+$/, ""),
    clientId,
    credential,
    testUserAllowlist: parseTestUserAllowlist(env.RIS_TEST_USER_ALLOWLIST),
    timeoutMs: Number(env.RIS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Application-storage BFF configuration. Disabled unless
 * RIS_APPLICATION_STORAGE_ENABLED is explicitly true.
 */
export function risConfig(env = process.env) {
  const enabled = String(env.RIS_APPLICATION_STORAGE_ENABLED ?? "").toLowerCase() === "true";
  if (!enabled) {
    return { enabled: false, error: "ris_disabled" };
  }

  const shared = sharedRisConfig(env);
  if (!shared) {
    return { enabled: true, error: "missing_config" };
  }

  return {
    enabled: true,
    ...shared,
    path: DEFAULT_PATH,
  };
}

/**
 * Consent BFF configuration. It has its own activation switch and does not
 * depend on RIS_APPLICATION_STORAGE_ENABLED. The notice version is owned by
 * the server (env), never by the client.
 */
/** Durable CV storage BFF configuration. Disabled unless explicitly enabled. */
export function risCvConfig(env = process.env) {
  const enabled = String(env.RIS_CV_STORAGE_ENABLED ?? "").toLowerCase() === "true";
  if (!enabled) {
    return { enabled: false, error: "cv_storage_disabled" };
  }

  const shared = sharedRisConfig(env);
  if (!shared) {
    return { enabled: true, error: "missing_config" };
  }

  return {
    enabled: true,
    ...shared,
    path: CV_PATH,
  };
}

/**
 * Separate cv-storage consent configuration. It reuses the consent service
 * connection but has its own purpose, notice version and text mapping.
 */
export function risCvConsentConfig(env = process.env) {
  const enabled = String(env.RIS_CONSENT_SERVICE_ENABLED ?? "").toLowerCase() === "true";
  const noticeVersion = String(env.RIS_CV_CONSENT_NOTICE_VERSION ?? "").trim();
  const text = cvConsentTextMapping(env);
  const consent = {
    path: CONSENT_PATH,
    purpose: CV_CONSENT_PURPOSE,
    noticeVersion: noticeVersion || null,
    textVersion: text.version,
    textHash: text.hash,
    textState: text.state,
    textMapped: text.mapped,
    textApproved: text.approved,
    textReason: text.reason,
  };

  if (!enabled) {
    return { enabled: false, error: "consent_disabled", ...consent };
  }
  const shared = sharedRisConfig(env);
  if (!shared) {
    return { enabled: true, error: "missing_config", ...consent };
  }
  return { enabled: true, ...shared, ...consent };
}

export function risConsentConfig(env = process.env) {
  const enabled = String(env.RIS_CONSENT_SERVICE_ENABLED ?? "").toLowerCase() === "true";
  const noticeVersion = String(env.RIS_CONSENT_NOTICE_VERSION ?? "").trim();
  const text = consentTextMapping(env);
  const consent = {
    path: CONSENT_PATH,
    purpose: CONSENT_PURPOSE,
    noticeVersion: noticeVersion || null,
    textVersion: text.version,
    textHash: text.hash,
    textState: text.state,
    textMapped: text.mapped,
    textApproved: text.approved,
    textReason: text.reason,
  };

  if (!enabled) {
    return { enabled: false, error: "consent_disabled", ...consent };
  }

  const shared = sharedRisConfig(env);
  if (!shared) {
    return { enabled: true, error: "missing_config", ...consent };
  }

  return { enabled: true, ...shared, ...consent };
}

/**
 * Durable search-profile BFF configuration. Disabled unless explicitly
 * enabled. The BFF only builds paths; the RIS server still owns consent,
 * identity, versioning and capacity.
 */
export function risSearchProfilesConfig(env = process.env) {
  const enabled = String(env.RIS_SEARCH_PROFILE_STORAGE_ENABLED ?? "")
    .toLowerCase() === "true";
  if (!enabled) {
    return { enabled: false, error: "search_profile_storage_disabled" };
  }

  const shared = sharedRisConfig(env);
  if (!shared) {
    return { enabled: true, error: "missing_config" };
  }

  return {
    enabled: true,
    ...shared,
    path: SEARCH_PROFILE_PATH,
  };
}

/**
 * Separate search-profile-storage consent configuration. It reuses the
 * consent service connection but has its own purpose, notice version and text
 * mapping. A DRAFT text is never approved by this function.
 */
export function risSearchProfileConsentConfig(env = process.env) {
  const enabled = String(env.RIS_CONSENT_SERVICE_ENABLED ?? "").toLowerCase() === "true";
  const noticeVersion = String(env.RIS_SEARCH_PROFILE_CONSENT_NOTICE_VERSION ?? "").trim();
  const text = searchProfileConsentTextMapping(env);
  const consent = {
    path: CONSENT_PATH,
    purpose: SEARCH_PROFILE_CONSENT_PURPOSE,
    noticeVersion: noticeVersion || null,
    textVersion: text.version,
    textHash: text.hash,
    textState: text.state,
    textMapped: text.mapped,
    textApproved: text.approved,
    syntheticTextAllowed: text.syntheticDraft,
    textReason: text.reason,
  };

  if (!enabled) {
    return { enabled: false, error: "consent_disabled", ...consent };
  }
  const shared = sharedRisConfig(env);
  if (!shared) {
    return { enabled: true, error: "missing_config", ...consent };
  }
  return { enabled: true, ...shared, ...consent };
}
