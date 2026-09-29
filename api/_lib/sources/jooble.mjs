import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../filter.mjs";
import { getConfig } from "../config.mjs";

const API_BASE = "https://jooble.org/api";
const MAX_JOBS_TO_AI = 40;

const SOURCE_ID = "jooble";

export const id = SOURCE_ID;
export const displayName = "Jooble";
export const provider = "job-api";

export function enabled() {
  return getConfig().jobSourceJoobleEnabled;
}

function joobleApiKey() {
  const key = (getConfig().joobleApiKey || "").trim();
  return key || null;
}

export async function fetchJoobleJobs({ skills, targetRoles, targetRole, city }) {
  const apiKey = joobleApiKey();
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

  // Native server-side search via POST body. Local filtering still applies
  // afterwards (consistent with all sources).
  const keywords = keywordTokens.join(" ");
  const location = cityQueries.join(" ");

  const url = `${API_BASE}/${encodeURIComponent(apiKey)}`;
  const body = {};
  if (keywords) body.keywords = keywords;
  if (location) body.location = location;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Jooble API right now. Please try again in a moment.", "network");
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, "Jooble API rejected the credentials. Check JOOBLE_API_KEY.", "upstream");
  }
  if (response.status === 429) {
    throw new HttpError(429, "Jooble API is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `Jooble API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "Jooble API sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json.jobs)) {
    throw new HttpError(502, "Jooble API sent an unexpected response. Try again shortly.", "upstream");
  }

  const allJobs = json.jobs;

  const candidates = allJobs
    .map(normalizeJoobleJob)
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

export function normalizeJoobleJob(job) {
  const locationName = typeof job.location === "string" ? job.location.trim() : "";
  const allLocations = locationName ? [locationName] : [];

  const type = typeof job.type === "string" ? job.type.trim() : "";
  const tags = type ? [type] : [];

  // Jooble `snippet` is plain text with <b> highlights
  const descriptionHtml = typeof job.snippet === "string" ? job.snippet : "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.updated ? Date.parse(job.updated) : NaN;

  const remote =
    locationName.toLowerCase().includes("remote") ||
    type.toLowerCase().includes("remote");

  const salary = typeof job.salary === "string" && job.salary.trim() ? job.salary.trim() : undefined;

  // External ID for deduplication
  const externalId = `jo-${job.id ?? `${String(job.title || "").slice(0, 32)}-${locationName}`.replace(/\s+/g, "-")}`;

  return {
    slug: externalId,
    title: String(job.title || "").trim(),
    company_name: String(job.company || "").trim(),
    location: allLocations,
    remote,
    tags,
    url: typeof job.link === "string" ? job.link.trim() : "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: type ? [type.toLowerCase().replace(/\s+/g, "_")] : undefined,
    // Jooble-specific fields
    applyUrl: typeof job.link === "string" && job.link.trim() ? job.link.trim() : undefined,
    jobUrl: typeof job.link === "string" && job.link.trim() ? job.link.trim() : undefined,
    workplaceType: remote ? "remote" : undefined,
    department: undefined, // not provided by Jooble
    salary,
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
  return fetchJoobleJobs(params);
}

// Backwards compatibility exports
export { SOURCE_ID };
