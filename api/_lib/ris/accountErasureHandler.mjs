// Jobsearch BFF for the existing RIS account-erasure lifecycle.
//
// This forwards only the verified user's access token to POST /me/erasure.
// It never accepts tenant/user/partner identity from the browser and never
// implements a second deletion engine. The endpoint is disabled by default
// and restricted to the existing verified test-user allowlist.

import { isAllowedTestUser, risAccountErasureConfig } from "./config.mjs";
import { RisAuthError, verifyAccessToken } from "./auth.mjs";
import { RisClientError, risRequest } from "./client.mjs";

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

function upstreamFailure(res, result) {
  const status = result.status >= 400 && result.status < 600 ? result.status : 502;
  const code = typeof result.data?.code === "string" ? result.data.code
    : status === 401 ? "upstream_unauthenticated"
    : status === 403 ? "forbidden"
    : status === 503 ? "upstream_unavailable"
    : "upstream_error";
  return fail(res, status, code, "RIS rejected the account-erasure request");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return fail(res, 405, "method_not_allowed", "Method not allowed");
  }

  const cfg = risAccountErasureConfig();
  if (!cfg.enabled) {
    return fail(res, 503, "account_erasure_disabled",
      "RIS account erasure is disabled");
  }
  if (cfg.error) {
    return fail(res, 503, "missing_config",
      "RIS account erasure is not configured");
  }

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
      "This user is not enabled for RIS account erasure");
  }

  try {
    const result = await risRequest(
      { ...cfg, path: cfg.path }, token, "POST", cfg.path, {},
    );
    if (result.status >= 400) return upstreamFailure(res, result);
    return send(res, result.status || 200, result.data);
  } catch (err) {
    if (err instanceof RisClientError) {
      return fail(res, err.status >= 400 && err.status < 600 ? err.status : 502,
        err.code ?? "upstream_error", err.message);
    }
    return fail(res, 502, "upstream_error", "RIS returned an unexpected response");
  }
}
