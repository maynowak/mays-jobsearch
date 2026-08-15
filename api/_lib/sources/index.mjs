import * as arbeitnow from "./arbeitnow.mjs";
import { APIFY_ACTORS } from "./apify/actors.mjs";
import { createApifySource } from "./apify/index.mjs";
import { countJobSourceRequest } from "../usage.mjs";

export const SOURCES = [arbeitnow, ...APIFY_ACTORS.map(createApifySource)];

export function enabledSources() {
  return SOURCES.filter((source) => source.enabled());
}

export function disabledSources() {
  return SOURCES.filter((source) => !source.enabled()).map((source) => source.id);
}

export function sourceDetails() {
  return SOURCES.map((source) => ({
    id: source.id,
    displayName: source.displayName,
    provider: source.provider,
    enabled: source.enabled(),
    ...(source.actorId ? { actorId: source.actorId } : {}),
  }));
}

export function jobKey(job) {
  const location = (job.location || []).join(",").toLowerCase();
  return `${(job.title || "").toLowerCase().trim()}|${(job.company_name || "").toLowerCase().trim()}|${location}`;
}

export function dedupJobs(jobs) {
  const seen = new Map();
  const result = [];
  for (const job of jobs) {
    const key = jobKey(job);
    const existing = seen.get(key);
    if (existing) {
      for (const source of job.source || []) {
        if (!existing.source.includes(source)) existing.source.push(source);
      }
    } else {
      seen.set(key, job);
      result.push(job);
    }
  }
  return result;
}

export async function fetchAllJobs({ skills, targetRole, city }) {
  const sources = enabledSources();
  const settled = await Promise.allSettled(
    sources.map((source) => source.fetchJobs({ skills, targetRole, city }))
  );

  const results = [];
  for (let i = 0; i < settled.length; i += 1) {
    const source = sources[i];
    const outcome = settled[i];
    if (outcome.status === "rejected") {
      if (source.critical) throw outcome.reason;
      console.error(`[sources] ${source.id} failed:`, outcome.reason);
      results.push({ sourceId: source.id, jobs: [], meta: {} });
    } else {
      await countJobSourceRequest(source.id);
      results.push({ sourceId: source.id, ...outcome.value });
    }
  }

  const combined = dedupJobs(results.flatMap((result) => result.jobs));

  const sourcesMeta = {};
  for (const result of results) sourcesMeta[result.sourceId] = result.jobs.length;

  const sourceCounts = {};
  for (const job of combined) {
    for (const source of job.source || []) sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }

  const arbeitnowResult = results.find((result) => result.sourceId === arbeitnow.SOURCE_ID);
  const apifyResult = results.find((result) => result.sourceId === "arbeitsagentur");

  return {
    jobs: combined,
    meta: {
      totalScanned: results.reduce((sum, result) => sum + (result.meta?.totalScanned ?? 0), 0),
      totalFiltered: combined.length,
      city: arbeitnowResult?.meta?.city ?? results[0]?.meta?.city ?? [],
      keywords: arbeitnowResult?.meta?.keywords ?? results[0]?.meta?.keywords ?? [],
      sources: sourcesMeta,
      sourceCounts,
      disabledSources: disabledSources(),
      sourceDetails: sourceDetails(),
      jobsCombined: combined.length,
      apify: apifyResult
        ? { enabled: apifyResult.meta?.enabled === true, reason: apifyResult.meta?.reason ?? null }
        : { enabled: false, reason: "disabled" },
    },
  };
}