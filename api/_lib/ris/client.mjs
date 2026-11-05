const ALLOWED_SUFFIX = new Set(["", "/status", "/history", "/cover-letter-versions", "/export"]);

export class RisClientError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "RisClientError";
    this.code = code;
    this.status = status;
  }
}

export function assertApplicationId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(value)) {
    throw new RisClientError("invalid_application_id", 422, "applicationId is invalid");
  }
  return value;
}

export function applicationPath(cfg, applicationId, suffix = "") {
  if (!ALLOWED_SUFFIX.has(suffix)) {
    throw new RisClientError("invalid_path", 422, "Unsupported application operation");
  }
  const base = applicationId ? `${cfg.path}/${assertApplicationId(applicationId)}` : cfg.path;
  return `${base}${suffix}`;
}

/**
 * Performs exactly one request. Mutating calls are never retried.
 */
export async function risRequest(cfg, token, method, path, body, fetchImpl = globalThis.fetch) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Api-Credential": cfg.credential,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch {
    throw new RisClientError("unavailable", 503, "RIS is unavailable");
  }

  let data = null;
  if (response.status !== 204) {
    data = await response.json().catch(() => null);
  }
  return { status: response.status, data };
}
