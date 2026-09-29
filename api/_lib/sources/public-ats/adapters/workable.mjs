import { stripHtml, detectLanguage } from "../../../filter.mjs";
import { createJsonFeedSource } from "../jsonFeedSource.mjs";

const API_BASE = "https://apply.workable.com/api/v3/accounts";

export function createWorkableSource({ identifier, enabled, label, options = {} }) {
  return createJsonFeedSource({
    providerName: "workable",
    identifier,
    enabled,
    label,
    options,
    buildUrl: (id) => `${API_BASE}/${encodeURIComponent(id)}/jobs?details=true`,
    extractList: (json) => json?.jobs,
    normalizeJob: (raw) => normalizeWorkableJob(raw, `workable:${identifier}`),
  });
}

function normalizeWorkableJob(job, sourceId) {
  const location = job.location ? [job.location] : [];
  const department = job.department || "";
  const employmentType = job.employment_type || "";
  const remote = job.remote === true;

  const descriptionHtml = job.description || "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.created_at ? Date.parse(job.created_at) : NaN;
  const updatedAt = job.updated_at ? Date.parse(job.updated_at) : NaN;

  const externalId = `wk-${job.shortcode || job.id}`;

  return {
    slug: externalId,
    title: String(job.title || "").trim(),
    company_name: String(job.company_name || "").trim(),
    location,
    remote,
    tags: department ? [department] : [],
    url: job.url || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [sourceId, "ats"],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: employmentType ? [employmentType.toLowerCase().replace(/\s+/g, "_")] : undefined,
    applyUrl: job.url,
    jobUrl: job.url,
    workplaceType: remote ? "remote" : undefined,
    department: department || undefined,
    salary: undefined,
    externalId,
  };
}
