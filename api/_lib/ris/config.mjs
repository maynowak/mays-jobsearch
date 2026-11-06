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

function parseTestUserAllowlist(value) {
  const allowed = new Set();
  for (const raw of String(value ?? "").split(/[\n,]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const separator = entry.indexOf("|");
    if (separator <= 0) continue;
    const issuer = entry.slice(0, separator).trim().replace(/\/+$/, "");
    const subject = entry.slice(separator + 1).trim();
    if (!issuer || !subject) continue;
    allowed.add(`${issuer}|${subject}`);
  }
  return allowed;
}

export function isAllowedTestUser(identity, cfg) {
  if (!cfg?.testUserAllowlist || cfg.testUserAllowlist.size === 0) return false;
  const issuer = String(identity?.issuer ?? "").trim().replace(/\/+$/, "");
  const subject = String(identity?.sub ?? "").trim();
  if (!issuer || !subject) return false;
  return cfg.testUserAllowlist.has(`${issuer}|${subject}`);
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
  const credential = String(
    env.RIS_PARTNER_CREDENTIAL ?? env.RIS_API_KEY ?? env.RIS_API_CREDENTIAL ?? ""
  ).trim();
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
    testUserAllowlist: parseTestUserAllowlist(env.RIS_TEST_USER_ALLOWLIST),
    timeoutMs: Number(env.RIS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}
