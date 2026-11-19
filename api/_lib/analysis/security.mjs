import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Shared security/envelope foundation for the analysis API.
 *
 * This is deliberately server-only. Tokens and consent assertions are signed
 * with server credentials and are never accepted from browser-supplied
 * booleans. A missing or invalid configuration fails closed.
 */
export const ANALYSIS_SCHEMA_VERSION = 1;
export const ANALYSIS_SCOPES = Object.freeze([
  "cv:parse",
  "ats:requirements",
  "ats:analyze",
  "match:evaluate",
]);
export const MAX_JSON_BYTES = 64 * 1024;
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_JOBS = 10;
export const MAX_TEXT_CHARS = 60_000;
export const ANALYSIS_CONSENT_PURPOSE = "analysis";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const TOKEN_VERSION = "v1";

export class AnalysisError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AnalysisError";
    this.status = status;
    this.code = code;
  }
}

function envValue(env, key, fallback = "") {
  return String(env?.[key] ?? fallback).trim();
}

export function analysisConfig(env = process.env) {
  const enabled = envValue(env, "ANALYSIS_API_ENABLED").toLowerCase() === "true";
  return {
    enabled,
    service: {
      secret: envValue(env, "ANALYSIS_SERVICE_SECRET"),
      issuer: envValue(env, "ANALYSIS_SERVICE_ISSUER", "ris"),
      audience: envValue(env, "ANALYSIS_SERVICE_AUDIENCE", "mays-jobsearch-analysis"),
      clockSkewSeconds: Number(envValue(env, "ANALYSIS_SERVICE_CLOCK_SKEW_SECONDS", "30")) || 30,
    },
    consent: {
      secret: envValue(env, "ANALYSIS_CONSENT_SECRET"),
      issuer: envValue(env, "ANALYSIS_CONSENT_ISSUER", "ris"),
      audience: envValue(env, "ANALYSIS_CONSENT_AUDIENCE", "mays-jobsearch-analysis"),
      purpose: ANALYSIS_CONSENT_PURPOSE,
      noticeVersion: envValue(env, "ANALYSIS_CONSENT_NOTICE_VERSION"),
      clockSkewSeconds: Number(envValue(env, "ANALYSIS_SERVICE_CLOCK_SKEW_SECONDS", "30")) || 30,
    },
  };
}

export function getHeader(req, name) {
  const headers = req?.headers ?? {};
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === wanted) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

export function requestIdFor(req) {
  const supplied = getHeader(req, "x-request-id");
  return typeof supplied === "string" && REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : randomUUID();
}

export function sendEnvelope(res, status, requestId, payload) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
  return res.status(status).json(payload);
}

export function ok(res, requestId, data, warnings = []) {
  return sendEnvelope(res, 200, requestId, {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    requestId,
    data,
    warnings,
  });
}

export function fail(res, requestId, error) {
  const status = error instanceof AnalysisError ? error.status : 500;
  const code = error instanceof AnalysisError ? error.code : "internal_error";
  const message = error instanceof AnalysisError
    ? error.message
    : "The analysis request could not be completed.";
  return sendEnvelope(res, status, requestId, {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    requestId,
    error: { code, message },
  });
}

function base64url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/**
 * Create a signed service or consent assertion. This helper exists for trusted
 * service tooling and tests; it is never exposed over HTTP.
 */
export function createSignedToken(kind, payload, secret) {
  if (!secret) throw new Error("signing secret is required");
  const body = base64url(JSON.stringify({ ...payload, kind }));
  return `${TOKEN_VERSION}.${body}.${hmac(secret, `${TOKEN_VERSION}.${body}`)}`;
}

function verifySignedToken(raw, config) {
  if (!config.secret) {
    throw new AnalysisError(503, "analysis_not_configured", "Analysis credentials are not configured.");
  }
  if (typeof raw !== "string" || !raw.startsWith(`${TOKEN_VERSION}.`)) {
    throw new AnalysisError(401, "unauthenticated", "A valid analysis credential is required.");
  }
  const parts = raw.split(".");
  if (parts.length !== 3) {
    throw new AnalysisError(401, "unauthenticated", "A valid analysis credential is required.");
  }
  const [, payloadPart, signaturePart] = parts;
  const expected = hmac(config.secret, `${TOKEN_VERSION}.${payloadPart}`);
  const actualBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new AnalysisError(401, "unauthenticated", "A valid analysis credential is required.");
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    throw new AnalysisError(401, "unauthenticated", "A valid analysis credential is required.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== config.issuer || claims.aud !== config.audience) {
    throw new AnalysisError(403, "forbidden", "The analysis credential is not valid for this service.");
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= now - config.clockSkewSeconds) {
    throw new AnalysisError(401, "unauthenticated", "The analysis credential has expired.");
  }
  if (!Number.isFinite(claims.iat) || claims.iat > now + config.clockSkewSeconds) {
    throw new AnalysisError(401, "unauthenticated", "The analysis credential is not active yet.");
  }
  return claims;
}

export function authenticateService(req) {
  const config = analysisConfig();
  if (!config.enabled) {
    throw new AnalysisError(503, "analysis_disabled", "The analysis API is not enabled.");
  }
  if (!config.service.secret) {
    throw new AnalysisError(503, "analysis_not_configured", "Analysis service authentication is not configured.");
  }
  const raw = getHeader(req, "x-analysis-token");
  if (!raw) {
    throw new AnalysisError(401, "unauthenticated", "A service analysis credential is required.");
  }
  const claims = verifySignedToken(raw, config.service);
  if (claims.kind !== "service" || typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new AnalysisError(401, "unauthenticated", "A valid service identity is required.");
  }
  if (typeof claims.tenantId !== "string" || !claims.tenantId.trim()) {
    throw new AnalysisError(403, "forbidden", "A tenant-scoped service identity is required.");
  }
  if (typeof claims.userId !== "string" || !claims.userId.trim()) {
    throw new AnalysisError(403, "forbidden", "A user-scoped service identity is required for analysis.");
  }
  if (!Array.isArray(claims.scopes) || claims.scopes.some((scope) => typeof scope !== "string")) {
    throw new AnalysisError(403, "forbidden", "The service identity has no valid scopes.");
  }
  return {
    subject: claims.sub,
    tenantId: claims.tenantId,
    userId: claims.userId,
    scopes: new Set(claims.scopes),
    tokenId: typeof claims.jti === "string" ? claims.jti : null,
  };
}

export function requireScope(identity, scope) {
  if (!identity.scopes.has(scope)) {
    throw new AnalysisError(403, "forbidden", "The service identity lacks the required scope.");
  }
}

export function requireAnalysisConsent(req, identity) {
  const config = analysisConfig();
  if (!config.consent.secret || !config.consent.noticeVersion) {
    throw new AnalysisError(503, "consent_not_configured", "Analysis consent verification is not configured.");
  }
  const raw = getHeader(req, "x-analysis-consent");
  if (!raw) {
    throw new AnalysisError(403, "consent_required", "Verified analysis consent is required.");
  }
  const claims = verifySignedToken(raw, config.consent);
  if (claims.kind !== "consent"
      || claims.tenantId !== identity.tenantId
      || claims.userId !== identity.userId
      || claims.purpose !== ANALYSIS_CONSENT_PURPOSE
      || claims.noticeVersion !== config.consent.noticeVersion) {
    throw new AnalysisError(403, "consent_required", "Verified analysis consent is required.");
  }
  return claims;
}

export function assertTenantAndUser(body, identity) {
  if (body && Object.prototype.hasOwnProperty.call(body, "tenantId")) {
    if (body.tenantId !== identity.tenantId) {
      throw new AnalysisError(403, "tenant_mismatch", "The request tenant does not match the verified identity.");
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "userId")) {
    if (body.userId !== identity.userId) {
      throw new AnalysisError(403, "user_mismatch", "The request user does not match the verified identity.");
    }
  }
}

export function requireSchemaVersion(value) {
  if (value !== ANALYSIS_SCHEMA_VERSION) {
    throw new AnalysisError(422, "schema_version_unsupported", "schemaVersion must be 1.");
  }
}

export function requirePdfContentType(req) {
  const value = String(getHeader(req, "content-type") ?? "").toLowerCase();
  if (!value.split(";")[0].trim().startsWith("application/pdf")) {
    throw new AnalysisError(415, "unsupported_media_type", "Only application/pdf is supported.");
  }
}

function bodySize(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.byteLength;
  return Buffer.byteLength(String(value ?? ""));
}

function parseJson(value) {
  try {
    return value ? JSON.parse(String(value)) : {};
  } catch {
    throw new AnalysisError(400, "invalid_json", "The request body wasn't valid JSON.");
  }
}

export async function readJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && !(req.body instanceof Uint8Array)) {
    const size = Buffer.byteLength(JSON.stringify(req.body));
    if (size > maxBytes) throw new AnalysisError(413, "payload_too_large", "The request body is too large.");
    return req.body;
  }
  if (typeof req.body === "string" || Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
    const value = req.body;
    if (bodySize(value) > maxBytes) throw new AnalysisError(413, "payload_too_large", "The request body is too large.");
    return parseJson(Buffer.isBuffer(value) || value instanceof Uint8Array ? Buffer.from(value).toString("utf8") : value);
  }
  const chunks = [];
  let size = 0;
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new AnalysisError(413, "payload_too_large", "The request body is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", () => reject(new AnalysisError(400, "invalid_request", "The request body could not be read.")));
  });
  return parseJson(Buffer.concat(chunks).toString("utf8"));
}

export async function readRawBody(req, maxBytes = MAX_PDF_BYTES) {
  if (typeof req.body === "string" || Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
    const value = Buffer.isBuffer(req.body)
      ? req.body
      : req.body instanceof Uint8Array
        ? Buffer.from(req.body)
        : Buffer.from(req.body, "utf8");
    if (value.length > maxBytes) throw new AnalysisError(413, "payload_too_large", "The document is too large.");
    return value;
  }
  if (req.body && typeof req.body === "object") {
    throw new AnalysisError(415, "unsupported_media_type", "Send the PDF as the raw request body.");
  }
  const length = Number(getHeader(req, "content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    throw new AnalysisError(413, "payload_too_large", "The document is too large.");
  }
  const chunks = [];
  let size = 0;
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new AnalysisError(413, "payload_too_large", "The document is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", () => reject(new AnalysisError(400, "invalid_request", "The document could not be read.")));
  });
  return Buffer.concat(chunks);
}

export function methodNotAllowed(req, res, requestId) {
  return fail(res, requestId, new AnalysisError(405, "method_not_allowed", "This endpoint accepts POST requests only."));
}
