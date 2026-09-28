import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../../../filter.mjs";

const MAX_JOBS_TO_AI = 40;

export function createRecruiteeSource({ identifier, enabled, label, options = {} }) {
  const SOURCE_ID = `recruitee:${identifier}`;
  const baseUrl = options.baseUrl || `https://${identifier}.recruitee.com/api/offers`;

  return {
    id: SOURCE_ID,
    displayName: label || `Recruitee (${identifier})`,
    provider: "ats",
    enabled: () => enabled,
    fetchJobs: async ({ skills, targetRoles, targetRole, city }) => {
      const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
      const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
      const cityQueries = String(city || "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const url = baseUrl;

      let response;
      try {
        response = await fetch(url, { headers: { Accept: "application/json" } });
      } catch {
        throw new HttpError(502, "Couldn't reach Recruitee API right now. Please try again in a moment.", "network");
      }

      if (response.status === 404) {
        throw new HttpError(404, `Recruitee company "${identifier}" not found.`, "not_found");
      }
      if (response.status === 429) {
        throw new HttpError(429, "Recruitee API is busy right now. Give it a minute and try again.", "rate_limited");
      }
      if (!response.ok) {
        throw new HttpError(502, `Recruitee API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
      }

      let json;
      try {
        json = await response.json();
      } catch {
        throw new HttpError(502, "Recruitee API sent back something unreadable. Try again shortly.", "upstream");
      }

      if (!json || !Array.isArray(json.offers)) {
        throw new HttpError(502, "Recruitee API sent an unexpected response. Try again shortly.", "upstream");
      }

      const allJobs = json.offers.map(normalizeRecruiteeJob);
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
        jobs: ranked.slice(0, MAX_JOBS_TO_AI),
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

function normalizeRecruiteeJob(job) {
  const location = job.location ? [job.location] : [];
  const department = job.department || "";
  const employmentType = job.employment_type_code || "";
  const remote = job.remote === true;

  const descriptionHtml = ""; // Recruitee public feed doesn't include description
  const descriptionPlain = "";

  const createdAt = job.created_at ? Date.parse(job.created_at) : NaN;
  const updatedAt = job.updated_at ? Date.parse(job.updated_at) : NaN;

  const externalId = `rc-${job.id}`;

  return {
    slug: externalId,
    title: String(job.title || "").trim(),
    company_name: String(job.company_name || "").trim(),
    location,
    remote,
    tags: job.tags?.filter(Boolean) ? [department, ...job.tags] : (department ? [department] : []),
    url: job.careers_url || job.careers_apply_url || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID, "ats"],
    description: undefined,
    descriptionPlain: undefined,
    language: "en",
    jobTypes: employmentType ? [employmentType.toLowerCase().replace(/\s+/g, "_")] : undefined,
    applyUrl: job.careers_apply_url,
    jobUrl: job.careers_url,
    workplaceType: remote ? "remote" : undefined,
    department: department || undefined,
    salary: undefined,
    externalId,
  };
}