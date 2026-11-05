// Server-side BFF for the verified RIS DEV2 ApplicationV1 partner routes.
//
// Browser -> this function -> RIS API Gateway.
// The RIS partner credential is read from process.env only and is never
// returned to the browser. The user's access token is forwarded unchanged so
// the RIS gateway authorizer can validate issuer/audience/signature.
//
// Supported (live verified in RIS phase 27):
//   GET    /api/ris/applications
//   POST   /api/ris/applications
//   GET    /api/ris/applications/metrics
//   GET    /api/ris/applications/{id}
//   PATCH  /api/ris/applications/{id}
//   DELETE /api/ris/applications/{id}
//   GET    /api/ris/applications/{id}/export
//
// Status/history/cover-letter/privacy routes are intentionally NOT proxied:
// they are not part of the verified integration surface yet.

const MAX_BODY_BYTES = 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,200}$/;

function baseUrl() {
  return (process.env.RIS_API_BASE_URL || "").replace(/\/+$/, "");
}

function partnerKey() {
  return process.env.RIS_API_KEY || "";
}

function timeoutMs() {
  const raw = Number(process.env.RIS_PARTNER_TIMEOUT_MS || 15000);
  return Number.isFinite(raw) && raw >= 1000 && raw <= 60000 ? Math.floor(raw) : 15000;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private");
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message) {
  json(res, status, { error: message, code });
}

function pathSegments(req) {
  const queryPath = req?.query?.path;
  if (Array.isArray(queryPath)) return queryPath.filter(Boolean);
  if (typeof queryPath === "string") return queryPath.split("/").filter(Boolean);
  try {
    const url = new URL(req?.url || "", "http://localhost");
    const prefix = "/api/ris/";
    const rest = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length)
      : url.pathname.replace(/^\/+/, "");
    return rest.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

function bearerToken(req) {
  const header = req?.headers?.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match && match[1].trim() ? match[1].trim() : null;
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
    return text.trim() ? JSON.parse(text) : {};
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

function upstreamPath(rest) {
  const suffix = rest.length ? "/" + rest.join("/") : "";
  return `/v1/partner/me/applications${suffix}`;
}

function safeCode(status, payload) {
  const raw = typeof payload?.code === "string" ? payload.code.toUpperCase() : "";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) {
    if (raw.includes("IDEMPOTENCY")) return "idempotency_conflict";
    if (raw.includes("VERSION")) return "version_conflict";
    return "conflict";
  }
  if (status === 422) return "validation_error";
  if (status === 429) return "capacity_exceeded";
  if (status === 503) return "unavailable";
  return "conflict";
}

function safeMessage(status) {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You are not allowed to access this application.";
  if (status === 404) return "Application not found.";
  if (status === 409) return "The application changed in the meantime. Please reopen it.";
  if (status === 422) return "The application data is invalid.";
  if (status === 429) return "Too many requests. Please try again later.";
  if (status === 503) return "The application service is temporarily unavailable.";
  return "The application request failed.";
}

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req?.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return fail(res, 405, "method", "Method not allowed.");
  }

  const base = baseUrl();
  const key = partnerKey();
  if (!base || !key) {
    return fail(res, 503, "unavailable",
      "RIS application persistence is not configured.");
  }

  const token = bearerToken(req);
  if (!token) {
    return fail(res, 401, "unauthorized", "Please sign in again.");
  }

  const segments = pathSegments(req);
  if (segments[0] !== "applications") {
    return fail(res, 404, "not_found", "Unknown RIS application route.");
  }
  const rest = segments.slice(1);
  const method = req.method;

  if (rest.length === 0) {
    if (!["GET", "POST"].includes(method)) {
      return fail(res, 405, "method", "Method not allowed.");
    }
  } else if (rest.length === 1 && rest[0] === "metrics") {
    if (method !== "GET") return fail(res, 405, "method", "Method not allowed.");
  } else if (rest.length === 1) {
    if (!ID_RE.test(rest[0])) {
      return fail(res, 404, "not_found", "Application not found.");
    }
    if (!["GET", "PATCH", "DELETE"].includes(method)) {
      return fail(res, 405, "method", "Method not allowed.");
    }
  } else if (rest.length === 2 && rest[1] === "export") {
    if (!ID_RE.test(rest[0])) {
      return fail(res, 404, "not_found", "Application not found.");
    }
    if (method !== "GET") return fail(res, 405, "method", "Method not allowed.");
  } else if (rest.length === 2 && ["status", "history", "cover-letter-versions"].includes(rest[1])) {
    return fail(res, 501, "unsupported",
      "This application operation is not supported by the current RIS integration.");
  } else {
    return fail(res, 404, "not_found", "Unknown RIS application route.");
  }

  let body;
  if (["POST", "PATCH", "DELETE"].includes(method)) {
    try {
      body = await readBody(req);
    } catch (err) {
      const code = err instanceof Error && err.message === "body_too_large"
        ? "validation_error" : "validation_error";
      return fail(res, 422, code, "The application data is invalid.");
    }
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs());

  const onAbort = () => controller.abort();
  req?.on?.("aborted", onAbort);

  try {
    const upstream = await fetch(base + upstreamPath(rest), {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-Api-Credential": key,
        "Accept": "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    if (upstream.ok) {
      if (!text) {
        res.statusCode = upstream.status;
        res.setHeader("Cache-Control", "no-store, private");
        return res.end();
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        return fail(res, 503, "unavailable",
          "The application service returned an invalid response.");
      }
      return json(res, upstream.status, payload);
    }

    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    return fail(res, upstream.status,
      safeCode(upstream.status, payload),
      safeMessage(upstream.status));
  } catch {
    if (timedOut) {
      return fail(res, 504, "unavailable", "The application service timed out.");
    }
    return fail(res, 503, "unavailable",
      "The application service is temporarily unavailable.");
  } finally {
    clearTimeout(timer);
    req?.off?.("aborted", onAbort);
  }
}
