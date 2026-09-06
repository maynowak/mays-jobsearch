import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "mj_session";

const SESSION_ID_RE = /^[a-f0-9]{32}$/;
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function hashToken(raw) {
  return createHash("sha256").update(String(raw ?? "")).digest("hex").slice(0, 24);
}

export function clientIp(req) {
  const fwd = req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  const real = req?.headers?.["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  return "";
}

export function readCookie(req, name) {
  const header = req?.headers?.cookie;
  if (typeof header !== "string") return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

// Server-issued opaque session id. We never trust a client-supplied value beyond
// its shape: a value is either a previously issued cookie or a freshly generated
// random id. The real anti-abuse guarantee comes from the IP backstop.
export function anonymousIdentity(req) {
  const ip = clientIp(req);
  const existing = readCookie(req, SESSION_COOKIE);
  let sessionId = existing;
  let issuedNew = false;
  if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
    sessionId = randomBytes(16).toString("hex");
    issuedNew = true;
  }
  return { sessionId, ip, issuedNew };
}

export function sessionCookieHeader(sessionId) {
  const attrs = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return `${SESSION_COOKIE}=${sessionId}; ${attrs.join("; ")}`;
}