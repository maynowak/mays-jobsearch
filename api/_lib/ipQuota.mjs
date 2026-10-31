import { cacheEval } from "./cache.mjs";
import { ipQuotaVersion } from "./ip.mjs";

const RESERVE_SCRIPT = `
local windowUsed = tonumber(redis.call('GET', KEYS[1]) or '0')
local dailyUsed = tonumber(redis.call('GET', KEYS[2]) or '0')
if windowUsed >= tonumber(ARGV[1]) or dailyUsed >= tonumber(ARGV[2]) then
  return -1
end
local nextWindow = redis.call('INCR', KEYS[1])
if nextWindow == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
local nextDaily = redis.call('INCR', KEYS[2])
if nextDaily == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4])) end
return 1
`;

const RELEASE_SCRIPT = `
local windowUsed = tonumber(redis.call('GET', KEYS[1]) or '0')
local dailyUsed = tonumber(redis.call('GET', KEYS[2]) or '0')
if windowUsed > 0 then redis.call('DECR', KEYS[1]) end
if dailyUsed > 0 then redis.call('DECR', KEYS[2]) end
return 1
`;

export function ipQuotaConfig(env = process.env) {
  const enabled = String(env.IP_QUOTA_ENABLED ?? "").trim().toLowerCase() === "true";
  const windowSec = positiveInt(env.IP_QUOTA_WINDOW_SEC, 600);
  const windowMax = positiveInt(env.IP_QUOTA_MAX_PER_WINDOW, 30);
  const dailyMax = positiveInt(env.IP_QUOTA_DAILY_MAX, 300);
  return { enabled, windowSec, windowMax, dailyMax };
}

function positiveInt(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function utcDate(nowSec) {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

function keysFor(provider, scope, nowSec, config) {
  const version = ipQuotaVersion();
  const windowId = Math.floor(nowSec / config.windowSec);
  return {
    window: `mj-quota:ip:${version}:${provider}:w:${windowId}:${scope}`,
    daily: `mj-quota:ip:${version}:${provider}:d:${utcDate(nowSec)}:${scope}`,
    windowTtl: config.windowSec + 60,
    dailyTtl: 24 * 60 * 60 + 60,
  };
}

function validProvider(provider) {
  return typeof provider === "string" && /^[a-z0-9-]{1,32}$/.test(provider);
}

function validScope(scope) {
  return typeof scope === "string" && /^[a-f0-9]{16,64}$/.test(scope);
}

/**
 * Atomically reserve one request against the IP window and daily counters.
 * Returns { status: "allowed" | "limit_reached" | "quota_unavailable" | "invalid_scope" }.
 */
export async function reserveIpQuota(provider, scope, nowSec = Math.floor(Date.now() / 1000), env = process.env) {
  if (!validProvider(provider) || !validScope(scope)) return { status: "invalid_scope" };
  const config = ipQuotaConfig(env);
  if (!config.enabled) return { status: "allowed", disabled: true };
  const keys = keysFor(provider, scope, nowSec, config);
  const result = await cacheEval(
    RESERVE_SCRIPT,
    [keys.window, keys.daily],
    [config.windowMax, config.dailyMax, keys.windowTtl, keys.dailyTtl]
  );
  if (result === null) return { status: "quota_unavailable" };
  if (result === -1) return { status: "limit_reached" };
  return { status: "allowed" };
}

/** Compensate a reservation when the provider was provably not called. */
export async function releaseIpQuota(provider, scope, nowSec = Math.floor(Date.now() / 1000), env = process.env) {
  if (!validProvider(provider) || !validScope(scope)) return { status: "invalid_scope" };
  const config = ipQuotaConfig(env);
  if (!config.enabled) return { status: "allowed", disabled: true };
  const keys = keysFor(provider, scope, nowSec, config);
  const result = await cacheEval(RELEASE_SCRIPT, [keys.window, keys.daily], []);
  if (result === null) return { status: "quota_unavailable" };
  return { status: "allowed" };
}

// Exposed only for the isolated Redis verification script.
export const __IP_QUOTA_SCRIPTS = {
  reserve: RESERVE_SCRIPT,
  release: RELEASE_SCRIPT,
};
