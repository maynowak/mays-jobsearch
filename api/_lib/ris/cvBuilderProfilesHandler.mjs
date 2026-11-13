// Jobsearch BFF for durable structured CV-builder profiles.
//
// The browser never supplies tenant/user identity, an owner key or a RIS
// credential. RIS remains authoritative for the profile id, version, consent,
// idempotency and capacity. This adapter only maps a fixed, validated route to
// the fixed `/v1/partner/me/cv-builder-profiles` upstream namespace.

import { isAllowedTestUser, risCvBuilderProfilesConfig } from "./config.mjs";
import { RisAuthError, verifyAccessToken } from "./auth.mjs";
import { RisClientError, risRequest } from "./client.mjs";

const MAX_BODY_BYTES = 300000;
const PROFILE_ID = /^cvp-[A-Za-z0-9-]{8,80}$/;
const IF_MATCH = /^"v[1-9][0-9]*"$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._~+/=-]{16,128}$/;
const FORBIDDEN_FIELDS = new Set([
  "ownerKey", "userId", "tenantId", "partnerApplicationId", "issuer",
  "profileId", "version", "createdAt", "updatedAt",
]);

function bearer(req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(String(raw));
  return match ? match[1].trim() : "";
}

function headerOf(req, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (key.toLowerCase() === wanted) return String(value ?? "").trim();
  }
  return "";
}

function send(res, status, payload, etag = null) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (etag) res.setHeader("ETag", etag);
  if (status === 204) return res.status(204).end();
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
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    const bytes = Buffer.byteLength(JSON.stringify(req.body));
    if (bytes > MAX_BODY_BYTES) throw new Error("body_too_large");
    return req.body;
  }
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) throw new Error("body_too_large");
    try { return req.body ? JSON.parse(req.body) : {}; } catch { return null; }
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (Buffer.byteLength(data) > MAX_BODY_BYTES) reject(new Error("body_too_large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid_json")); }
    });
    req.on("error", () => reject(new Error("body_unreadable")));
  });
}

function profileIdOf(value) {
  if (typeof value !== "string" || !PROFILE_ID.test(value)) {
    throw new RisClientError("invalid_profile_id", 422, "profileId is invalid");
  }
  return value;
}

function assertNoClientIdentity(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RisClientError("invalid_body", 422, "Request body is invalid");
  }
  if (Object.keys(body).some((key) => FORBIDDEN_FIELDS.has(key))) {
    throw new RisClientError("client_identity_forbidden", 422,
      "Client-supplied owner or server fields are not accepted");
  }
}

function upstreamFailure(res, result) {
  const status = result.status >= 400 && result.status < 600 ? result.status : 502;
  const code = typeof result.data?.code === "string" ? result.data.code
    : status === 409 ? "conflict"
    : status === 403 ? "forbidden"
    : status === 401 ? "upstream_unauthenticated"
    : status === 404 ? "not_found"
    : status === 413 ? "payload_too_large"
    : status === 422 ? "validation_error"
    : status === 428 ? "precondition_required"
    : "upstream_error";
  return fail(res, status, code, "RIS rejected the structured CV request");
}

function ok(res, result, fallbackStatus = 200) {
  if (result.status >= 400) return upstreamFailure(res, result);
  const status = result.status >= 200 && result.status < 300 ? result.status : fallbackStatus;
  if (status === 204) return send(res, 204, null, result.etag);
  return send(res, status, result.data, result.etag);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const cfg = risCvBuilderProfilesConfig();
  if (!cfg.enabled) {
    return fail(res, 503, "cv_builder_profile_storage_disabled",
      "RIS structured CV profile storage is disabled");
  }
  if (cfg.error) return fail(res, 503, "missing_config",
    "RIS structured CV profile storage is not configured");

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
    return fail(res, 403, "test_user_not_allowed",
      "This user is not enabled for RIS structured CV storage");
  }

  const query = queryOf(req);
  const id = typeof query.id === "string" ? query.id : "";
  const action = typeof query.action === "string" ? query.action : "";
  const method = req.method;

  try {
    if (method === "GET" && action && action !== "export") {
      return fail(res, 422, "invalid_action", "action is invalid");
    }
    if (method === "GET" && action === "export" && !id) {
      return fail(res, 422, "invalid_request", "id is required for export");
    }
    if (method === "GET") {
      if (id) {
        const profileId = profileIdOf(id);
        const path = action === "export"
          ? `${cfg.path}/${profileId}/export`
          : `${cfg.path}/${profileId}`;
        return ok(res, await risRequest({ ...cfg }, token, "GET", path));
      }
      if (action) return fail(res, 422, "invalid_action", "action is invalid");
      const rawLimit = query.limit === undefined ? "20" : String(query.limit);
      const limit = Number.parseInt(rawLimit, 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return fail(res, 422, "invalid_limit", "limit must be between 1 and 50");
      }
      if (query.cursor !== undefined && (typeof query.cursor !== "string" || query.cursor.length > 2000)) {
        return fail(res, 422, "invalid_cursor", "cursor is invalid");
      }
      const params = new URLSearchParams({ limit: String(limit) });
      if (query.cursor) params.set("cursor", query.cursor);
      return ok(res, await risRequest(
        { ...cfg }, token, "GET", `${cfg.path}?${params.toString()}`,
      ));
    }

    if (method === "POST") {
      if (id) return fail(res, 405, "method_not_allowed", "POST with id is not supported");
      if (action) return fail(res, 422, "invalid_action", "action is invalid");
      const idempotencyKey = headerOf(req, "idempotency-key");
      if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
        return fail(res, 422, "invalid_idempotency_key", "Idempotency-Key is required");
      }
      const body = await bodyOf(req);
      if (body === null) return fail(res, 422, "invalid_body", "Request body is invalid");
      assertNoClientIdentity(body);
      return ok(res, await risRequest(
        { ...cfg, requestHeaders: { "Idempotency-Key": idempotencyKey } },
        token, "POST", cfg.path, body,
      ), 201);
    }

    if (method === "PATCH") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      if (action) return fail(res, 422, "invalid_action", "action is invalid");
      const ifMatch = headerOf(req, "if-match");
      if (!ifMatch) return fail(res, 428, "precondition_required", "If-Match is required");
      if (!IF_MATCH.test(ifMatch)) return fail(res, 422, "invalid_if_match", "If-Match is invalid");
      const body = await bodyOf(req);
      if (body === null) return fail(res, 422, "invalid_body", "Request body is invalid");
      assertNoClientIdentity(body);
      const profileId = profileIdOf(id);
      return ok(res, await risRequest(
        { ...cfg, requestHeaders: { "If-Match": ifMatch } },
        token, "PATCH", `${cfg.path}/${profileId}`, body,
      ));
    }

    if (method === "DELETE") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      if (action) return fail(res, 422, "invalid_action", "action is invalid");
      const ifMatch = headerOf(req, "if-match");
      if (ifMatch && !IF_MATCH.test(ifMatch)) {
        return fail(res, 422, "invalid_if_match", "If-Match is invalid");
      }
      const profileId = profileIdOf(id);
      const headers = ifMatch ? { "If-Match": ifMatch } : undefined;
      return ok(res, await risRequest(
        { ...cfg, ...(headers ? { requestHeaders: headers } : {}) },
        token, "DELETE", `${cfg.path}/${profileId}`,
      ));
    }

    return fail(res, 405, "method_not_allowed", "Method not allowed");
  } catch (err) {
    if (err instanceof RisClientError) {
      return fail(res, err.status >= 400 && err.status < 600 ? err.status : 502,
        err.code ?? "upstream_error", err.message);
    }
    if (err?.message === "body_too_large") {
      return fail(res, 413, "payload_too_large", "Request body is too large");
    }
    if (err?.message === "invalid_json") {
      return fail(res, 400, "bad_request", "Request body wasn't valid JSON");
    }
    if (err?.message === "body_unreadable") {
      return fail(res, 400, "bad_request", "Couldn't read the request");
    }
    return fail(res, 502, "upstream_error", "RIS returned an unexpected response");
  }
}
