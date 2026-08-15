import { tokenize, locationMatches, keywordHits } from "../../filter.mjs";
import { cacheGet, cacheSet, cacheDel } from "../../cache.mjs";
import { datasetRefreshMs } from "../../config.mjs";
import {
  apifyRunLimitReached,
  countApifyCacheHit,
  countApifyCacheMiss,
  countApifyDatasetReuse,
  countApifyRun,
  countJobSourceCacheHit,
  countJobSourceCacheMiss,
  countJobSourceDatasetReuse,
  countJobSourceRun,
} from "../../usage.mjs";
import { startApifyRun, waitForRun, readDataset } from "./client.mjs";

const APIFY_SYNC_TIMEOUT_SEC = 50;
const APIFY_CACHE_TTL_SEC = 600;

export function jobCacheKey(sourceId, query, location) {
  return `job-source:${sourceId}:${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
}

export function datasetCacheKey(sourceId, query, location) {
  return `job-source:${sourceId}:dataset:${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
}

export function emptyResult(reason) {
  return {
    jobs: [],
    meta: { enabled: false, reason, totalScanned: 0, totalFiltered: 0 },
  };
}

export async function fetchActorJobs(actor, { skills, targetRole, city }) {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    return emptyResult("missing_config");
  }

  const query = String(targetRole || skills || "").trim();
  if (!query) {
    return emptyResult("no_query");
  }

  const location = String(city || "").trim();
  const input = actor.buildInput(query, location, actor.maxJobs);

  const cacheKey = jobCacheKey(actor.sourceId, input.query, input.location);
  const datasetKey = datasetCacheKey(actor.sourceId, input.query, input.location);
  const refreshMs = datasetRefreshMs();
  const cached = await cacheGet(cacheKey);
  let records = Array.isArray(cached) ? cached : null;

  if (records) {
    await countApifyCacheHit();
    await countJobSourceCacheHit(actor.sourceId);
  } else {
    await countApifyCacheMiss();
    await countJobSourceCacheMiss(actor.sourceId);

    const dataset = await cacheGet(datasetKey);
    if (dataset && typeof dataset.datasetId === "string") {
      const fresh =
        Number.isFinite(dataset.createdAt) &&
        Date.now() - dataset.createdAt < refreshMs;
      if (fresh) {
        const read = await readDataset(apiToken, dataset.datasetId);
        if (read.records) {
          records = read.records;
          await countApifyDatasetReuse();
          await countJobSourceDatasetReuse(actor.sourceId);
        } else if (read.error === "upstream_404" || read.error === "upstream_410") {
          console.error("[apify] L2 dataset gone:", dataset.datasetId, read.error);
          await cacheDel(datasetKey);
        } else {
          console.error("[apify] L2 dataset read failed (transient):", dataset.datasetId, read.error);
          return emptyResult(read.error);
        }
      }
    }

    if (!records) {
      if (await apifyRunLimitReached()) {
        return emptyResult("limit_reached");
      }
      const started = await startApifyRun(apiToken, actor.actorId, input);
      if (started.error) return emptyResult(started.error);
      await countApifyRun();
      await countJobSourceRun(actor.sourceId);
      const waited = await waitForRun(apiToken, started.run.id, APIFY_SYNC_TIMEOUT_SEC * 1000);
      if (waited.error) return emptyResult(waited.error);
      const read = await readDataset(apiToken, waited.run.defaultDatasetId);
      if (read.error) return emptyResult(read.error);
      records = read.records;
      if (records.length) {
        await cacheSet(
          datasetKey,
          { datasetId: waited.run.defaultDatasetId, createdAt: Date.now() },
          Math.round(refreshMs / 1000)
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

  const candidates = records.map(actor.normalize).filter((job) => {
    if (!locationMatches(job, cityQueries)) return false;
    if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
    return true;
  });

  const ranked = candidates
    .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
    .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
    .map(({ job }) => job);

  return {
    jobs: ranked.slice(0, actor.maxJobs),
    meta: {
      enabled: true,
      reason: null,
      totalScanned: records.length,
      totalFiltered: ranked.length,
    },
  };
}

export function createApifySource(actor) {
  return {
    id: actor.sourceId,
    displayName: actor.displayName,
    provider: "apify",
    actorId: actor.actorId,
    maxJobs: actor.maxJobs,
    enabled: actor.enabled,
    fetchJobs: (params) => fetchActorJobs(actor, params),
  };
}