// Server-side gate for durable application-storage consent grants.
//
// A configured notice version (RIS_CONSENT_NOTICE_VERSION) is only a mapping,
// not an approval. RIS publishes the notice catalogue on the partner consent
// endpoint. A grant is allowed only when the catalogue entry for the configured
// version is present, its state is APPROVED or ACTIVE (RIS GRANTABLE_NOTICE_STATES),
// RIS marks it approved and RIS marks it accepted for new grants. Every other
// case fails closed.

import { RisClientError, risRequest } from "./client.mjs";

const ACTIVE_STATES = new Set(["APPROVED", "ACTIVE"]);
const UNKNOWN_STATE = "UNKNOWN";

function normalizeState(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEntry(entry, purpose) {
  if (!entry || typeof entry !== "object") return null;
  const noticeVersion = typeof entry.noticeVersion === "string" ? entry.noticeVersion.trim() : "";
  if (!noticeVersion) return null;
  const entryPurpose = typeof entry.purpose === "string" ? entry.purpose.trim() : "";
  if (entryPurpose && purpose && entryPurpose !== purpose) return null;
  return {
    noticeVersion,
    noticeState: normalizeState(entry.noticeState) || UNKNOWN_STATE,
    noticeApproved: entry.noticeApproved === true,
    acceptedForNewGrant: entry.acceptedForNewGrant === true,
  };
}

/**
 * Evaluates the catalogue from `GET /v1/partner/me/consents` against the
 * server-configured notice version. Pure and fail-closed: any missing or
 * malformed input yields `grantAllowed: false`.
 *
 * Returned shape is safe for the browser: it never contains legal approval
 * references or credentials.
 */
export function evaluateNoticeGrant(data, { noticeVersion, purpose } = {}) {
  const version = typeof noticeVersion === "string" ? noticeVersion.trim() : "";
  const base = {
    noticeVersion: version || null,
    noticeState: UNKNOWN_STATE,
    noticeApproved: false,
    acceptedForNewGrant: false,
    grantAllowed: false,
    noticeReason: null,
  };

  if (!version) return { ...base, noticeReason: "notice_version_not_mapped" };

  const catalog = data && typeof data === "object" ? data.catalog : null;
  if (!Array.isArray(catalog)) return { ...base, noticeReason: "notice_catalog_invalid" };

  const matches = catalog
    .map((entry) => normalizeEntry(entry, purpose))
    .filter((entry) => entry && entry.noticeVersion === version);

  if (matches.length === 0) return { ...base, noticeReason: "notice_version_unknown" };

  const entry = matches[0];
  if (matches.length > 1) {
    const consistent = matches.every((candidate) =>
      candidate.noticeState === entry.noticeState &&
      candidate.noticeApproved === entry.noticeApproved &&
      candidate.acceptedForNewGrant === entry.acceptedForNewGrant);
    if (!consistent) {
      return { ...base, noticeState: entry.noticeState, noticeReason: "notice_catalog_invalid" };
    }
  }
  const evaluated = {
    noticeVersion: version,
    noticeState: entry.noticeState,
    noticeApproved: entry.noticeApproved,
    acceptedForNewGrant: entry.acceptedForNewGrant,
    grantAllowed: false,
    noticeReason: null,
  };

  if (!ACTIVE_STATES.has(entry.noticeState.toUpperCase())) {
    return { ...evaluated, noticeReason: "notice_not_active" };
  }
  if (!entry.noticeApproved) return { ...evaluated, noticeReason: "notice_not_approved" };
  if (!entry.acceptedForNewGrant) return { ...evaluated, noticeReason: "notice_not_accepted" };

  return { ...evaluated, grantAllowed: true };
}

/**
 * Loads the live consent catalogue and evaluates it immediately before use.
 * Returns `{ ok: true, evaluation }` when RIS answered, otherwise
 * `{ ok: false, status, code, evaluation }` with a fail-closed evaluation.
 */
export async function loadNoticeGrant(cfg, token, { purpose = cfg?.purpose, fetchImpl } = {}) {
  const fallback = evaluateNoticeGrant(null, { noticeVersion: cfg?.noticeVersion, purpose });
  let result;
  try {
    result = await risRequest(
      { ...cfg, path: cfg.path },
      token, "GET",
      `${cfg.path}?purpose=${encodeURIComponent(String(purpose))}`,
      undefined,
      fetchImpl,
    );
  } catch (err) {
    const status = err instanceof RisClientError && err.status >= 400 && err.status < 600 ? err.status : 503;
    return { ok: false, status, code: "notice_catalog_unavailable", evaluation: fallback };
  }

  if (!result || !Number.isInteger(result.status) || result.status < 200 || result.status >= 300) {
    const status = result && result.status >= 400 && result.status < 600 ? result.status : 502;
    return { ok: false, status, code: "notice_catalog_unavailable", evaluation: fallback };
  }

  return {
    ok: true,
    evaluation: evaluateNoticeGrant(result.data, { noticeVersion: cfg?.noticeVersion, purpose }),
  };
}

/**
 * Maps a blocked evaluation to an HTTP status. Only notice-state blocks are
 * client-visible 4xx; unavailable/invalid catalogues stay 5xx.
 */
export function noticeRejectionStatus(reason) {
  if (
    reason === "notice_version_unknown" ||
    reason === "notice_not_active" ||
    reason === "notice_not_approved" ||
    reason === "notice_not_accepted"
  ) {
    return 409;
  }
  if (reason === "notice_version_not_mapped") return 503;
  return 503;
}

export function noticeMessage(reason) {
  if (reason === "notice_version_not_mapped") {
    return "The consent notice version has not been approved for this app yet";
  }
  if (reason === "notice_version_unknown") {
    return "The configured consent notice version is not published by RIS";
  }
  if (reason === "notice_not_active") {
    return "The consent notice is not in a grantable state (APPROVED or ACTIVE)";
  }
  if (reason === "notice_not_approved") {
    return "The consent notice is not legally approved yet";
  }
  if (reason === "notice_not_accepted") {
    return "The consent notice is not open for new grants";
  }
  return "The consent notice catalogue is unavailable";
}
