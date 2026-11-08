// Jobsearch BFF for the RIS consent service (partner surface).
//
// The server owns the approved notice version: callers never send it, so a
// browser cannot invent a version. Identity comes from the verified access
// token, never from the body.

import { isAllowedTestUser, risConsentConfig, risCvConsentConfig } from "./config.mjs";
import { RisAuthError, verifyAccessToken } from "./auth.mjs";
import { RisClientError, risRequest } from "./client.mjs";
import {
  evaluateNoticeGrant,
  loadNoticeGrant,
  noticeMessage,
  noticeRejectionStatus,
} from "./consentNotice.mjs";
import {
  CONSENT_SPECIAL_CATEGORIES,
  textMessage,
  textRejectionStatus,
} from "./consentText.mjs";

function bearer(req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(String(raw));
  return match ? match[1].trim() : "";
}

function send(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(payload);
}

function fail(res, status, code, message) {
  return send(res, status, { error: message, code });
}

function queryOf(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url ?? "/", "http://localhost").searchParams.entries());
  } catch {
    return {};
  }
}

async function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return req.body ? JSON.parse(req.body) : {}; } catch { return null; }
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; if (data.length > 20000) reject(new Error("body_too_large")); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid_json")); } });
    req.on("error", () => reject(new Error("body_unreadable")));
  });
}

function upstreamFailure(res, result) {
  const status = result.status >= 400 && result.status < 600 ? result.status : 502;
  const code = typeof result.data?.code === "string" ? result.data.code
    : status === 409 ? "conflict"
    : status === 403 ? "forbidden"
    : status === 401 ? "upstream_unauthenticated"
    : "upstream_error";
  return fail(res, status, code, "RIS rejected the consent request");
}

/**
 * Fail-closed projection of the backend consent proof. Missing or malformed
 * fields become false/empty/null; the browser never invents categories.
 */
function consentProof(item) {
  const record = item && typeof item === "object" ? item : {};
  return {
    specialCategoriesConsent: record.specialCategoriesConsent === true,
    specialCategories: Array.isArray(record.specialCategories)
      ? record.specialCategories.filter((value) => typeof value === "string")
      : [],
    externalTextVersion: typeof record.externalTextVersion === "string"
      ? record.externalTextVersion : null,
    externalTextSha256: typeof record.externalTextSha256 === "string"
      ? record.externalTextSha256 : null,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const query = queryOf(req);
  const requestedPurpose = typeof query.purpose === "string" ? query.purpose.trim() : "";
  if (requestedPurpose && !["application-storage", "cv-storage"].includes(requestedPurpose)) {
    return fail(res, 422, "unknown_purpose", "Purpose is not supported");
  }
  const cfg = requestedPurpose === "cv-storage"
    ? risCvConsentConfig()
    : risConsentConfig();
  if (!cfg.enabled) return fail(res, 503, "consent_disabled", "RIS consent service is disabled");
  if (cfg.error) return fail(res, 503, "missing_config", "RIS consent service is not configured");

  const token = bearer(req);
  if (!token) return fail(res, 401, "unauthenticated", "Authentication is required");

  let identity;
  try {
    identity = await verifyAccessToken(token, cfg);
  } catch (err) {
    if (err instanceof RisAuthError && err.code === "jwks_unavailable") {
      return fail(res, 503, "unavailable", "Authentication service is unavailable");
    }
    return fail(res, 401, "invalid_token", "Authentication is invalid");
  }
  if (!isAllowedTestUser(identity, cfg)) {
    return fail(res, 403, "test_user_not_allowed", "This test user is not enabled for RIS consent storage");
  }

  const action = typeof query.action === "string" ? query.action : "";

  try {
    if (req.method === "GET" && action === "history") {
      const purpose = String(query.purpose ?? cfg.purpose);
      const limit = Math.min(Math.max(Number.parseInt(query.limit ?? "50", 10) || 50, 1), 100);
      const result = await risRequest(
        { ...cfg, path: cfg.path },
        token, "GET",
        `${cfg.path}/history?purpose=${encodeURIComponent(purpose)}&limit=${limit}`,
      );
      if (result.status >= 400) return upstreamFailure(res, result);
      return send(res, 200, result.data);
    }
    if (req.method === "GET") {
      const purpose = String(query.purpose ?? cfg.purpose);
      const result = await risRequest(
        { ...cfg, path: cfg.path },
        token, "GET",
        `${cfg.path}?purpose=${encodeURIComponent(purpose)}`,
      );
      if (result.status >= 400) return upstreamFailure(res, result);
      const item = (result.data?.items ?? []).find((x) => x.purpose === purpose) ?? null;
      const notice = evaluateNoticeGrant(result.data, {
        noticeVersion: cfg.noticeVersion,
        purpose,
      });
      const proof = consentProof(item);
      return send(res, 200, {
        consent: item ? { ...item, ...proof } : null,
        ...proof,
        noticeVersion: notice.noticeVersion,
        noticeState: notice.noticeState,
        noticeApproved: notice.noticeApproved,
        acceptedForNewGrant: notice.acceptedForNewGrant,
        grantAllowed: notice.grantAllowed && cfg.textApproved === true,
        noticeReason: notice.noticeReason,
        textVersion: cfg.textVersion ?? null,
        textHash: cfg.textHash ?? null,
        textState: cfg.textState ?? null,
        textMapped: cfg.textMapped === true,
        textApproved: cfg.textApproved === true,
        textReason: cfg.textReason ?? null,
      });
    }
    if (req.method === "POST") {
      const body = await bodyOf(req);
      if (!body || typeof body !== "object") return fail(res, 422, "invalid_body", "Request body is invalid");
      const purpose = String(body.purpose ?? cfg.purpose);
      if (purpose !== cfg.purpose) return fail(res, 422, "unknown_purpose", "Purpose is not supported");
      if (action === "withdraw") {
        const result = await risRequest(
          { ...cfg, path: cfg.path }, token, "POST",
          `${cfg.path}/withdraw`, { purpose },
        );
        if (result.status >= 400) return upstreamFailure(res, result);
        return send(res, 200, result.data);
      }
      const noticeVersion = cfg.noticeVersion;
      if (!noticeVersion) {
        return fail(res, 503, "notice_version_not_mapped",
          "The consent notice version has not been approved for this app yet");
      }
      // Re-load the live catalogue immediately before writing. A configured
      // version alone never authorizes a grant.
      const notice = await loadNoticeGrant(cfg, token, { purpose });
      if (!notice.ok) {
        return fail(res, notice.status, notice.code,
          "The consent notice state could not be verified; no grant was written");
      }
      if (!notice.evaluation.grantAllowed) {
        const reason = notice.evaluation.noticeReason ?? "notice_not_active";
        return fail(res, noticeRejectionStatus(reason), reason, noticeMessage(reason));
      }
      // The text mapping is a separate, server-owned approval. Re-check it
      // before writing; the browser does not send a version or hash.
      if (cfg.textApproved !== true) {
        const reason = cfg.textReason ?? "consent_text_not_approved";
        return fail(res, textRejectionStatus(reason), reason, textMessage(reason));
      }
      // The Art. 9 consent is the user's explicit decision. Only the boolean
      // comes from the browser; text identity and category list stay
      // server-owned.
      if (body.specialCategoriesConsent !== true) {
        return fail(res, 422, "special_categories_consent_required",
          "Explicit consent for special categories is required");
      }
      const result = await risRequest(
        { ...cfg, path: cfg.path }, token, "POST",
        cfg.path, {
          purpose,
          noticeVersion,
          specialCategoriesConsent: true,
          specialCategories: [...CONSENT_SPECIAL_CATEGORIES],
          externalTextVersion: cfg.textVersion,
          externalTextSha256: cfg.textHash,
        },
      );
      if (result.status >= 400) return upstreamFailure(res, result);
      return send(res, 200, result.data);
    }
    return fail(res, 405, "method_not_allowed", "Method not allowed");
  } catch (err) {
    if (err instanceof RisClientError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return fail(res, status, err.code ?? "upstream_error", err.message);
    }
    return fail(res, 502, "upstream_error", "RIS returned an unexpected response");
  }
}
