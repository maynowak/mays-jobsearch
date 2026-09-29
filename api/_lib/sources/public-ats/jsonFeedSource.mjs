import { HttpError, tokenize, locationMatches, keywordHits } from "../../filter.mjs";

export const MAX_JOBS_TO_AI = 40;

/**
 * Generalized addon for public JSON job-feed sources.
 *
 * Standard input (ground structure, configured once at the call site):
 *   fetchJobs({ skills, targetRoles, targetRole, city })
 * Per-source configuration (bound at creation time via the factory):
 *   providerName, identifier, label, options, buildUrl, extractList, normalizeJob
 *
 * The addon owns: param tokenization, fetch + HTTP error mapping,
 * JSON parsing, list extraction, local filtering, ranking, meta.
 * The provider addon only supplies: URL, list shape, normalization.
 */
export function createJsonFeedSource({
  providerName,
  identifier,
  enabled = true,
  label,
  options = {},
  buildUrl,
  extractList,
  normalizeJob,
  maxJobs = MAX_JOBS_TO_AI,
}) {
  const sourceId = `${providerName}:${identifier}`;
  const displayName =
    label || `${providerName[0].toUpperCase()}${providerName.slice(1)} (${identifier})`;

  return {
    id: sourceId,
    displayName,
    provider: "ats",
    enabled: () => enabled,
    fetchJobs: async ({ skills, targetRoles, targetRole, city }) => {
      const roles = Array.isArray(targetRoles) ? targetRoles : targetRole ? [targetRole] : [];
      const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
      const cityQueries = String(city || "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const url = buildUrl(identifier, options);

      let response;
      try {
        response = await fetch(url, { headers: { Accept: "application/json" } });
      } catch {
        throw new HttpError(
          502,
          `Couldn't reach ${displayName} API right now. Please try again in a moment.`,
          "network"
        );
      }

      if (response.status === 404) {
        throw new HttpError(404, `${displayName} "${identifier}" not found.`, "not_found");
      }
      if (response.status === 429) {
        throw new HttpError(
          429,
          `${displayName} API is busy right now. Give it a minute and try again.`,
          "rate_limited"
        );
      }
      if (!response.ok) {
        throw new HttpError(
          502,
          `${displayName} API returned an error (HTTP ${response.status}). Try again shortly.`,
          "upstream"
        );
      }

      let json;
      try {
        json = await response.json();
      } catch {
        throw new HttpError(
          502,
          `${displayName} API sent back something unreadable. Try again shortly.`,
          "upstream"
        );
      }

      const rawList = extractList(json);
      if (!Array.isArray(rawList)) {
        throw new HttpError(
          502,
          `${displayName} API sent an unexpected response. Try again shortly.`,
          "upstream"
        );
      }

      const allJobs = rawList.map(normalizeJob);
      const candidates = allJobs.filter((job) => {
        if (!locationMatches(job, cityQueries)) return false;
        if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
        return true;
      });

      const ranked = candidates
        .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
        .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
        .map(({ job }) => job);

      return {
        jobs: ranked.slice(0, maxJobs),
        meta: {
          enabled: true,
          reason: null,
          totalScanned: allJobs.length,
          totalFiltered: ranked.length,
        },
      };
    },
  };
}
