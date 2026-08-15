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
  await cacheIncr(monthScoped(REQUEST_KEY), MONTH_TTL_SEC);
  if (model) await cacheHIncrBy(monthScoped(OPENROUTER_MODEL_KEY), String(model), 1, MONTH_TTL_SEC);
}

export async function countOpenRouterFailure() {
  await cacheIncr(monthScoped(FAILURE_KEY), MONTH_TTL_SEC);
}

export async function countOpenRouterAttempt() {
  await cacheIncr(monthScoped(ATTEMPT_KEY), MONTH_TTL_SEC);
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
  const cfg = getConfig();
  const requests = await readCount(REQUEST_KEY);
  return requests >= cfg.openRouterMonthlyMaxRequests;
}

export async function apifyRunLimitReached() {
  const cfg = getConfig();
  const runs = await readCount(APIFY_RUN_KEY);
  return runs >= cfg.apifyMonthlyMaxRuns;
}

export async function getUsageSnapshot() {
  const cfg = getConfig();
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    month: currentMonth(),
    openRouter: {
      requestCount: await readCount(REQUEST_KEY),
      failureCount: await readCount(FAILURE_KEY),
      fallbackAttempts: await readCount(ATTEMPT_KEY),
      byModel: await cacheHGetAll(monthScoped(OPENROUTER_MODEL_KEY)),
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
      apifyMonthlyMaxRuns: cfg.apifyMonthlyMaxRuns,
      modelFallbackMaxAttempts: cfg.modelFallbackMaxAttempts,
      apifyDatasetRefreshPeakHours: cfg.apifyDatasetRefreshPeakHours,
      apifyDatasetRefreshOffpeakHours: cfg.apifyDatasetRefreshOffpeakHours,
    },
    notes: {
      openRouter:
        "Application-side request counter, not provider billing. The OpenRouter dashboard is authoritative for spend.",
      apify:
        "Application-side run counter, not provider billing. The Apify console is authoritative for spend.",
      limits:
        "Soft limits are advisory operator thresholds. Guards use the application-side counter backstops (openRouterMonthlyMaxRequests / apifyMonthlyMaxRuns).",
    },
  };
}
