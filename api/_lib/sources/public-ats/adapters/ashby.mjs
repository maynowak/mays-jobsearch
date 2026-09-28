import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../../../filter.mjs";

const API_BASE = "https://api.ashbyhq.com/posting-api/job-board";
const MAX_JOBS_TO_AI = 40;

export function createAshbySource({ identifier, enabled, label, options = {} }) {
  const SOURCE_ID = `ashby:${identifier}`;
  const includeCompensation = options.includeCompensation === true;

  return {
    id: SOURCE_ID,
    displayName: label || `Ashby (${identifier})`,
    provider: "ats",
    enabled: () => enabled,
    fetchJobs: async ({ skills, targetRoles, targetRole, city }) => {
      const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
      const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
      const cityQueries = String(city || "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const compensationParam = includeCompensation ? "?includeCompensation=true" : "";
      const url = `${API_BASE}/${encodeURIComponent(identifier)}${compensationParam}`;

      let response;
      try {
        response = await fetch(url, { headers: { Accept: "application/json" } });
      } catch {
        throw new HttpError(502, "Couldn't reach Ashby API right now. Please try again in a moment.", "network");
      }

      if (response.status === 404) {
        throw new HttpError(404, `Ashby job board "${identifier}" not found.`, "not_found");
      }
      if (response.status === 429) {
        throw new HttpError(429, "Ashby API is busy right now. Give it a minute and try again.", "rate_limited");
      }
      if (!response.ok) {
        throw new HttpError(502, `Ashby API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
      }

      let json;
      try {
        json = await response.json();
      } catch {
        throw new HttpError(502, "Ashby API sent back something unreadable. Try again shortly.", "upstream");
      }

      if (!json || !Array.isArray(json)) {
        throw new HttpError(502, "Ashby API sent an unexpected response. Try again shortly.", "upstream");
      }

      const allJobs = json.map(normalizeAshbyJob);
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

function normalizeAshbyJob(job) {
  const location = job.location ? [job.location] : [];
  const department = job.department || "";
  const workplaceType = job.workplaceType || undefined;
  const remote = workplaceType === "Remote" || location.some((l) => l.toLowerCase().includes("remote"));

  const descriptionHtml = job.description || job.descriptionPlain || "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.publishedAt ? Date.parse(job.publishedAt) : NaN;
  const updatedAt = job.updatedAt ? Date.parse(job.updatedAt) : NaN;

  const externalId = `ab-${job.id}`;

  let salary = undefined;
  if (job.compensation) {
    const parts = [];
    if (job.compensation.compensationTierSummary) parts.push(job.compensation.compensationTierSummary);
    if (job.compensation.scrapeableCompensationSalarySummary) parts.push(job.compensation.scrapeableCompensationSalarySummary);
    if (parts.length) salary = parts.join(" | ");
  }

  return {
    slug: externalId,
    title: String(job.title || "").trim(),
    company_name: String(job.company || "").trim(),
    location,
    remote,
    tags: department ? [department] : [],
    url: job.jobUrl || job.applyUrl || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID, "ats"],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: job.employmentType ? [job.employmentType.toLowerCase().replace(/\s+/g, "_")] : undefined,
    applyUrl: job.applyUrl,
    jobUrl: job.jobUrl,
    workplaceType: workplaceType?.toLowerCase(),
    department: department || undefined,
    salary,
    externalId,
  };
}