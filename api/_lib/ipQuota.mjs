import { randomBytes } from "node:crypto";
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
redis.call('SET', KEYS[3], ARGV[5]..'|'..ARGV[6], 'EX', tonumber(ARGV[7]))
return 1
`;

// Keys: receipt, current window, previous window, current day, previous day.
// The receipt pins the original window/day so a late release cannot decrement
// a counter in a newer window.
const RELEASE_SCRIPT = `
local receipt = redis.call('GET', KEYS[1])
if not receipt then return 0 end
local sep = string.find(receipt, '|', 1, true)
if not sep then redis.call('DEL', KEYS[1]); return -1 end
local windowId = string.sub(receipt, 1, sep - 1)
local date = string.sub(receipt, sep + 1)
redis.call('DEL', KEYS[1])
local windowKey = KEYS[2]
if windowId ~= ARGV[1] then windowKey = KEYS[3] end
local dailyKey = KEYS[4]
if date ~= ARGV[2] then dailyKey = KEYS[5] end
local windowUsed = tonumber(redis.call('GET', windowKey) or '0')
local dailyUsed = tonumber(redis.call('GET', dailyKey) or '0')
if windowUsed > 0 then redis.call('DECR', windowKey) end
if dailyUsed > 0 then redis.call('DECR', dailyKey) end
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

function keysFor(provider, scope, nowSec, config, version) {
  const windowId = Math.floor(nowSec / config.windowSec);
  return {
    window: `mj-quota:ip:${version}:${provider}:w:${windowId}:${scope}`,
    daily: `mj-quota:ip:${version}:${provider}:d:${utcDate(nowSec)}:${scope}`,
    windowId,
    date: utcDate(nowSec),
    windowTtl: config.windowSec + 60,
    dailyTtl: 24 * 60 * 60 + 60,
  };
}

function receiptKey(provider, receipt, version) {
  return `mj-quota:ip:${version}:${provider}:r:${receipt}`;
}

function validProvider(provider) {
  return typeof provider === "string" && /^[a-z0-9-]{1,32}$/.test(provider);
}

function validScope(scope) {
  return typeof scope === "string" && /^[a-f0-9]{16,64}$/.test(scope);
}

function validReceipt(receipt) {
  return typeof receipt === "string" && /^[a-f0-9]{32}$/.test(receipt);
}

/**
 * Atomically reserve one request against the IP window and daily counters.
 * Returns { status, receipt? }.
 */
export async function reserveIpQuota(provider, scope, nowSec = Math.floor(Date.now() / 1000), env = process.env) {
  if (!validProvider(provider) || !validScope(scope)) return { status: "invalid_scope" };
  const config = ipQuotaConfig(env);
  if (!config.enabled) return { status: "allowed", disabled: true };
  const version = ipQuotaVersion(env);
  const keys = keysFor(provider, scope, nowSec, config, version);
  const receipt = randomBytes(16).toString("hex");
  const result = await cacheEval(
    RESERVE_SCRIPT,
    [keys.window, keys.daily, receiptKey(provider, receipt, version)],
    [config.windowMax, config.dailyMax, keys.windowTtl, keys.dailyTtl, keys.windowId, keys.date, config.windowSec]
  );
  if (result === null) return { status: "quota_unavailable" };
  if (result === -1) return { status: "limit_reached" };
  return { status: "allowed", receipt };
}

/**
 * Release a reservation using its server-issued receipt. A missing or already
 * used receipt is a safe no-op. The receipt pins the original window/day.
 */
export async function releaseIpQuota(
  provider,
  scope,
  receipt,
  nowSec = Math.floor(Date.now() / 1000),
  env = process.env
) {
  if (!validProvider(provider) || !validScope(scope) || !validReceipt(receipt)) {
    return { status: "invalid_scope" };
  }
  const config = ipQuotaConfig(env);
  if (!config.enabled) return { status: "allowed", disabled: true };
  const version = ipQuotaVersion(env);
  const current = keysFor(provider, scope, nowSec, config, version);
  const previous = keysFor(provider, scope, nowSec - config.windowSec, config, version);
  const previousDay = keysFor(provider, scope, nowSec - 24 * 60 * 60, config, version);
  const result = await cacheEval(
    RELEASE_SCRIPT,
    [
      receiptKey(provider, receipt, version),
      current.window,
      previous.window,
      current.daily,
      previousDay.daily,
    ],
    [current.windowId, current.date]
  );
  if (result === null) return { status: "quota_unavailable" };
  if (result === 0) return { status: "missing" };
  if (result === -1) return { status: "invalid_scope" };
  return { status: "allowed" };
}

// Exposed only for the isolated Redis verification script.
export const __IP_QUOTA_SCRIPTS = {
  reserve: RESERVE_SCRIPT,
  release: RELEASE_SCRIPT,
};
