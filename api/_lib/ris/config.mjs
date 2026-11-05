const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PATH = "/v1/partner/me/applications";

function httpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * RIS BFF configuration is server-only. Nothing here is exposed to VITE_*.
 * The feature is disabled unless explicitly enabled and fully configured.
 */
export function risConfig(env = process.env) {
  const enabled = String(env.RIS_APPLICATION_STORAGE_ENABLED ?? "").toLowerCase() === "true";
  if (!enabled) {
    return { enabled: false, error: "ris_disabled" };
  }

  const base = httpsUrl(env.RIS_API_BASE_URL);
  const issuer = httpsUrl(env.RIS_COGNITO_ISSUER);
  const credential = String(env.RIS_PARTNER_CREDENTIAL ?? "").trim();
  const clientId = String(env.RIS_COGNITO_CLIENT_ID ?? "").trim();

  if (!base || !issuer || !credential || !clientId) {
    return { enabled: true, error: "missing_config" };
  }

  return {
    enabled: true,
    baseUrl: base.toString().replace(/\/+$/, ""),
    path: DEFAULT_PATH,
    issuer: issuer.toString().replace(/\/+$/, ""),
    clientId,
    credential,
    timeoutMs: Number(env.RIS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}
