function parsePositiveNumber(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const n = Math.floor(parsePositiveNumber(value, fallback));
  return Math.max(1, n);
}

function parseBoolean(value, fallback) {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

function parseTimezone(value, fallback) {
  const tz = String(value || "").trim();
  if (!tz) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

function parseClockTime(value, fallback) {
  const s = String(value || "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return fallback;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutesOfDay(clock) {
  const m = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minuteOfDayInZone(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
    return hour * 60 + minute;
  } catch {
    return NaN;
  }
}

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
    apifyDatasetRefreshTimezone: parseTimezone(
      process.env.APIFY_DATASET_REFRESH_TIMEZONE,
      "Europe/Berlin"
    ),
    apifyDatasetRefreshPeakStart: parseClockTime(
      process.env.APIFY_DATASET_REFRESH_PEAK_START,
      "08:00"
    ),
    apifyDatasetRefreshPeakEnd: parseClockTime(
      process.env.APIFY_DATASET_REFRESH_PEAK_END,
      "18:00"
    ),
    openRouterMonthlyMaxRequests: parsePositiveInt(
      process.env.OPENROUTER_MONTHLY_MAX_REQUESTS,
      1000
    ),
    apifyMonthlyMaxRuns: parsePositiveInt(process.env.APIFY_MONTHLY_MAX_RUNS, 30),
    apifyDetailMaxPerUserPerDay: parsePositiveInt(
      process.env.APIFY_DETAIL_MAX_PER_USER_PER_DAY,
      30
    ),
    apifyDetailMaxPerIpPerDay: parsePositiveInt(
      process.env.APIFY_DETAIL_MAX_PER_IP_PER_DAY,
      100
    ),
    openRouterEnabled: parseBoolean(process.env.OPENROUTER_ENABLED, true),
    edenaiEnabled: parseBoolean(process.env.EDENAI_ENABLED, true),
    jobSourceArbeitnowEnabled: parseBoolean(
      process.env.JOB_SOURCE_ARBEITNOW_ENABLED,
      true
    ),
    jobSourceArbeitsagenturEnabled: parseBoolean(
      process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED,
      true
    ),
    edenaiMonthlySoftLimitUsd: parsePositiveNumber(
      process.env.EDENAI_MONTHLY_SOFT_LIMIT_USD,
      1.0
    ),
    edenaiMonthlyMaxRequests: parsePositiveInt(
      process.env.EDENAI_MONTHLY_MAX_REQUESTS,
      200
    ),
  };
}

export function isPeakTime(date = new Date()) {
  const cfg = getConfig();
  const nowMin = minuteOfDayInZone(date, cfg.apifyDatasetRefreshTimezone);
  const startMin = toMinutesOfDay(cfg.apifyDatasetRefreshPeakStart);
  const endMin = toMinutesOfDay(cfg.apifyDatasetRefreshPeakEnd);
  if (!Number.isFinite(nowMin) || !Number.isFinite(startMin) || !Number.isFinite(endMin)) return false;
  if (endMin <= startMin) return false;
  return nowMin >= startMin && nowMin < endMin;
}

export function datasetRefreshHours(date = new Date()) {
  const cfg = getConfig();
  return isPeakTime(date) ? cfg.apifyDatasetRefreshPeakHours : cfg.apifyDatasetRefreshOffpeakHours;
}

export function datasetRefreshMs(date = new Date()) {
  return datasetRefreshHours(date) * 60 * 60 * 1000;
}
