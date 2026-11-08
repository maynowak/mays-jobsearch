// Jobsearch BFF for durable manual, CV-search and ATS search profiles.
//
// The browser never sends tenant/user identity or a RIS credential, and never
// chooses the consent notice version. RIS remains the source of truth for
// contracts, versions, capacity and the search-profile-storage consent gate.
//
// One route, one BFF: `type` selects the existing RIS contract:
//   manual -> /v1/partner/me/manual-search-profiles
//   cv     -> /v1/partner/me/cvs/{cvId}/search-profiles
//   ats    -> /v1/partner/me/search-profiles/{searchProfileId}/ats-profiles

import { isAllowedTestUser, risSearchProfilesConfig } from "./config.mjs";
import { RisAuthError, verifyAccessToken } from "./auth.mjs";
import { RisClientError, risRequest } from "./client.mjs";

const MAX_BODY_BYTES = 20000;
const TYPES = new Set(["manual", "cv", "ats"]);
const ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;

function bearer(req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(String(raw));
  return match ? match[1].trim() : "";
}

function send(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
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
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    if (req.body.length > MAX_BODY_BYTES) throw new Error("body_too_large");
    try { return req.body ? JSON.parse(req.body) : {}; } catch { return null; }
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) reject(new Error("body_too_large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid_json")); }
    });
    req.on("error", () => reject(new Error("body_unreadable")));
  });
}

function idOf(value, name) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new RisClientError("invalid_request", 422, `${name} is invalid`);
  }
  return value;
}

function basePath(type, cvId, searchProfileId) {
  if (type === "manual") return "/v1/partner/me/manual-search-profiles";
  if (type === "cv") {
    return `/v1/partner/me/cvs/${idOf(cvId, "cvId")}/search-profiles`;
  }
  return `/v1/partner/me/search-profiles/${idOf(searchProfileId, "searchProfileId")}/ats-profiles`;
}

function upstreamFailure(res, result) {
  const status = result.status >= 400 && result.status < 600 ? result.status : 502;
  const code = typeof result.data?.code === "string" ? result.data.code
    : status === 409 ? "conflict"
    : status === 403 ? "forbidden"
    : status === 401 ? "upstream_unauthenticated"
    : status === 404 ? "not_found"
    : status === 422 ? "validation_error"
    : "upstream_error";
  return fail(res, status, code, "RIS rejected the search-profile request");
}

function ok(res, result, fallbackStatus = 200) {
  if (result.status >= 400) return upstreamFailure(res, result);
  const status = result.status >= 200 && result.status < 300 ? result.status : fallbackStatus;
  return send(res, status, result.data);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const cfg = risSearchProfilesConfig();
  if (!cfg.enabled) {
    return fail(res, 503, "search_profile_storage_disabled",
      "RIS search-profile storage is disabled");
  }
  if (cfg.error) return fail(res, 503, "missing_config", "RIS search-profile storage is not configured");

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
      "This user is not enabled for RIS search-profile storage");
  }

  const query = queryOf(req);
  const type = typeof query.type === "string" ? query.type.trim() : "";
  if (!TYPES.has(type)) {
    return fail(res, 422, "invalid_type", "type must be manual, cv or ats");
  }
  const id = typeof query.id === "string" ? query.id : "";

  try {
    const base = basePath(type, query.cvId, query.searchProfileId);
    const itemPath = id ? `${base}/${idOf(id, "id")}` : base;

    if (req.method === "GET") {
      if (id) return ok(res, await risRequest({ ...cfg }, token, "GET", itemPath));
      const limit = Math.min(Math.max(Number.parseInt(query.limit ?? "50", 10) || 50, 1), 50);
      const params = new URLSearchParams({ limit: String(limit) });
      if (query.cursor) params.set("cursor", String(query.cursor).slice(0, 2000));
      return ok(res, await risRequest(
        { ...cfg }, token, "GET", `${base}?${params.toString()}`,
      ));
    }

    if (req.method === "POST") {
      if (id) return fail(res, 405, "method_not_allowed", "POST with id is not supported");
      const body = await bodyOf(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail(res, 422, "invalid_body", "Request body is invalid");
      }
      return ok(res, await risRequest({ ...cfg }, token, "POST", base, body), 201);
    }

    if (req.method === "PUT") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      const body = await bodyOf(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail(res, 422, "invalid_body", "Request body is invalid");
      }
      return ok(res, await risRequest({ ...cfg }, token, "PUT", itemPath, body));
    }

    if (req.method === "DELETE") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      const params = new URLSearchParams();
      if (query.version) params.set("version", String(query.version).slice(0, 20));
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return ok(res, await risRequest(
        { ...cfg }, token, "DELETE", `${itemPath}${suffix}`,
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
