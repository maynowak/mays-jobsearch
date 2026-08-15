import { SOURCE_APIFY_ARBEITSAGENTUR, tokenize, locationMatches, keywordHits } from "./filter.mjs";
import { cacheGet, cacheSet, cacheDel } from "./cache.mjs";

const APIFY_ACTOR_ID = "blackfalcondata~arbeitsagentur-jobs-feed";
const APIFY_MAX_JOBS = 40;
const APIFY_SYNC_TIMEOUT_SEC = 50;
const APIFY_CACHE_TTL_SEC = 600;
const APIFY_DATASET_MAX_AGE_SEC = 24 * 60 * 60;

function cacheKeyFor(query, location) {
  return `apify-jobs:${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
}

function datasetKeyFor(query, location) {
  return `apify-dataset:${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
}

async function startApifyRun(apiToken, input) {
  let response;
  try {
    response = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${encodeURIComponent(apiToken)}`,
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

  let run;
  try {
    const data = await response.json();
    run = data?.data ?? data;
  } catch {
    return { error: "unreadable" };
  }
  if (!run || typeof run !== "object" || typeof run.id !== "string") {
    return { error: "unexpected" };
  }
  return { run };
}

async function waitForRun(apiToken, runId, maxWaitMs) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    let response;
    try {
      response = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(apiToken)}`,
        { headers: { "Accept": "application/json" } }
      );
    } catch {
      return { error: "network" };
    }

    if (!response.ok) {
      return { error: `upstream_${response.status}` };
    }

    let run;
    try {
      const data = await response.json();
      run = data?.data ?? data;
    } catch {
      return { error: "unreadable" };
    }
    if (!run || typeof run !== "object") {
      return { error: "unexpected" };
    }
    if (run.status === "SUCCEEDED") {
      return { run };
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
      return { error: `run_${run.status}` };
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { error: "run_timeout" };
}

async function readDataset(apiToken, datasetId) {
  let response;
  try {
    response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(apiToken)}`,
      { headers: { "Accept": "application/json" } }
    );
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: `upstream_${response.status}` };
  }

  let data;
  try {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[apify] dataset items body not JSON:", text.slice(0, 300));
      return { error: "unreadable" };
    }
  } catch {
    return { error: "unreadable" };
  }
  const records = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!records) {
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
  const datasetKey = datasetKeyFor(input.query, input.location);
  const cached = await cacheGet(cacheKey);
  let records = Array.isArray(cached) ? cached : null;
  let error = null;

  if (!records) {
    const dataset = await cacheGet(datasetKey);
    if (dataset && typeof dataset.datasetId === "string") {
      const fresh =
        Number.isFinite(dataset.createdAt) &&
        Date.now() - dataset.createdAt < APIFY_DATASET_MAX_AGE_SEC;
      if (fresh) {
        const read = await readDataset(apiToken, dataset.datasetId);
        if (read.records) {
          records = read.records;
        } else if (read.error.startsWith("upstream_4")) {
          console.error("[apify] L2 dataset gone:", dataset.datasetId, read.error);
          await cacheDel(datasetKey);
        } else {
          console.error("[apify] L2 dataset read failed (transient):", dataset.datasetId, read.error);
          return emptyResult(read.error);
        }
      } else {
        console.error("[apify] L2 dataset stale, ageSec:", dataset.createdAt ? Math.round((Date.now() - dataset.createdAt) / 1000) : "n/a");
      }
    }

    if (!records) {
      const started = await startApifyRun(apiToken, input);
      if (started.error) return emptyResult(started.error);
      const waited = await waitForRun(apiToken, started.run.id, APIFY_SYNC_TIMEOUT_SEC * 1000);
      if (waited.error) return emptyResult(waited.error);
      const read = await readDataset(apiToken, waited.run.defaultDatasetId);
      if (read.error) return emptyResult(read.error);
      records = read.records;
      if (records.length) {
        await cacheSet(
          datasetKey,
          { datasetId: waited.run.defaultDatasetId, createdAt: Date.now() },
          APIFY_DATASET_MAX_AGE_SEC
        );
      }
    }

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