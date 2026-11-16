import { fetchJobDetails } from "../api";
import type { Job } from "../types";
import { evaluateDescription } from "./jobDescriptionReview";

export function hasSufficientJobDescription(job: Job): boolean {
  return (
    evaluateDescription(job.descriptionPlain || job.description || "").completeness ===
    "sufficient"
  );
}

/**
 * Reuse the existing job-details endpoint for sources that can enrich detail
 * data. Other sources have no additional detail path; the ATS dialog offers
 * the manual-description fallback in that case.
 */
export async function loadJobDescriptionForAts(job: Job): Promise<Job | null> {
  if (hasSufficientJobDescription(job)) return job;
  if (!(job.source ?? []).includes("arbeitsagentur")) return null;

  try {
    const result = await fetchJobDetails([job.slug]);
    const enriched = result?.jobs?.[job.slug];
    return enriched && enriched.description ? enriched : null;
  } catch {
    return null;
  }
}
