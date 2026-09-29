import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../filter.mjs";
import { getConfig } from "../config.mjs";
import { cacheGet, cacheSet } from "../cache.mjs";
import { countJobSourceCacheHit, countJobSourceCacheMiss } from "../usage.mjs";

const API_BASE = "https://api.adzuna.com/v1/api/jobs";
const RESULTS_PER_PAGE = 50;
const MAX_JOBS_TO_AI = 40;
// L1 result cache (same pattern as Apify): repeated identical searches reuse
// the raw upstream payload instead of burning paid API quota.
const CACHE_TTL_SEC = 600;

const SOURCE_ID = "adzuna";

export const id = SOURCE_ID;
export const displayName = "Adzuna";
export const provider = "job-api";

export function enabled() {
  return getConfig().jobSourceAdzunaEnabled;
}

function adzunaCredentials() {
  const cfg = getConfig();
  const appId = (cfg.adzunaAppId || "").trim();
  const appKey = (cfg.adzunaAppKey || "").trim();
  if (!appId || !appKey) return null;
  return { appId, appKey };
}

function parseAdzunaCountries() {
  const countries = getConfig().adzunaCountries || "";
  return countries
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export async function fetchAdzunaJobs({ skills, targetRoles, targetRole, city }) {
  const credentials = adzunaCredentials();
  if (!credentials) {
    return emptyResult("missing_config");
  }
  const countries = parseAdzunaCountries();
  if (!countries.length) {
    return emptyResult("no_countries_configured");
  }

  // Backward compatibility: support both targetRoles (array) and targetRole (string)
  const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
  const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
  const cityQueries = String(city || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  // Native server-side search: keywords as `what`, city as `where`.
  // Local filtering still applies afterwards (consistent with all sources).
  const what = keywordTokens.join(" ");
  const where = cityQueries.join(" ");

  const allJobs = [];
  let firstError = null;

  for (const country of countries) {
    try {
      const jobs = await fetchCountryJobsCached(country, credentials, what, where);
      allJobs.push(...jobs);
    } catch (err) {
      console.error(`[adzuna] Country ${country} failed:`, err);
      // Continue with other countries, but remember the error: if NOTHING
      // was fetched at all (e.g. single country with bad credentials),
      // surfacing it beats a silent empty result.
      if (!firstError) firstError = err;
    }
  }

  if (!allJobs.length && firstError) throw firstError;

  const candidates = allJobs
    .map((entry) => normalizeAdzunaJob(entry.job, entry.country))
    .filter((job) => {
      if (!locationMatches(job, cityQueries)) return false;
      if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
      return true;
    });

  const ranked = candidates
    .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
    .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
    .map(({ job }) => job);

  return {
    jobs: ranked.slice(0, MAX_JOBS_TO_AI),
    meta: {
      enabled: true,
      reason: null,
      totalScanned: allJobs.length,
      totalFiltered: ranked.length,
    },
  };
}

function countryCacheKey(country, what, where) {
  return `job-source:adzuna:${country}|${String(what || "").toLowerCase().trim()}|${String(where || "").toLowerCase().trim()}`;
}

async function fetchCountryJobsCached(country, credentials, what, where) {
  const key = countryCacheKey(country, what, where);
  const cached = await cacheGet(key);
  if (Array.isArray(cached)) {
    await countJobSourceCacheHit(SOURCE_ID);
    return cached;
  }
  await countJobSourceCacheMiss(SOURCE_ID);
  const jobs = await fetchCountryJobs(country, credentials, what, where);
  if (jobs.length) await cacheSet(key, jobs, CACHE_TTL_SEC);
  return jobs;
}

async function fetchCountryJobs(country, { appId, appKey }, what, where) {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(RESULTS_PER_PAGE),
    "content-type": "application/json",
  });
  if (what) params.set("what", what);
  if (where) params.set("where", where);
  const url = `${API_BASE}/${encodeURIComponent(country)}/search/1?${params.toString()}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Adzuna API right now. Please try again in a moment.", "network");
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, "Adzuna API rejected the credentials. Check ADZUNA_APP_ID/ADZUNA_APP_KEY.", "upstream");
  }
  if (response.status === 404) {
    throw new HttpError(404, `Adzuna country "${country}" not found.`, "not_found");
  }
  if (response.status === 429) {
    throw new HttpError(429, "Adzuna API is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `Adzuna API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "Adzuna API sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json.results)) {
    throw new HttpError(502, "Adzuna API sent an unexpected response. Try again shortly.", "upstream");
  }

  return json.results.map((job) => ({ job, country }));
}

function formatAdzunaSalary(min, max) {
  const hasMin = Number.isFinite(Number(min)) && Number(min) > 0;
  const hasMax = Number.isFinite(Number(max)) && Number(max) > 0;
  if (hasMin && hasMax) return `${min} - ${max}`;
  if (hasMin) return `ab ${min}`;
  if (hasMax) return `bis ${max}`;
  return undefined;
}

export function normalizeAdzunaJob(job, country = "") {
  const company = job.company?.display_name || "";
  const locationName = job.location?.display_name || "";
  const areas = Array.isArray(job.location?.area) ? job.location.area.filter(Boolean) : [];
  const allLocations = [...new Set([locationName, ...areas].filter(Boolean))];

  const category = job.category?.label || "";
  const tags = [category].filter(Boolean);

  const descriptionHtml = job.description || "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.created ? Date.parse(job.created) : NaN;

  const lat = Number(job.latitude);
  const lon = Number(job.longitude);

  const remote =
    locationName.toLowerCase().includes("remote") ||
    allLocations.some((l) => l.toLowerCase().includes("remote"));

  const contractTime = typeof job.contract_time === "string" ? job.contract_time.trim().toLowerCase().replace(/\s+/g, "_") : "";

  // External ID for deduplication (per country feed)
  const externalId = `az-${country || "xx"}-${job.id}`;

  return {
    slug: externalId,
    title: String(job.title || "").trim(),
    company_name: String(company || "").trim(),
    location: allLocations,
    remote,
    tags,
    url: job.redirect_url || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: contractTime ? [contractTime] : undefined,
    // Adzuna-specific fields
    applyUrl: job.redirect_url || undefined,
    jobUrl: job.redirect_url || undefined,
    workplaceType: remote ? "remote" : undefined,
    department: category || undefined,
    salary: formatAdzunaSalary(job.salary_min, job.salary_max),
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lon) ? lon : undefined,
    externalId,
  };
}

function emptyResult(reason) {
  return {
    jobs: [],
    meta: { enabled: false, reason, totalScanned: 0, totalFiltered: 0 },
  };
}

export async function fetchJobs(params) {
  return fetchAdzunaJobs(params);
}

// Backwards compatibility exports
export { SOURCE_ID };
