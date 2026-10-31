import { randomBytes } from "node:crypto";
import { getConfig } from "./config.mjs";
import { hashToken } from "./identity.mjs";
import {
  cacheGet,
  cacheHGetAll,
  cacheHIncrBy,
  cacheIncr,
  cacheIncrBy,
  cacheReserveIncr,
  cacheDecrBy,
  cacheEval,
} from "./cache.mjs";
import { APIFY_ACTORS } from "./sources/apify/actors.mjs";
import { SOURCE_ID as ARBEITNOW_SOURCE_ID } from "./sources/arbeitnow.mjs";

const MONTH_TTL_SEC = 62 * 24 * 60 * 60;
const OPENROUTER_MODEL_KEY = "mj-usage:openrouter:model";

const REQUEST_KEY = "mj-usage:openrouter:requests";
const FAILURE_KEY = "mj-usage:openrouter:failures";
const ATTEMPT_KEY = "mj-usage:openrouter:fallbackAttempts";
const APIFY_RUN_KEY = "mj-usage:apify:runs";
const APIFY_REUSE_KEY = "mj-usage:apify:datasetReuses";
const APIFY_CACHE_HIT_KEY = "mj-usage:apify:cacheHits";
const APIFY_CACHE_MISS_KEY = "mj-usage:apify:cacheMisses";

const OPENROUTER_KEYS = {
  requests: REQUEST_KEY,
  failures: FAILURE_KEY,
  attempts: ATTEMPT_KEY,
  model: OPENROUTER_MODEL_KEY,
};

function providerKeys(provider) {
  if (provider === "openrouter") return OPENROUTER_KEYS;
  return {
    requests: `mj-usage:ai:${provider}:requests`,
    failures: `mj-usage:ai:${provider}:failures`,
    attempts: `mj-usage:ai:${provider}:fallbackAttempts`,
    model: `mj-usage:ai:${provider}:model`,
  };
}

function providerLimit(provider) {
  const cfg = getConfig();
  if (provider === "openrouter") return cfg.openRouterMonthlyMaxRequests;
  if (provider === "edenai") return cfg.edenaiMonthlyMaxRequests;
  return cfg.openRouterMonthlyMaxRequests;
}

function currentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthScoped(base) {
  return `${base}:${currentMonth()}`;
}

export async function countOpenRouterRequest(model) {
  return countAiRequest("openrouter", model);
}

export async function countOpenRouterFailure() {
  return countAiFailure("openrouter");
}

export async function countOpenRouterAttempt() {
  return countAiAttempt("openrouter");
}

export async function countAiRequest(provider, model) {
  const keys = providerKeys(provider);
  await cacheIncr(monthScoped(keys.requests), MONTH_TTL_SEC);
  if (model) await cacheHIncrBy(monthScoped(keys.model), String(model), 1, MONTH_TTL_SEC);
}

export async function countAiFailure(provider) {
  const keys = providerKeys(provider);
  await cacheIncr(monthScoped(keys.failures), MONTH_TTL_SEC);
}

export async function countAiAttempt(provider) {
  const keys = providerKeys(provider);
  await cacheIncr(monthScoped(keys.attempts), MONTH_TTL_SEC);
}

export async function countApifyRun() {
  await cacheIncr(monthScoped(APIFY_RUN_KEY), MONTH_TTL_SEC);
}

export async function countApifyDatasetReuse() {
  await cacheIncr(monthScoped(APIFY_REUSE_KEY), MONTH_TTL_SEC);
}

export async function countApifyCacheHit() {
  await cacheIncr(monthScoped(APIFY_CACHE_HIT_KEY), MONTH_TTL_SEC);
}

export async function countApifyCacheMiss() {
  await cacheIncr(monthScoped(APIFY_CACHE_MISS_KEY), MONTH_TTL_SEC);
}

function jobSourceKeys(sourceId) {
  return {
    requests: `mj-usage:jobs:${sourceId}:requests`,
    runs: `mj-usage:jobs:${sourceId}:runs`,
    datasetReuses: `mj-usage:jobs:${sourceId}:datasetReuses`,
    cacheHits: `mj-usage:jobs:${sourceId}:cacheHits`,
    cacheMisses: `mj-usage:jobs:${sourceId}:cacheMisses`,
  };
}

export async function countJobSourceRequest(sourceId) {
  await cacheIncr(monthScoped(jobSourceKeys(sourceId).requests), MONTH_TTL_SEC);
}

export async function countJobSourceRun(sourceId) {
  await cacheIncr(monthScoped(jobSourceKeys(sourceId).runs), MONTH_TTL_SEC);
}

export async function countJobSourceDatasetReuse(sourceId) {
  await cacheIncr(monthScoped(jobSourceKeys(sourceId).datasetReuses), MONTH_TTL_SEC);
}

export async function countJobSourceCacheHit(sourceId) {
  await cacheIncr(monthScoped(jobSourceKeys(sourceId).cacheHits), MONTH_TTL_SEC);
}

export async function countJobSourceCacheMiss(sourceId) {
  await cacheIncr(monthScoped(jobSourceKeys(sourceId).cacheMisses), MONTH_TTL_SEC);
}

async function readJobSourceCounts(sourceId) {
  const keys = jobSourceKeys(sourceId);
  const out = { requests: 0, runs: 0, datasetReuses: 0, cacheHits: 0, cacheMisses: 0 };
  for (const [name, base] of Object.entries(keys)) {
    out[name] = await readCount(base);
  }
  return out;
}

async function readCount(base) {
  const raw = await cacheGet(monthScoped(base));
  return Number.isFinite(raw) ? raw : 0;
}

export async function openRouterLimitReached() {
  return aiLimitReached("openrouter");
}

export async function aiLimitReached(provider) {
  const requests = await readCount(providerKeys(provider).requests);
  return requests >= providerLimit(provider);
}

export async function apifyRunLimitReached() {
  const cfg = getConfig();
  const runs = await readCount(APIFY_RUN_KEY);
  return runs >= cfg.apifyMonthlyMaxRuns;
}

// Atomic reserve of one monthly Apify run slot. Race-safe: EVAL checks the
// current count against the limit and increments in a single Redis command.
// Returns { ok: true } on success, { error: "exceeded" } at the limit, or
// { error: "unavailable" } when Redis is down (caller must fail closed).
export async function reserveApifyRunSlot() {
  const cfg = getConfig();
  const reserved = await cacheReserveIncr(
    monthScoped(APIFY_RUN_KEY),
    1,
    cfg.apifyMonthlyMaxRuns,
    MONTH_TTL_SEC
  );
  if (reserved === null) return { error: "unavailable" };
  if (reserved === -1) return { error: "exceeded" };
  return { ok: true };
}

// Best-effort refund of a reserved run slot (e.g. when the run could not start).
export async function refundApifyRunSlot() {
  await cacheDecrBy(monthScoped(APIFY_RUN_KEY), 1);
}

// ---------------------------------------------------------------------------
// Atomic provider budgets (JM-COOKIELESS-QUOTA-IMPLEMENTATION-02A)
// ---------------------------------------------------------------------------

const BUDGET_TTL_SEC = MONTH_TTL_SEC;
const RESERVATION_TTL_SEC = 15 * 60;

const RESERVE_SCRIPT = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local all = redis.call('HGETALL', KEYS[2])
local reserved = 0
local now = tonumber(ARGV[4])
for i = 1, #all, 2 do
  local value = all[i + 1]
  local max, exp = string.match(value, '^(%d+):(%d+):(.+)$')
  if max and exp and tonumber(exp) < now then
    redis.call('HDEL', KEYS[2], all[i])
  elseif max then
    reserved = reserved + tonumber(max)
  end
end
local max = tonumber(ARGV[1])
if used + reserved + max > tonumber(ARGV[2]) then return -1 end
redis.call('HSET', KEYS[2], ARGV[3], tostring(max)..':'..tostring(now + tonumber(ARGV[5]))..':'..ARGV[6])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[7]))
return 1
`;

const SETTLE_SCRIPT = `
local value = redis.call('HGET', KEYS[3], ARGV[1])
if not value then return -1 end
local max, exp, month = string.match(value, '^(%d+):(%d+):(.+)$')
redis.call('HDEL', KEYS[3], ARGV[1])
local actual = tonumber(ARGV[2])
if not actual or actual < 0 then actual = 0 end
if actual > tonumber(max) then actual = tonumber(max) end
local key = KEYS[1]
if month ~= ARGV[4] then key = KEYS[2] end
if actual > 0 then
  redis.call('INCRBY', key, actual)
  redis.call('EXPIRE', key, tonumber(ARGV[5]))
end
return actual
`;

const RELEASE_SCRIPT = `
local removed = redis.call('HDEL', KEYS[1], ARGV[1])
return removed
`;

function budgetProvider(provider) {
  const cfg = getConfig();
  if (provider === "theirstack") {
    return {
      usedBase: "mj-usage:theirstack:credits",
      limit: cfg.theirstackMonthlyMaxCredits,
    };
  }
  if (provider === "jobspipe") {
    return {
      usedBase: "mj-usage:jobspipe:credits",
      limit: cfg.jobspipeMonthlyMaxCredits,
    };
  }
  return null;
}

function previousMonth() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function reservationHashKey(provider) {
  return `mj-budget:${provider}:reservations:${currentMonth()}`;
}

/**
 * Reserve the maximum possible cost before a paid provider call.
 * Returns { ok, id } | { error: "exceeded" | "unavailable" }.
 */
export async function reserveProviderBudget(provider, maximumCost) {
  const budget = budgetProvider(provider);
  if (!budget) return { error: "unavailable" };
  const max = Math.floor(Number(maximumCost));
  if (!Number.isFinite(max) || max <= 0) return { error: "unavailable" };
  const id = randomBytes(16).toString("hex");
  const month = currentMonth();
  const result = await cacheEval(
    RESERVE_SCRIPT,
    [`${budget.usedBase}:${month}`, reservationHashKey(provider)],
    [max, budget.limit, id, Date.now(), RESERVATION_TTL_SEC, month, BUDGET_TTL_SEC]
  );
  if (result === null) return { error: "unavailable" };
  if (result === -1) return { error: "exceeded" };
  return { ok: true, id };
}

/**
 * Settle a reservation with the actual billed amount. Missing reservations
 * (double settlement or expiry) are a safe no-op. Redis failure is reported.
 */
export async function settleProviderBudget(provider, id, actualCost) {
  const budget = budgetProvider(provider);
  if (!budget) return { error: "unavailable" };
  const actual = Math.max(0, Math.floor(Number(actualCost) || 0));
  const month = currentMonth();
  const result = await cacheEval(
    SETTLE_SCRIPT,
    [
      `${budget.usedBase}:${month}`,
      `${budget.usedBase}:${previousMonth()}`,
      reservationHashKey(provider),
    ],
    [id, actual, month, month, BUDGET_TTL_SEC]
  );
  if (result === null) return { error: "unavailable" };
  if (result === -1) return { error: "missing" };
  return { ok: true, actual: Number(result) };
}

/** Release a reservation without charging it. Idempotent. */
export async function releaseProviderBudget(provider, id) {
  if (!budgetProvider(provider)) return { error: "unavailable" };
  const result = await cacheEval(RELEASE_SCRIPT, [reservationHashKey(provider)], [id]);
  if (result === null) return { error: "unavailable" };
  return result === 1 ? { ok: true } : { error: "missing" };
}

const THEIRSTACK_CREDIT_KEY = "mj-usage:theirstack:credits";

// TheirStack bills 1 API credit per returned record, so the contingent is
// tracked in credits (not requests). Cache hits cost 0.
export async function countTheirstackCredits(n) {
  if (!Number.isFinite(n) || n <= 0) return;
  await cacheIncrBy(monthScoped(THEIRSTACK_CREDIT_KEY), Math.floor(n), MONTH_TTL_SEC);
}

export async function theirstackCreditCount() {
  return readCount(THEIRSTACK_CREDIT_KEY);
}

export async function theirstackCreditLimitReached() {
  const cfg = getConfig();
  const used = await readCount(THEIRSTACK_CREDIT_KEY);
  return used >= cfg.theirstackMonthlyMaxCredits;
}

function theirstackUserCreditKey(identity) {
  return `mj-usage:theirstack:credits:user:${hashToken(identity?.sessionId)}`;
}

// Per-user monthly credit guard (anonymous session = user). Without identity
// there is nothing to attribute to, so callers skip user accounting and only
// the global guard applies.
export async function countTheirstackUserCredits(identity, n) {
  if (!identity?.sessionId || !Number.isFinite(n) || n <= 0) return;
  await cacheIncrBy(monthScoped(theirstackUserCreditKey(identity)), Math.floor(n), MONTH_TTL_SEC);
}

export async function theirstackUserCreditLimitReached(identity) {
  if (!identity?.sessionId) return false;
  const cfg = getConfig();
  const used = await readCount(theirstackUserCreditKey(identity));
  return used >= cfg.theirstackMaxCreditsPerUser;
}

export async function jobspipeUserCreditLimitReached(identity) {
  if (!identity?.sessionId) return false;
  const cfg = getConfig();
  const used = await readCount(jobspipeUserCreditKey(identity));
  return used >= cfg.jobspipeMaxCreditsPerUser;
}

const JOBSPIPE_CREDIT_KEY = "mj-usage:jobspipe:credits";

// JobsPipe bills credits per returned record, so the contingent is tracked
// in credits (not requests). Cache hits cost 0.
export async function countJobspipeCredits(n) {
  if (!Number.isFinite(n) || n <= 0) return;
  await cacheIncrBy(monthScoped(JOBSPIPE_CREDIT_KEY), Math.floor(n), MONTH_TTL_SEC);
}

export async function jobspipeCreditCount() {
  return readCount(JOBSPIPE_CREDIT_KEY);
}

export async function jobspipeCreditLimitReached() {
  const cfg = getConfig();
  const used = await readCount(JOBSPIPE_CREDIT_KEY);
  return used >= cfg.jobspipeMonthlyMaxCredits;
}

function jobspipeUserCreditKey(identity) {
  return `mj-usage:jobspipe:credits:user:${hashToken(identity?.sessionId)}`;
}

// Per-user monthly credit guard (anonymous session = user). Without identity
// there is nothing to attribute to, so callers skip user accounting and only
// the global guard applies.
export async function countJobspipeUserCredits(identity, n) {
  if (!identity?.sessionId || !Number.isFinite(n) || n <= 0) return;
  await cacheIncrBy(monthScoped(jobspipeUserCreditKey(identity)), Math.floor(n), MONTH_TTL_SEC);
}

export async function getUsageSnapshot() {
  const cfg = getConfig();
  const now = new Date();
  const edenaiKeys = providerKeys("edenai");
  return {
    generatedAt: now.toISOString(),
    month: currentMonth(),
    openRouter: {
      requestCount: await readCount(REQUEST_KEY),
      failureCount: await readCount(FAILURE_KEY),
      fallbackAttempts: await readCount(ATTEMPT_KEY),
      byModel: await cacheHGetAll(monthScoped(OPENROUTER_MODEL_KEY)),
    },
    edenai: {
      requestCount: await readCount(edenaiKeys.requests),
      failureCount: await readCount(edenaiKeys.failures),
      fallbackAttempts: await readCount(edenaiKeys.attempts),
      byModel: await cacheHGetAll(monthScoped(edenaiKeys.model)),
    },
    apify: {
      actorRuns: await readCount(APIFY_RUN_KEY),
      datasetReuses: await readCount(APIFY_REUSE_KEY),
      cacheHits: await readCount(APIFY_CACHE_HIT_KEY),
      cacheMisses: await readCount(APIFY_CACHE_MISS_KEY),
    },
    theirstack: {
      creditCount: await readCount(THEIRSTACK_CREDIT_KEY),
      creditLimit: cfg.theirstackMonthlyMaxCredits,
    },
    jobspipe: {
      creditCount: await readCount(JOBSPIPE_CREDIT_KEY),
      creditLimit: cfg.jobspipeMonthlyMaxCredits,
    },
    jobSources: {
      [ARBEITNOW_SOURCE_ID]: {
        requests: await readCount(jobSourceKeys(ARBEITNOW_SOURCE_ID).requests),
      },
      ...Object.fromEntries(
        await Promise.all(
          APIFY_ACTORS.map(async (actor) => [actor.sourceId, await readJobSourceCounts(actor.sourceId)])
        )
      ),
    },
    limits: {
      openRouterMonthlySoftLimitUsd: cfg.openRouterMonthlySoftLimitUsd,
      apifyMonthlySoftLimitUsd: cfg.apifyMonthlySoftLimitUsd,
      openRouterMonthlyMaxRequests: cfg.openRouterMonthlyMaxRequests,
      edenaiMonthlySoftLimitUsd: cfg.edenaiMonthlySoftLimitUsd,
      edenaiMonthlyMaxRequests: cfg.edenaiMonthlyMaxRequests,
      apifyMonthlyMaxRuns: cfg.apifyMonthlyMaxRuns,
      modelFallbackMaxAttempts: cfg.modelFallbackMaxAttempts,
      apifyDatasetRefreshPeakHours: cfg.apifyDatasetRefreshPeakHours,
      apifyDatasetRefreshOffpeakHours: cfg.apifyDatasetRefreshOffpeakHours,
      apifyDatasetRefreshTimezone: cfg.apifyDatasetRefreshTimezone,
      apifyDatasetRefreshPeakStart: cfg.apifyDatasetRefreshPeakStart,
      apifyDatasetRefreshPeakEnd: cfg.apifyDatasetRefreshPeakEnd,
    },
    notes: {
      openRouter:
        "Application-side request counter, not provider billing. The OpenRouter dashboard is authoritative for spend.",
      edenai:
        "Application-side request counter, not provider billing. The EdenAI dashboard is authoritative for spend.",
      apify:
        "Application-side run counter, not provider billing. The Apify console is authoritative for spend.",
      limits:
        "Soft limits are advisory operator thresholds. Guards use the application-side counter backstops (openRouterMonthlyMaxRequests / edenaiMonthlyMaxRequests / apifyMonthlyMaxRuns).",
    },
  };
}
