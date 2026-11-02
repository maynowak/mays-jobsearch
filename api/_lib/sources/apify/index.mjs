import { tokenize, locationMatches, keywordHits } from "../../filter.mjs";
import { cacheGet, cacheSet, cacheDel } from "../../cache.mjs";
import { datasetRefreshMs } from "../../config.mjs";
import {
  countApifyCacheHit,
  countApifyCacheMiss,
  countApifyDatasetReuse,
  countJobSourceCacheHit,
  countJobSourceCacheMiss,
  countJobSourceDatasetReuse,
  countJobSourceRun,
  refundApifyRunSlot,
  reserveApifyRunSlot,
} from "../../usage.mjs";
import { startApifyRun, waitForRun, readDataset, startErrorDefinitelyNotStarted } from "./client.mjs";
import { ipQuotaConfig, releaseIpQuota, reserveIpQuota } from "../../ipQuota.mjs";
import { runPaidOnce, singleFlightKey } from "../../lock.mjs";

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

export async function fetchActorJobs(actor, { skills, targetRoles, targetRole, city, geo, identity }) {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    return emptyResult("missing_config");
  }

  // Backward compatibility: support both targetRoles (array) and targetRole (string).
  // skills ist ein Array — explizit mit Space joinen (String(array) ergäbe
  // Komma-Join wie "Docker,Kubernetes", was Actors ggf. nichts finden lässt).
  const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
  const skillQuery = Array.isArray(skills) ? skills.join(" ") : String(skills || "");
  const query = String(roles[0] || skillQuery || "").trim();
  if (!query) {
    return emptyResult("no_query");
  }

  const location = String(city || "").trim();
  const input = actor.buildInput(query, location, actor.maxJobs);
  // Umkreis-Koordinaten additiv mitgeben (Actors ignorieren unbekannte Felder).
  if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
    input.latitude = geo.lat;
    input.longitude = geo.lon;
    if (Number.isFinite(geo.radiusKm)) input.radiusKm = geo.radiusKm;
  }

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
      const lockKey = singleFlightKey(actor.sourceId, input);
      let earlyResult = null;
      const flight = await runPaidOnce({
        cacheKey,
        lockKey,
        ttlMs: 55_000,
        waitMs: 3_000,
        run: async () => {
          let ipReceipt = null;
          const ipScope = identity?.ipScope;
          if (ipQuotaConfig().enabled) {
            if (!ipScope) { earlyResult = emptyResult("quota_unavailable"); return []; }
            const ipResult = await reserveIpQuota(actor.sourceId, ipScope);
            if (ipResult.status === "limit_reached") { earlyResult = emptyResult("limit_reached"); return []; }
            if (ipResult.status !== "allowed") { earlyResult = emptyResult("quota_unavailable"); return []; }
            ipReceipt = ipResult.receipt;
          }
          const slot = await reserveApifyRunSlot();
          if (slot.error === "exceeded") {
            if (ipReceipt) await releaseIpQuota(actor.sourceId, ipScope, ipReceipt);
            earlyResult = emptyResult("limit_reached");
            return [];
          }
          if (slot.error) {
            if (ipReceipt) await releaseIpQuota(actor.sourceId, ipScope, ipReceipt);
            earlyResult = emptyResult("quota_unavailable");
            return [];
          }
          const started = await startApifyRun(apiToken, actor.actorId, input);
          if (started.error) {
            if (startErrorDefinitelyNotStarted(started.error)) {
              await refundApifyRunSlot();
              if (ipReceipt) await releaseIpQuota(actor.sourceId, ipScope, ipReceipt);
            }
            earlyResult = emptyResult(started.error);
            return [];
          }
          await countJobSourceRun(actor.sourceId);
          const waited = await waitForRun(apiToken, started.run.id, APIFY_SYNC_TIMEOUT_SEC * 1000);
          if (waited.error) { earlyResult = emptyResult(waited.error); return []; }
          const read = await readDataset(apiToken, waited.run.defaultDatasetId);
          if (read.error) { earlyResult = emptyResult(read.error); return []; }
          if (read.records.length) {
            await cacheSet(
              datasetKey,
              { datasetId: waited.run.defaultDatasetId, createdAt: Date.now() },
              Math.round(refreshMs / 1000)
            );
          }
          return read.records;
        },
      });
      if (earlyResult) return earlyResult;
      if (flight.status === "unavailable") return emptyResult("quota_unavailable");
      if (flight.status === "busy") return emptyResult("busy");
      records = flight.value;
    }

    if (records.length) await cacheSet(cacheKey, records, APIFY_CACHE_TTL_SEC);
  }

  // Roles and skill phrases are split into their individual words for the
  // local actor-result filter. The actor has already received the full role
  // query; filtering by the exact phrase here would drop valid BA records
  // whose titles use German or hyphenated wording (e.g. "Java-Entwickler"
  // for "Java Developer" or "Cloud-Engineer" for "Cloud Engineer").
  const skillTokens = Array.isArray(skills)
    ? skills.flatMap((skill) => tokenize(String(skill)))
    : tokenize(skills);
  const keywordTokens = [
    ...roles.flatMap((role) => tokenize(String(role))),
    ...skillTokens,
  ];
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