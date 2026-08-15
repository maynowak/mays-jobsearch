import {
  SOURCE_ARBEITNOW,
  SOURCE_APIFY_ARBEITSAGENTUR,
  fetchFilteredJobs,
} from "./filter.mjs";
import { fetchArbeitsagenturJobs } from "./apify.mjs";

function jobKey(job) {
  const location = (job.location || []).join(",").toLowerCase();
  return `${(job.title || "").toLowerCase().trim()}|${(job.company_name || "").toLowerCase().trim()}|${location}`;
}

function dedupJobs(jobs) {
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
  const [existingSettled, apifySettled] = await Promise.allSettled([
    fetchFilteredJobs({ skills, targetRole, city }),
    fetchArbeitsagenturJobs({ skills, targetRole, city }),
  ]);

  if (existingSettled.status === "rejected") throw existingSettled.reason;

  const existingResult = existingSettled.value;
  const apifyResult =
    apifySettled.status === "fulfilled" ? apifySettled.value : { jobs: [], meta: {} };

  const combined = dedupJobs([...existingResult.jobs, ...apifyResult.jobs]);

  return {
    jobs: combined,
    meta: {
      totalScanned:
        (existingResult.meta?.totalScanned ?? 0) + (apifyResult.meta?.totalScanned ?? 0),
      totalFiltered: combined.length,
      city: existingResult.meta?.city ?? [],
      keywords: existingResult.meta?.keywords ?? [],
      sources: {
        [SOURCE_ARBEITNOW]: existingResult.jobs.length,
        [SOURCE_APIFY_ARBEITSAGENTUR]: apifyResult.jobs.length,
      },
      jobsCombined: combined.length,
      apify: {
        enabled: apifyResult.meta?.enabled === true,
        reason: apifyResult.meta?.reason ?? null,
      },
    },
  };
}