function parsePositiveNumber(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const n = Math.floor(parsePositiveNumber(value, fallback));
  return Math.max(1, n);
}

const PEAK_START_HOUR = 8;
const PEAK_END_HOUR = 18;

export function getConfig() {
  return {
    openRouterMonthlySoftLimitUsd: parsePositiveNumber(
      process.env.OPENROUTER_MONTHLY_SOFT_LIMIT_USD,
      0.8
    ),
    apifyMonthlySoftLimitUsd: parsePositiveNumber(process.env.APIFY_MONTHLY_SOFT_LIMIT_USD, 4.0),
    modelFallbackMaxAttempts: parsePositiveInt(process.env.MODEL_FALLBACK_MAX_ATTEMPTS, 3),
    apifyDatasetRefreshPeakHours: parsePositiveNumber(
      process.env.APIFY_DATASET_REFRESH_PEAK_HOURS,
      6
    ),
    apifyDatasetRefreshOffpeakHours: parsePositiveNumber(
      process.env.APIFY_DATASET_REFRESH_OFFPEAK_HOURS,
      12
    ),
    openRouterMonthlyMaxRequests: parsePositiveInt(
      process.env.OPENROUTER_MONTHLY_MAX_REQUESTS,
      1000
    ),
    apifyMonthlyMaxRuns: parsePositiveInt(process.env.APIFY_MONTHLY_MAX_RUNS, 30),
  };
}

export function isPeakTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= PEAK_START_HOUR && hour < PEAK_END_HOUR;
}

export function datasetRefreshHours(date = new Date()) {
  const cfg = getConfig();
  return isPeakTime(date) ? cfg.apifyDatasetRefreshPeakHours : cfg.apifyDatasetRefreshOffpeakHours;
}

export function datasetRefreshMs(date = new Date()) {
  return datasetRefreshHours(date) * 60 * 60 * 1000;
}
