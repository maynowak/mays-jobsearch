import { SOURCE_APIFY_ARBEITSAGENTUR, tokenize, locationMatches, keywordHits } from "./filter.mjs";
import { cacheGet, cacheSet } from "./cache.mjs";

const APIFY_ACTOR_ID = "blackfalcondata~arbeitsagentur-jobs-feed";
const APIFY_MAX_JOBS = 40;
const APIFY_SYNC_TIMEOUT_SEC = 50;
const APIFY_CACHE_TTL_SEC = 600;

function cacheKeyFor(query, location) {
  return `apify-jobs:${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
}

async function runApify(apiToken, input) {
  let response;
  try {
    response = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(apiToken)}&timeout=${APIFY_SYNC_TIMEOUT_SEC}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: `upstream_${response.status}` };
  }

  let records;
  try {
    records = await response.json();
  } catch {
    return { error: "unreadable" };
  }
  if (!Array.isArray(records)) {
    return { error: "unexpected" };
  }
  return { records };
}

function normalizeJob(record) {
  const published = record.publishedDate ? Date.parse(record.publishedDate) : NaN;
  const location = record.location ? [String(record.location).trim()].filter(Boolean) : [];
  const slugSource = record.referenceId || record.contentHash || record.title || "job";
  return {
    slug: `aa-${String(slugSource).replace(/\s+/g, "-")}`,
    title: String(record.title || "").trim(),
    company_name: String(record.employer || "").trim(),
    location,
    remote: record.isRemote === true,
    tags: [],
    url: String(record.portalUrl || "").trim(),
    created_at: Number.isFinite(published) ? Math.floor(published / 1000) : undefined,
    source: [SOURCE_APIFY_ARBEITSAGENTUR],
  };
}

function emptyResult(reason) {
  return {
    jobs: [],
    meta: { enabled: false, reason, totalScanned: 0, totalFiltered: 0 },
  };
}

export async function fetchArbeitsagenturJobs({ skills, targetRole, city }) {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    return emptyResult("missing_config");
  }

  const query = String(targetRole || skills || "").trim();
  if (!query) {
    return emptyResult("no_query");
  }

  const input = {
    query,
    location: String(city || "").trim(),
    maxResults: APIFY_MAX_JOBS,
    mode: "full",
    includeDetails: false,
    compact: true,
    excludeEmptyFields: false,
  };

  const cacheKey = cacheKeyFor(input.query, input.location);
  const cached = await cacheGet(cacheKey);
  let records = Array.isArray(cached) ? cached : null;
  let error = null;

  if (!records) {
    const run = await runApify(apiToken, input);
    if (run.error) return emptyResult(run.error);
    records = run.records;
    if (records.length) await cacheSet(cacheKey, records, APIFY_CACHE_TTL_SEC);
  }

  const keywordTokens = [...tokenize(targetRole), ...tokenize(skills)];
  const cityQueries = String(city || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const candidates = records.map(normalizeJob).filter((job) => {
    if (!locationMatches(job, cityQueries)) return false;
    if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
    return true;
  });

  const ranked = candidates
    .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
    .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
    .map(({ job }) => job);

  return {
    jobs: ranked.slice(0, APIFY_MAX_JOBS),
    meta: {
      enabled: true,
      reason: null,
      totalScanned: records.length,
      totalFiltered: ranked.length,
    },
  };
}