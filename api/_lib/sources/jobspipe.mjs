import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../filter.mjs";
import { getConfig } from "../config.mjs";
import { cacheGet, cacheSet } from "../cache.mjs";
import {
  countJobSourceCacheHit,
  countJobSourceCacheMiss,
  countJobspipeCredits,
  countJobspipeUserCredits,
  jobspipeCreditLimitReached,
  jobspipeUserCreditLimitReached,
} from "../usage.mjs";

const API_BASE = "https://api.jobspipe.dev/v1/jobs/search";
// JobsPipe bills credits per returned record: keep the page small and
// consistent with the other sources. NOTE: `include_technologies` is NOT
// set — it costs 1 extra credit per job that names a technology.
const RESULTS_LIMIT = 40;
const MAX_JOBS_TO_AI = 40;
// L1 result cache (same pattern as the other key-based sources): repeated
// identical searches reuse the raw upstream payload instead of burning credits.
const CACHE_TTL_SEC = 600;
// Freshness guard: only postings from the last 30 days (same as TheirStack).
const POSTED_MAX_AGE_DAYS = 30;

const SOURCE_ID = "jobspipe";

export const id = SOURCE_ID;
export const displayName = "JobsPipe";
export const provider = "job-api";

export function enabled() {
  // Ehrlich: Flag UND API-Key (sonst nur missing_config-Leermengen).
  return getConfig().jobSourceJobspipeEnabled && jobspipeApiKey() !== null;
}

function jobspipeApiKey() {
  const key = (getConfig().jobspipeApiKey || "").trim();
  return key || null;
}

export async function fetchJobspipeJobs({ skills, targetRoles, targetRole, city, identity }) {
  const apiKey = jobspipeApiKey();
  if (!apiKey) {
    return emptyResult("missing_config");
  }

  // Backward compatibility: support both targetRoles (array) and targetRole (string)
  const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
  const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
  const cityQueries = String(city || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  // Without any search terms a broad "all recent jobs" fetch would burn up
  // to 40 credits for unfiltered results — same guard as the Apify source.
  if (!keywordTokens.length && !roles.length) {
    return emptyResult("no_query");
  }

  // Native server-side search. `skills_or` matches skill slugs (better than
  // description matching for known skills, per JobsPipe docs);
  // `job_title_or` matches title substrings; local filtering still applies
  // afterwards (consistent with all sources).
  const body = {
    skills_or: keywordTokens,
    limit: RESULTS_LIMIT,
    posted_at_max_age_days: POSTED_MAX_AGE_DAYS,
  };
  if (roles.length) body.job_title_or = roles;

  const cacheKey = `job-source:jobspipe:${JSON.stringify(body)}|${cityQueries.join(",")}`;
  const cached = await cacheGet(cacheKey);
  let rawJobs = Array.isArray(cached) ? cached : null;
  if (rawJobs) {
    await countJobSourceCacheHit(SOURCE_ID);
  } else {
    await countJobSourceCacheMiss(SOURCE_ID);
    if (await jobspipeCreditLimitReached()) {
      return emptyResult("limit_reached");
    }
    // Per-user monthly guard (anonymous session = user, 20 credits default).
    // Without identity there is nothing to attribute to — global guard above
    // still applies.
    if (identity && (await jobspipeUserCreditLimitReached(identity))) {
      return emptyResult("user_limit_reached");
    }
    rawJobs = await fetchJobspipeUpstream(apiKey, body);
    await countJobspipeCredits(rawJobs.length);
    if (identity) await countJobspipeUserCredits(identity, rawJobs.length);
    if (rawJobs.length) await cacheSet(cacheKey, rawJobs, CACHE_TTL_SEC);
  }

  const allJobs = rawJobs;

  const candidates = allJobs
    .map(normalizeJobspipeJob)
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

// Best-effort upstream error excerpt for server logs (no secrets: our key
// travels in the header, never in bodies). Truncated to 200 chars.
async function readErrorExcerpt(response) {
  try {
    const text = await response.text();
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean ? ` Details: ${clean.slice(0, 200)}` : "";
  } catch {
    return "";
  }
}

async function fetchJobspipeUpstream(apiKey, body) {
  let response;
  try {
    response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HttpError(502, "Couldn't reach JobsPipe API right now. Please try again in a moment.", "network");
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, `JobsPipe API rejected the credentials. Check JOBSPIPE_API_KEY.${await readErrorExcerpt(response)}`, "upstream");
  }
  if (response.status === 402) {
    throw new HttpError(502, `JobsPipe API credits are exhausted. Check the JobsPipe billing dashboard.${await readErrorExcerpt(response)}`, "upstream");
  }
  if (response.status === 429) {
    throw new HttpError(429, "JobsPipe API is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `JobsPipe API returned an error (HTTP ${response.status}). Try again shortly.${await readErrorExcerpt(response)}`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "JobsPipe API sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json.data)) {
    throw new HttpError(502, "JobsPipe API sent back an unexpected response. Try again shortly.", "upstream");
  }

  return json.data;
}

export function normalizeJobspipeJob(job) {
  const company =
    (job.company_object && typeof job.company_object.name === "string" && job.company_object.name.trim()) ||
    (typeof job.company === "string" ? job.company.trim() : "");
  const locationName =
    (typeof job.location === "string" && job.location.trim()) ||
    (typeof job.long_location === "string" && job.long_location.trim()) ||
    (Array.isArray(job.cities) && job.cities.length ? String(job.cities[0]).trim() : "");
  const allLocations = locationName ? [locationName] : [];

  const techSlugs = Array.isArray(job.technology_slugs) ? job.technology_slugs.filter(Boolean) : [];
  const keywordSlugs = Array.isArray(job.keyword_slugs) ? job.keyword_slugs.filter(Boolean) : [];
  const seniority = typeof job.seniority === "string" && job.seniority.trim() ? [job.seniority.trim()] : [];
  const tags = [...techSlugs.map(String), ...keywordSlugs.map(String), ...seniority];

  const descriptionHtml = typeof job.description === "string" ? job.description : "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.date_posted ? Date.parse(job.date_posted) : NaN;

  const remote = job.remote === true;
  const hybrid = job.hybrid === true;
  const workplaceType = remote ? "remote" : hybrid ? "hybrid" : undefined;

  const employmentStatuses = Array.isArray(job.employment_statuses)
    ? job.employment_statuses.map((s) => String(s).trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean)
    : [];

  const salaryString = typeof job.salary_string === "string" && job.salary_string.trim() ? job.salary_string.trim() : "";
  const toSalaryNumber = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const minSalary = toSalaryNumber(job.min_annual_salary_usd);
  const maxSalary = toSalaryNumber(job.max_annual_salary_usd);
  const salary =
    salaryString ||
    (Number.isFinite(minSalary) && Number.isFinite(maxSalary)
      ? `$${minSalary} - $${maxSalary}`
      : Number.isFinite(minSalary)
        ? `ab $${minSalary}`
        : Number.isFinite(maxSalary)
          ? `bis $${maxSalary}`
          : undefined);

  // External ID for deduplication
  const externalId = `jp-${job.id ?? "unknown"}`;

  return {
    slug: externalId,
    title: String(job.job_title || job.title || "").trim(),
    company_name: String(company || "").trim(),
    location: allLocations,
    remote,
    tags,
    url: (typeof job.url === "string" && job.url.trim()) || (typeof job.source_url === "string" && job.source_url.trim()) || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: employmentStatuses.length ? employmentStatuses : undefined,
    // JobsPipe-specific fields
    applyUrl: (typeof job.url === "string" && job.url.trim()) || undefined,
    jobUrl: (typeof job.source_url === "string" && job.source_url.trim()) || undefined,
    workplaceType,
    department: undefined, // not provided by JobsPipe
    salary,
    latitude: Number.isFinite(Number(job.latitude)) ? Number(job.latitude) : undefined,
    longitude: Number.isFinite(Number(job.longitude)) ? Number(job.longitude) : undefined,
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
  return fetchJobspipeJobs(params);
}
