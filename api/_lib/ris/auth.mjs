import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const JWKS_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map();

export class RisAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RisAuthError";
    this.code = code;
  }
}

export function __resetJwksCache() {
  jwksCache.clear();
}

function decodePart(part) {
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJsonPart(part, label) {
  try {
    return JSON.parse(decodePart(part).toString("utf8"));
  } catch {
    throw new RisAuthError("invalid_token", `${label} is malformed`);
  }
}

async function loadJwks(issuer, fetchImpl) {
  const url = `${issuer}/.well-known/jwks.json`;
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new RisAuthError("jwks_unavailable", "JWKS is unavailable");
  }
  if (!response.ok) throw new RisAuthError("jwks_unavailable", "JWKS is unavailable");
  const body = await response.json().catch(() => null);
  const keys = body && Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) throw new RisAuthError("jwks_unavailable", "JWKS has no keys");
  jwksCache.set(url, { keys, expiresAt: Date.now() + JWKS_TTL_MS });
  return keys;
}

/**
 * Verifies a Cognito ACCESS token against the configured issuer/client.
 * The token is never logged. Errors are intentionally coarse.
 */
export async function verifyAccessToken(token, cfg, fetchImpl = globalThis.fetch) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new RisAuthError("invalid_token", "Bearer token is missing or malformed");
  }
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  const header = parseJsonPart(headerPart, "header");
  const payload = parseJsonPart(payloadPart, "payload");

  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new RisAuthError("invalid_token", "Unsupported token header");
  }
  if (payload.iss !== cfg.issuer) {
    throw new RisAuthError("invalid_issuer", "Token issuer is not accepted");
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const clientMatches = payload.client_id === cfg.clientId || audiences.includes(cfg.clientId);
  if (!clientMatches) {
    throw new RisAuthError("invalid_client", "Token client is not accepted");
  }
  if (payload.token_use !== "access") {
    throw new RisAuthError("invalid_token_use", "Only access tokens are accepted");
  }
  if (typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new RisAuthError("invalid_subject", "Token subject is missing");
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    throw new RisAuthError("token_expired", "Token has expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf * 1000 > Date.now() + 60000) {
    throw new RisAuthError("token_not_yet_valid", "Token is not valid yet");
  }

  const keys = await loadJwks(cfg.issuer, fetchImpl);
  const jwk = keys.find((key) => key && key.kid === header.kid);
  if (!jwk) throw new RisAuthError("unknown_key", "Token key is unknown");

  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    throw new RisAuthError("unknown_key", "Token key is unusable");
  }

  const valid = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    publicKey,
    decodePart(signaturePart)
  );
  if (!valid) throw new RisAuthError("invalid_signature", "Token signature is invalid");

  return {
    sub: payload.sub,
    issuer: payload.iss,
    clientId: cfg.clientId,
  };
}
