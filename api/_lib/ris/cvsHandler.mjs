// Jobsearch BFF for durable CV documents on the RIS partner surface.
//
// The browser only performs the short-lived presigned PUT/GET. It never sees
// the RIS partner credential, S3 credentials, tenant or user identity. The
// verified access token is forwarded to RIS, which owns tenant/user isolation.

import { isAllowedTestUser, risCvConfig } from "./config.mjs";
import { RisAuthError, verifyAccessToken } from "./auth.mjs";
import { RisClientError, risRequest } from "./client.mjs";

const MAX_BODY_BYTES = 20000;

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

function assertCvId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(value)) {
    throw new RisClientError("invalid_cv_id", 422, "cvId is invalid");
  }
  return value;
}

function cvPath(cfg, cvId, suffix = "") {
  if (!["", "/document", "/document/upload", "/document/complete"].includes(suffix)) {
    throw new RisClientError("invalid_path", 422, "Unsupported CV operation");
  }
  return `${cfg.path}${cvId ? `/${assertCvId(cvId)}` : ""}${suffix}`;
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
  return fail(res, status, code, "RIS rejected the CV document request");
}

function ok(res, result, fallbackStatus = 200) {
  if (result.status >= 400) return upstreamFailure(res, result);
  const status = result.status >= 200 && result.status < 300 ? result.status : fallbackStatus;
  return send(res, status, result.data);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const cfg = risCvConfig();
  if (!cfg.enabled) return fail(res, 503, "cv_storage_disabled", "RIS CV storage is disabled");
  if (cfg.error) return fail(res, 503, "missing_config", "RIS CV storage is not configured");

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
    return fail(res, 403, "test_user_not_allowed", "This user is not enabled for RIS CV storage");
  }

  const query = queryOf(req);
  const id = typeof query.id === "string" ? query.id : "";
  const action = typeof query.action === "string" ? query.action : "";

  try {
    if (req.method === "GET") {
      if (action === "document") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        return ok(res, await risRequest({ ...cfg, path: cfg.path }, token, "GET", cvPath(cfg, id, "/document")));
      }
      if (id) {
        return ok(res, await risRequest({ ...cfg, path: cfg.path }, token, "GET", cvPath(cfg, id)));
      }
      const limit = Math.min(Math.max(Number.parseInt(query.limit ?? "50", 10) || 50, 1), 100);
      const params = new URLSearchParams({ limit: String(limit) });
      if (query.cursor) params.set("cursor", String(query.cursor).slice(0, 2000));
      return ok(res, await risRequest(
        { ...cfg, path: cfg.path }, token, "GET", `${cfg.path}?${params.toString()}`,
      ));
    }

    if (req.method === "POST") {
      const body = await bodyOf(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail(res, 422, "invalid_body", "Request body is invalid");
      }
      if (action === "upload") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        const contentType = typeof body.contentType === "string" ? body.contentType : "application/pdf";
        return ok(res, await risRequest(
          { ...cfg, path: cfg.path }, token, "POST", cvPath(cfg, id, "/document/upload"),
          { contentType },
        ));
      }
      if (action === "complete") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        const documentId = typeof body.documentId === "string" ? body.documentId : undefined;
        return ok(res, await risRequest(
          { ...cfg, path: cfg.path }, token, "POST", cvPath(cfg, id, "/document/complete"),
          documentId ? { documentId } : {},
        ));
      }
      if (action) return fail(res, 422, "invalid_action", "action is invalid");
      if (id) return fail(res, 405, "method_not_allowed", "POST with id requires an action");
      const payload = {
        filename: body.filename,
        contentType: body.contentType ?? "application/pdf",
        ...(body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? { metadata: body.metadata }
          : {}),
      };
      return ok(res, await risRequest(
        { ...cfg, path: cfg.path }, token, "POST", cfg.path, payload,
      ), 201);
    }

    if (req.method === "PATCH") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      const body = await bodyOf(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail(res, 422, "invalid_body", "Request body is invalid");
      }
      return ok(res, await risRequest(
        { ...cfg, path: cfg.path }, token, "PATCH", cvPath(cfg, id), body,
      ));
    }

    if (req.method === "DELETE") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      return ok(res, await risRequest(
        { ...cfg, path: cfg.path }, token, "DELETE", cvPath(cfg, id),
      ));
    }

    return fail(res, 405, "method_not_allowed", "Method not allowed");
  } catch (err) {
    if (err instanceof RisClientError) {
      return fail(res, err.status >= 400 && err.status < 600 ? err.status : 502, err.code ?? "upstream_error", err.message);
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
