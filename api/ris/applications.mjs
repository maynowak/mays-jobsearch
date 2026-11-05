import { risConfig } from "../_lib/ris/config.mjs";
import { RisAuthError, verifyAccessToken } from "../_lib/ris/auth.mjs";
import { RisClientError, applicationPath, risRequest } from "../_lib/ris/client.mjs";
import {
  RisMappingError,
  deletionReceipt,
  fromRisApplication,
  fromRisExport,
  fromRisList,
  toRisCoverLetter,
  toRisCreate,
  toRisHistory,
  toRisPatch,
  toRisStatus,
} from "../_lib/ris/map.mjs";

const MAX_BODY_BYTES = 200000;
const STAGES = new Set(["draft", "submitted", "feedback", "interview", "offer", "rejected", "withdrawn"]);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) reject(new Error("body_too_large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", () => reject(new Error("body_unreadable")));
  });
}

async function bodyOf(req) {
  if (typeof req.body === "string") {
    if (req.body.length > MAX_BODY_BYTES) throw new Error("body_too_large");
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch {
      throw new Error("invalid_json");
    }
  }
  if (req.body && typeof req.body === "object") {
    if (JSON.stringify(req.body).length > MAX_BODY_BYTES) throw new Error("body_too_large");
    return req.body;
  }
  return readBody(req);
}

function queryOf(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url ?? "/", "http://localhost").searchParams.entries());
  } catch {
    return {};
  }
}

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

function expectedVersionOf(body, req) {
  const fromBody = body?.expectedVersion;
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody;
  const header = req.headers?.["if-match"];
  if (typeof header === "string") {
    const parsed = Number.parseInt(header.replace(/^W\//, "").replace(/"/g, ""), 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function mapUpstream(status, data) {
  const upstreamCode = typeof data?.code === "string" ? data.code : "";
  if (status === 401) return [401, "upstream_unauthenticated", "RIS rejected the user authorization"];
  if (status === 403) return [403, "forbidden", "RIS denied access"];
  if (status === 404) return [404, "not_found", "Application not found"];
  if (status === 409) {
    if (upstreamCode === "VERSION_CONFLICT") return [409, "version_conflict", "Application was changed"];
    if (upstreamCode === "IDEMPOTENCY_PAYLOAD_CONFLICT") {
      return [409, "idempotency_conflict", "Idempotency key was reused"];
    }
    return [409, "conflict", "Application conflict"];
  }
  if (status === 422) return [422, "validation_error", "RIS rejected the application data"];
  if (status === 429) return [429, "rate_limited", "Too many requests"];
  if (status === 503) return [503, "unavailable", "RIS is unavailable"];
  return [502, "upstream_error", "RIS returned an unexpected response"];
}

async function callRis(cfg, token, method, path, body) {
  const result = await risRequest(cfg, token, method, path, body);
  if (result.status >= 400) {
    const [status, code, message] = mapUpstream(result.status, result.data);
    throw new RisClientError(code, status, message);
  }
  return result.data;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const cfg = risConfig();
  if (!cfg.enabled) return fail(res, 503, "ris_disabled", "RIS application storage is disabled");
  if (cfg.error) return fail(res, 503, "missing_config", "RIS application storage is not configured");

  const token = bearer(req);
  if (!token) return fail(res, 401, "unauthenticated", "Authentication is required");

  let identity;
  try {
    identity = await verifyAccessToken(token, cfg);
  } catch (err) {
    if (err instanceof RisAuthError && err.code === "jwks_unavailable") {
      return fail(res, 503, "unavailable", "Authentication service is unavailable");
    }
    const code = err instanceof RisAuthError ? err.code : "invalid_token";
    return fail(res, 401, code, "Authentication is invalid");
  }

  const query = queryOf(req);
  const id = typeof query.id === "string" ? query.id : "";
  const action = typeof query.action === "string" ? query.action : "";

  const actionAllowed =
    !action ||
    (req.method === "GET" && (action === "export" || action === "metrics")) ||
    (req.method === "POST" && (action === "status" || action === "history" || action === "cover-letter"));
  if (!actionAllowed) return fail(res, 422, "invalid_action", "action is invalid");

  try {
    if (req.method === "GET") {
      if (action === "metrics") {
        const data = await callRis(cfg, token, "GET", applicationPath(cfg, "", "/metrics"));
        return send(res, 200, data);
      }
      if (action === "export") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        const data = await callRis(cfg, token, "GET", applicationPath(cfg, id, "/export"));
        return send(res, 200, fromRisExport(data, identity.sub));
      }
      if (id) {
        const data = await callRis(cfg, token, "GET", applicationPath(cfg, id));
        return send(res, 200, { application: fromRisApplication(data.application, identity.sub) });
      }
      const limit = Math.min(Math.max(Number.parseInt(query.limit ?? "50", 10) || 50, 1), 100);
      const params = new URLSearchParams({ limit: String(limit) });
      if (query.cursor) params.set("cursor", String(query.cursor).slice(0, 2000));
      if (query.status) {
        if (!STAGES.has(String(query.status))) return fail(res, 422, "invalid_status", "status is invalid");
        params.set("stage", String(query.status));
      }
      if (query.stage) {
        if (!STAGES.has(String(query.stage))) return fail(res, 422, "invalid_stage", "stage is invalid");
        params.set("stage", String(query.stage));
      }
      const data = await callRis(cfg, token, "GET", `${applicationPath(cfg)}?${params.toString()}`);
      return send(res, 200, fromRisList(data, identity.sub));
    }

    if (req.method === "POST") {
      const body = await bodyOf(req);
      if (action === "status") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        const payload = toRisStatus(body?.status, expectedVersionOf(body, req), body?.note);
        const data = await callRis(cfg, token, "POST", applicationPath(cfg, id, "/status"), payload);
        return send(res, 200, { application: fromRisApplication(data.application, identity.sub) });
      }
      if (action === "history") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        const payload = toRisHistory(body?.event, expectedVersionOf(body, req));
        const data = await callRis(cfg, token, "POST", applicationPath(cfg, id, "/history"), payload);
        return send(res, 201, { history: data?.history ?? null });
      }
      if (action === "cover-letter") {
        if (!id) return fail(res, 422, "invalid_request", "id is required");
        const payload = toRisCoverLetter(body?.version, expectedVersionOf(body, req));
        const data = await callRis(cfg, token, "POST", applicationPath(cfg, id, "/cover-letter-versions"), payload);
        return send(res, 201, { version: data?.version ?? null });
      }
      if (action) return fail(res, 422, "invalid_action", "action is invalid");
      if (id) return fail(res, 405, "method_not_allowed", "POST with id requires an action");

      const idempotencyKey =
        req.headers?.["idempotency-key"] ??
        req.headers?.["Idempotency-Key"] ??
        body?.idempotencyKey;
      const payload = toRisCreate(body, idempotencyKey);
      const data = await callRis(cfg, token, "POST", applicationPath(cfg), payload);
      return send(res, 201, { application: fromRisApplication(data.application, identity.sub) });
    }

    if (req.method === "PATCH") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      const body = await bodyOf(req);
      const payload = toRisPatch(body, expectedVersionOf(body, req));
      const data = await callRis(cfg, token, "PATCH", applicationPath(cfg, id), payload);
      return send(res, 200, { application: fromRisApplication(data.application, identity.sub) });
    }

    if (req.method === "DELETE") {
      if (!id) return fail(res, 422, "invalid_request", "id is required");
      const body = await bodyOf(req);
      const expectedVersion = expectedVersionOf(body, req);
      if (!expectedVersion) return fail(res, 422, "expected_version_required", "expectedVersion is required");
      await callRis(cfg, token, "DELETE", applicationPath(cfg, id), { expectedVersion });
      return send(res, 200, deletionReceipt());
    }

    return fail(res, 405, "method_not_allowed", "Method not allowed");
  } catch (err) {
    if (err instanceof RisMappingError) return fail(res, err.status, err.code, err.message);
    if (err instanceof RisClientError) return fail(res, err.status, err.code, err.message);
    if (err?.message === "body_too_large") return fail(res, 413, "payload_too_large", "Request body is too large");
    if (err?.message === "invalid_json") return fail(res, 400, "bad_request", "Request body wasn't valid JSON");
    if (err?.message === "body_unreadable") return fail(res, 400, "bad_request", "Couldn't read the request");
    console.error("[/api/ris/applications] unexpected failure");
    return fail(res, 500, "internal", "Something went wrong on our end");
  }
}
