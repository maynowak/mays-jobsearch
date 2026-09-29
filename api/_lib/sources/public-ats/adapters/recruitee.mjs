import { createJsonFeedSource } from "../jsonFeedSource.mjs";

export function createRecruiteeSource({ identifier, enabled, label, options = {} }) {
  const baseUrl = options.baseUrl || `https://${identifier}.recruitee.com/api/offers`;
  return createJsonFeedSource({
    providerName: "recruitee",
    identifier,
    enabled,
    label,
    options,
    buildUrl: () => baseUrl,
    extractList: (json) => json?.offers,
    normalizeJob: (raw) => normalizeRecruiteeJob(raw, `recruitee:${identifier}`),
  });
}

function normalizeRecruiteeJob(job, sourceId) {
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
    source: [sourceId, "ats"],
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
