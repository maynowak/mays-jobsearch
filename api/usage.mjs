import { getUsageSnapshot } from "./_lib/usage.mjs";

function usageToken() {
  return process.env.USAGE_DIAGNOSTICS_TOKEN || "";
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req) {
  const token = usageToken();
  if (!token) return null;
  const provided = req.headers["x-usage-token"] || "";
  const bearer = String(req.headers.authorization || "");
  const bearerToken = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  return safeEqual(token, provided) || safeEqual(token, bearerToken);
}

function protect(req, res) {
  const ok = isAuthorized(req);
  if (ok === null) {
    res.setHeader("Content-Type", "application/json");
    return res.status(403).json({
      error: "This endpoint is disabled. Set USAGE_DIAGNOSTICS_TOKEN to enable it.",
      code: "forbidden",
    });
  }
  if (ok !== true) {
    res.setHeader("Content-Type", "application/json");
    return res.status(401).json({
      error: "Unauthorized. Send the USAGE_DIAGNOSTICS_TOKEN via the x-usage-token header.",
      code: "unauthorized",
    });
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-usage-token, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Content-Type", "application/json");
    return res.status(405).json({
      error: "This endpoint accepts GET requests only.",
      code: "method",
    });
  }

  const blocked = protect(req, res);
  if (blocked) return blocked;

  try {
    const snapshot = await getUsageSnapshot();
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error("[/api/usage] unexpected:", err);
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({
      error: "Couldn't read the usage counters. Please try again in a moment.",
      code: "internal",
    });
  }
}
