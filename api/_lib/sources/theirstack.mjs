import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../filter.mjs";
import { getConfig } from "../config.mjs";
import { cacheGet, cacheSet } from "../cache.mjs";
import {
  countJobSourceCacheHit,
  countJobSourceCacheMiss,
  countTheirstackCredits,
  countTheirstackUserCredits,
  theirstackCreditLimitReached,
  theirstackUserCreditLimitReached,
} from "../usage.mjs";

const API_BASE = "https://api.theirstack.com/v1/jobs/search";
// TheirStack bills 1 API credit per returned record: keep the page small.
// Limit 25 = documented default + example value (a higher limit is a
// 422-candidate on small plans); local pool cap stays 40.
const RESULTS_LIMIT = 25;
const MAX_JOBS_TO_AI = 40;
// L1 result cache (same pattern as the other key-based sources): repeated
// identical searches reuse the raw upstream payload instead of burning credits.
const CACHE_TTL_SEC = 600;
// The API rejects requests without at least one date/company filter.
const POSTED_MAX_AGE_DAYS = 30;

const SOURCE_ID = "theirstack";

export const id = SOURCE_ID;
export const displayName = "Theirstack";
export const provider = "job-api";

export function enabled() {
  // Ehrlich: Flag UND API-Key (sonst nur missing_config-Leermengen).
  return getConfig().jobSourceTheirstackEnabled && theirstackApiKey() !== null;
}

function theirstackApiKey() {
  const key = (getConfig().theirstackApiKey || "").trim();
  return key || null;
}

export async function fetchTheirstackJobs({ skills, targetRoles, targetRole, city, identity }) {
  const apiKey = theirstackApiKey();
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

  // Native server-side search. `job_description_contains_or` matches whole
  // words (no regex-escaping pitfalls); `job_title_or` matches all words of
  // a pattern in any order. Local filtering still applies afterwards
  // (consistent with all sources).
  const body = {
    job_description_contains_or: keywordTokens,
    limit: RESULTS_LIMIT,
    page: 0,
    posted_at_max_age_days: POSTED_MAX_AGE_DAYS,
  };
  if (roles.length) body.job_title_or = roles;

  const cacheKey = `job-source:theirstack:${JSON.stringify(body)}|${cityQueries.join(",")}`;
  const cached = await cacheGet(cacheKey);
  let rawJobs = Array.isArray(cached) ? cached : null;
  if (rawJobs) {
    await countJobSourceCacheHit(SOURCE_ID);
  } else {
    await countJobSourceCacheMiss(SOURCE_ID);
    if (await theirstackCreditLimitReached()) {
      return emptyResult("limit_reached");
    }
    // Per-user monthly guard (anonymous session = user, 20 credits default).
    // Without identity there is nothing to attribute to — global guard above
    // still applies.
    if (identity && (await theirstackUserCreditLimitReached(identity))) {
      return emptyResult("user_limit_reached");
    }
    rawJobs = await fetchTheirstackUpstream(apiKey, body);
    await countTheirstackCredits(rawJobs.length);
    if (identity) await countTheirstackUserCredits(identity, rawJobs.length);
    if (rawJobs.length) await cacheSet(cacheKey, rawJobs, CACHE_TTL_SEC);
  }

  const allJobs = rawJobs;

  const candidates = allJobs
    .map(normalizeTheirstackJob)
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

async function fetchTheirstackUpstream(apiKey, body) {
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
    throw new HttpError(502, "Couldn't reach Theirstack API right now. Please try again in a moment.", "network");
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, `Theirstack API rejected the credentials. Check THEIRSTACK_API_KEY.${await readErrorExcerpt(response)}`, "upstream");
  }
  if (response.status === 402) {
    throw new HttpError(502, `Theirstack API credits are exhausted. Check the TheirStack billing dashboard.${await readErrorExcerpt(response)}`, "upstream");
  }
  if (response.status === 429) {
    throw new HttpError(429, "Theirstack API is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `Theirstack API returned an error (HTTP ${response.status}). Try again shortly.${await readErrorExcerpt(response)}`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "Theirstack API sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json.data)) {
    throw new HttpError(502, "Theirstack API sent an unexpected response. Try again shortly.", "upstream");
  }

  return json.data;
}

export function normalizeTheirstackJob(job) {
  const company =
    (job.company_object && typeof job.company_object.name === "string" && job.company_object.name.trim()) ||
    (typeof job.company === "string" ? job.company.trim() : "");
  const locationName =
    (typeof job.location === "string" && job.location.trim()) ||
    (typeof job.long_location === "string" && job.long_location.trim()) ||
    "";
  const allLocations = locationName ? [locationName] : [];

  const techSlugs = Array.isArray(job.technology_slugs) ? job.technology_slugs.filter(Boolean) : [];
  const seniority = typeof job.seniority === "string" && job.seniority.trim() ? [job.seniority.trim()] : [];
  const tags = [...techSlugs.map(String), ...seniority];

  // Description is markdown; plain text derived the standard way.
  const descriptionHtml = typeof job.description === "string" ? job.description : "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.date_posted ? Date.parse(job.date_posted) : NaN;

  const lat = Number(job.latitude);
  const lon = Number(job.longitude);

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
  const externalId = `ts-${job.id ?? "unknown"}`;

  return {
    slug: externalId,
    title: String(job.title || job.job_title || "").trim(),
    company_name: String(company || "").trim(),
    location: allLocations,
    remote,
    tags,
    url: (typeof job.final_url === "string" && job.final_url.trim()) || (typeof job.url === "string" && job.url.trim()) || (typeof job.source_url === "string" && job.source_url.trim()) || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: employmentStatuses.length ? employmentStatuses : undefined,
    // Theirstack-specific fields
    applyUrl: (typeof job.final_url === "string" && job.final_url.trim()) || undefined,
    jobUrl: (typeof job.url === "string" && job.url.trim()) || undefined,
    workplaceType,
    department: undefined, // not provided by TheirStack
    salary,
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
  return fetchTheirstackJobs(params);
}

// Backwards compatibility exports
export { SOURCE_ID };
