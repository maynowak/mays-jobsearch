import {
  HttpError,
  tokenize,
  stripHtml,
  htmlToPlainText,
  locationMatches,
  keywordHits,
  detectLanguage,
} from "../filter.mjs";
import { getConfig } from "../config.mjs";

const API_BASE = "https://www.arbeitnow.com/api/job-board-api";
const MAX_JOBS_TO_AI = 40;

const SOURCE_ID = "arbeitnow";

export const id = SOURCE_ID;
export const displayName = "Arbeitnow";
export const provider = "direct-api";
export const critical = true;

export function enabled() {
  return getConfig().jobSourceArbeitnowEnabled;
}

export async function fetchArbeitnow() {
  let response;
  try {
    response = await fetch(API_BASE, {
      headers: { "Accept": "application/json" },
    });
  } catch {
    throw new HttpError(502, "Couldn't reach the job board right now. Please try again in a moment.", "network");
  }

  if (response.status === 429) {
    throw new HttpError(429, "The job board is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `The job board returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "The job board sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json.data)) {
    throw new HttpError(502, "The job board sent an unexpected response. Try again shortly.", "upstream");
  }
  return json.data;
}

function compactJob(job) {
  const loc = job.location || [];
  const descriptionHtml = job.description || "";
  const descriptionPlain = htmlToPlainText(descriptionHtml);
  return {
    slug: job.slug,
    title: job.title,
    company_name: job.company_name,
    location: Array.isArray(loc) ? loc : [loc],
    remote: job.remote === true,
    tags: job.tags || [],
    url: job.url,
    created_at: job.created_at,
    source: [SOURCE_ID],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes:
      Array.isArray(job.job_types) && job.job_types.length ? job.job_types : undefined,
  };
}

export async function fetchFilteredJobs({ skills, targetRole, city }) {
  const jobs = await fetchArbeitnow();

  const keywordTokens = [...tokenize(targetRole), ...tokenize(skills)];
  const cityQueries = String(city || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const candidates = jobs.filter((job) => {
    if (!locationMatches(job, cityQueries)) return false;
    if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
    return true;
  });

  const ranked = candidates
    .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
    .sort((a, b) => b.hits - a.hits || b.job.created_at - a.job.created_at)
    .map(({ job }) => compactJob(job));

  return {
    jobs: ranked.slice(0, MAX_JOBS_TO_AI),
    meta: {
      totalScanned: jobs.length,
      totalFiltered: ranked.length,
      city: cityQueries,
      keywords: keywordTokens,
    },
  };
}

export async function fetchJobs(params) {
  return fetchFilteredJobs(params);
}

// Backwards compatibility exports
export { SOURCE_ID, compactJob };