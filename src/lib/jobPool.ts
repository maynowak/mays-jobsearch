import type { Job, Match } from "../types";

export function computeRemainingJobs(foundJobs: Job[], matches: Match[]): Job[] {
  const evaluated = new Set(
    matches.map((m) => m.job?.slug).filter((slug): slug is string => Boolean(slug))
  );
  return foundJobs.filter((job) => !evaluated.has(job.slug));
}
