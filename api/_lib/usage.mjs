import { getConfig } from "./config.mjs";
import { cacheGet, cacheHGetAll, cacheHIncrBy, cacheIncr } from "./cache.mjs";

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
