import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../../../filter.mjs";

const API_BASE = "https://api.lever.co/v0/postings";
const MAX_JOBS_TO_AI = 40;

export function createLeverSource({ identifier, enabled, label, options = {} }) {
  const SOURCE_ID = `lever:${identifier}`;

  return {
    id: SOURCE_ID,
    displayName: label || `Lever (${identifier})`,
    provider: "ats",
    enabled: () => enabled,
    fetchJobs: async ({ skills, targetRoles, targetRole, city }) => {
      const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
      const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
      const cityQueries = String(city || "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const url = `${API_BASE}/${encodeURIComponent(identifier)}?mode=json`;

      let response;
      try {
        response = await fetch(url, { headers: { Accept: "application/json" } });
      } catch {
        throw new HttpError(502, "Couldn't reach Lever API right now. Please try again in a moment.", "network");
      }

      if (response.status === 404) {
        throw new HttpError(404, `Lever site "${identifier}" not found.`, "not_found");
      }
      if (response.status === 429) {
        throw new HttpError(429, "Lever API is busy right now. Give it a minute and try again.", "rate_limited");
      }
      if (!response.ok) {
        throw new HttpError(502, `Lever API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
      }

      let json;
      try {
        json = await response.json();
      } catch {
        throw new HttpError(502, "Lever API sent back something unreadable. Try again shortly.", "upstream");
      }

      if (!json || !Array.isArray(json)) {
        throw new HttpError(502, "Lever API sent an unexpected response. Try again shortly.", "upstream");
      }

      const allJobs = json.map(normalizeLeverJob);
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

function normalizeLeverJob(job) {
  const location = job.categories?.location ? [job.categories.location] : [];
  const commitment = job.categories?.commitment || "";
  const team = job.categories?.team || "";
  const department = job.categories?.department || "";
  const level = job.categories?.level || "";
  const allLocations = job.categories?.allLocations?.map((l) => l.text).filter(Boolean) || [];

  const tags = [commitment, team, department, level].filter(Boolean);
  const descriptionHtml = job.description || job.descriptionPlain || "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.createdAt ? Date.parse(job.createdAt) : NaN;
  const updatedAt = job.updatedAt ? Date.parse(job.updatedAt) : NaN;

  const externalId = `lv-${job.id}`;

  const workplaceType = job.workplaceType || (commitment.toLowerCase().includes("remote") ? "remote" : undefined);
  const remote = workplaceType === "remote" || location.some((l) => l.toLowerCase().includes("remote"));

  return {
    slug: externalId,
    title: String(job.text || "").trim(),
    company_name: String(job.company || "").trim(),
    location: [...new Set([...location, ...allLocations])],
    remote,
    tags,
    url: job.hostedUrl || job.applyUrl || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID, "ats"],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: commitment ? [commitment.toLowerCase().replace(/\s+/g, "_")] : undefined,
    applyUrl: job.applyUrl || job.hostedUrl,
    jobUrl: job.hostedUrl,
    workplaceType,
    department: department || team || undefined,
    salary: job.salaryRange ? `${job.salaryRange.currency} ${job.salaryRange.interval}: ${job.salaryRange.min}-${job.salaryRange.max}` : undefined,
    externalId,
  };
}