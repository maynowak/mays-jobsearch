import { stripHtml, detectLanguage } from "../../../filter.mjs";
import { createJsonFeedSource } from "../jsonFeedSource.mjs";

const API_BASE = "https://api.ashbyhq.com/posting-api/job-board";

export function createAshbySource({ identifier, enabled, label, options = {} }) {
  const includeCompensation = options.includeCompensation === true;
  return createJsonFeedSource({
    providerName: "ashby",
    identifier,
    enabled,
    label,
    options,
    buildUrl: (id) =>
      `${API_BASE}/${encodeURIComponent(id)}${includeCompensation ? "?includeCompensation=true" : ""}`,
    extractList: (json) => json,
    normalizeJob: (raw) => normalizeAshbyJob(raw, `ashby:${identifier}`),
  });
}

function normalizeAshbyJob(job, sourceId) {
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
    source: [sourceId, "ats"],
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
